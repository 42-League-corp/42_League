# Audit cyber — 42League — 2026-06-05

> Audit multi-agents (8 zones) avec vérification adversariale de chaque faille.
> Périmètre : backend Hono + Prisma (`apps/backend`), front web (`apps/web`),
> extension (`apps/extension`), infra (Caddy, docker-compose, CI).
> **16 failles confirmées** sur 24 remontées (8 réfutées ou rétrogradées en simple durcissement).

## 1. Résumé exécutif

**Verdict global : pas de faille _critical_, pas de RCE, pas d'accès anonyme à la
DB, pas d'escalade de privilège directe.** L'architecture d'auth est globalement
saine (OAuth 42, cookies signés, comparaison HMAC timing-safe des tokens,
allow-list CORS validée par hostname exact, SUPERADMINS hardcodés). Aucun
`$queryRaw`/SQL brut, Prisma paramétrise tout → **pas d'injection SQL**.

Le **risque n°1 réel de mise hors-ligne** est le **flux SSE `/events` sans
plafond de connexions** : un seul compte légitime peut accumuler des
centaines/milliers de streams jamais refermés et saturer le pool de connexions
Node/Caddy. C'est la seule faille **high** confirmée.

Les autres risques se concentrent sur : (1) **DoS applicatif** (spoof
`X-Forwarded-For` qui annule tout le rate-limit, absence de `bodyLimit`),
(2) **sur-exposition de PII** (les routes de lecture renvoient l'objet `User`
Prisma brut, y compris `ftId`, `moderatorPermissions`, `role`), et (3)
**intégrité de l'économie virtuelle** (farming de League Coins par matchs
collusoires, paris sur soi-même en tournoi).

### Répartition par sévérité (après vérification)

| Sévérité | Nb | Failles |
|----------|----|---------|
| 🔴 Critical | 0 | — |
| 🟠 High | 1 | SSE sans plafond de connexions (DoS) |
| 🟡 Medium | 5 | XFF spoof (rate-limit bypass) · body sans limite (DoS mémoire) · sur-exposition PII `/users` · farming de coins · Bearer 30 j en localStorage |
| 🟢 Low | 9 | `/users/:login` + comptes bannis lisibles · spread `/leaderboard` · `findMany` non bornés · mdp Postgres `league:league` · dev compose expose 5432 · conteneurs en root · backdoor `x-dev-login` · paris-sur-soi tournoi / réouverture marché · token extension en query string |
| ⚪ Info / hardening | 4 | CSP absente · `Vary: Origin` absent · `/queue/join` non rate-limité spécifiquement · incohérence `isAdmin()` vs rôle DB |

---

## 2. Tableau récapitulatif des failles confirmées

| # | Sév. | Faille | Catégorie | Fichier |
|---|------|--------|-----------|---------|
| 1 | 🟠 High | SSE `/events` sans plafond de connexions par user | DoS | `apps/backend/src/sse.ts:9-19` · `index.ts:1202-1226` |
| 2 | 🟡 Med | Spoof `X-Forwarded-For` → rate-limit & anti-brute-force OAuth contournés | DoS | `rate-limit.ts:47-53` · `index.ts:657-678` · `Caddyfile:18-25` |
| 3 | 🟡 Med | Aucune limite de taille de body → DoS mémoire/OOM | DoS | `index.ts` (tous les `c.req.json()`) · `Caddyfile` |
| 4 | 🟡 Med | `/users` renvoie l'objet `User` complet (PII + carte de modération) | DataExposure | `index.ts:1230-1236` |
| 5 | 🟡 Med | Farming illimité de League Coins / quêtes via matchs collusoires | BusinessLogic | `packages/shared/src/anti-farming.ts:14-19` · `index.ts:2173-2183,6265-6300` |
| 6 | 🟡 Med | Bearer 30 j en `localStorage`, non révocable, sans CSP | SecretLeak | `apps/web/src/lib/storage.ts:35-42` · `tokens.ts:3` · `Caddyfile` |
| 7 | 🟢 Low | `/users/:login` expose l'objet complet + fiche d'un compte banni lisible | DataExposure | `index.ts:1270-1327` |
| 8 | 🟢 Low | `/leaderboard` spread `...u` → PII/rôles dans le classement | DataExposure | `index.ts:1364-1368` |
| 9 | 🟢 Low | `findMany` non bornés (pas de pagination) sur listes publiques | DoS | `index.ts:1234,1364,1376,1833` |
| 10 | 🟢 Low | Mot de passe Postgres `league:league` codé en dur (tous environnements) | SecretLeak | `docker-compose*.yml` |
| 11 | 🟢 Low | `docker-compose.yml` (dev) publie Postgres sur `0.0.0.0:5432` | BrokenAccessControl | `docker-compose.yml:9-10` |
| 12 | 🟢 Low | Conteneurs backend/front/postgres en root (pas de `USER`) | Hardening | `apps/backend/Dockerfile` · `apps/web/Dockerfile` |
| 13 | 🟢 Low | Backdoor `x-dev-login` gardée par un seul booléen d'env (pas de garde prod) | BrokenAccessControl | `index.ts:110,551-559,754-755` |
| 14 | 🟢 Low | Pari sur soi-même en tournoi + réouverture du marché après reject | BusinessLogic | `index.ts:6536-6539,6546-6547,4539-4547` |
| 15 | 🟢 Low | Token extension passé en query string (`?token=`) au lieu du fragment | SecretLeak | `apps/extension/src/background/index.ts:28-35` |

**Réfutées / durcissement uniquement (non exploitables en l'état) :** CSP absente
(aucun sink XSS first-party aujourd'hui), `Vary: Origin` absent (pas de CDN, pas
d'`Allow-Credentials`), `/queue/join` non rate-limité spécifiquement (backstop
global suffisant, boucle non O(N) en nominal), incohérence `isAdmin()` vs rôle DB
(la garde figée est _plus_ stricte, pas d'escalade).

---

## 3. Détail des failles

### 🟠 #1 — SSE `/events` : épuisement de connexions / mémoire (High, DoS)
**Fichiers :** `apps/backend/src/sse.ts:9-19`, `index.ts:1202-1226`

`registerSse()` ajoute chaque stream à un `Set` par login **sans jamais vérifier
`set.size`**. Le handler `GET /events` ouvre une boucle `while(alive)` qui ne fait
que `sleep(25s) + ping` — la connexion ne se ferme que si le client coupe. Le
rate-limit global (120/min, `progressive:false`) plafonne le **débit
d'ouverture** mais pas le **nombre accumulé** de connexions ouvertes. Chaque
`emit()`/`broadcast()` itère `[...set]` → coût CPU amplifié à chaque mise à jour
de classement/tournoi.

**Exploit (un compte 42 valide suffit) :**
```bash
TOK=$(curl -s .../auth/stream-token ...)   # route exemptée du limiteur auth
for i in $(seq 1 120); do curl -N "https://.../events?token=$TOK" & done
sleep 60   # répéter — les connexions ne se ferment jamais
```
~1200 sockets + entrées Set + boucles de pump en ~10 min → pool de connexions
saturé, tas mémoire qui enfle, site indisponible. En NAT campus, l'IP partagée
agrège tout le monde derrière la même clé → impact amplifié.

**Correctif :** plafonner les connexions SSE concurrentes par login dans
`registerSse()` (ex. 3-5 max, fermer la plus ancienne au-delà) + timeout absolu de
durée de vie par stream + limite globale de streams par instance.

---

### 🟡 #2 — Spoof `X-Forwarded-For` → tout le rate-limit contournable (Medium, DoS)
**Fichiers :** `rate-limit.ts:47-53`, `index.ts:657-678`, `Caddyfile:18-25`

`clientIp()` renvoie `xff.split(',')[0]` — **la première valeur de
`X-Forwarded-For`, contrôlée par le client**. Le `Caddyfile` fait un simple
`reverse_proxy backend:3000` **sans `trusted_proxies` ni réécriture du XFF** :
Caddy v2 _ajoute_ l'IP réelle en fin de chaîne mais ne supprime pas la valeur
entrante → la première reste celle de l'attaquant. Le limiteur `/auth/*`
(50/15 min, anti-brute-force OAuth) et le backstop global (via `bySubject` qui
retombe sur `ip:` pour tout non-authentifié) sont clé par IP.

**Exploit (attaquant externe non authentifié) :**
```bash
while true; do
  curl -s https://oneleague.fr/api/auth/callback \
    -H "X-Forwarded-For: 10.0.$((RANDOM%255)).$((RANDOM%255))" --data '...'
done
```
Chaque requête = IP différente → buckets jamais remplis, pénalités progressives
neutralisées. L'unique défense anti-flood pré-auth est annulée (bombardement du
`/callback` → fetch sortants vers l'API 42, charge DB/CPU).

**Correctif :** Caddy `trusted_proxies private_ranges` + lire `x-real-ip` (posé
par Caddy lui-même), ou côté Node ne dériver l'IP que du dernier hop de confiance.
Ne jamais faire confiance au XFF client.

---

### 🟡 #3 — Aucune limite de taille de body → DoS mémoire (Medium, DoS)
**Fichiers :** tous les `c.req.json()` de `index.ts` · `Caddyfile`

Aucun middleware `bodyLimit` Hono (`grep bodyLimit` = 0) et aucun
`request_body { max_size }` côté Caddy. `c.req.json()` bufferise **intégralement**
le corps en mémoire avant désérialisation. Le rate-limit (120/min) borne le nombre
de requêtes, pas le nombre d'octets : 120 × 100 Mo = ~12 Go/min bufferisés.

**Exploit (compte authentifié) :**
```bash
curl -X POST .../queue/join -H "Authorization: Bearer ..." \
  -H "Content-Type: application/json" --data-binary @bigfile.json
```
Pic mémoire / pression GC / OOM du process sur un conteneur de taille modeste.
*(Atténué : les routes protégées rejettent 401 avant le `json()`, donc exploit
réservé à un membre authentifié, d'où Medium et non High.)*

**Correctif :** monter `bodyLimit` globalement (ex. 64-256 Ko) + `request_body max_size`
côté Caddy → 413 avant tout parsing.

---

### 🟡 #4 — `/users` expose l'objet `User` Prisma complet (Medium, DataExposure)
**Fichier :** `index.ts:1230-1236`

`prisma.user.findMany({ where: VISIBLE_USER_WHERE })` **sans `select`** → tout
utilisateur authentifié (pas besoin d'être admin, seule garde `getCurrentLogin`)
récupère pour **tous** les joueurs : `ftId` (identifiant pivot intra 42),
`firstName`/`lastName`, `campus`, **`role`, `moderatorPermissions`,
`stagingAllowed`**, dates de bannissement/consentement. C'est exactement le niveau
de détail que `/admin/users` réserve derrière `requireAdminOrModerator`.

**Exploit :** `curl -H 'Authorization: Bearer <token>' https://.../users` →
fichier nominatif complet + cartographie de qui est modérateur/admin.

**Correctif :** `select` allow-list (login, prénom/nom, imageUrl, title, elo,
games, leagueCoins, campus) ; exclure `ftId` et tous les champs de
modération/consentement ; réserver l'objet complet à `/admin/users`.

---

### 🟡 #5 — Farming illimité de League Coins / quêtes (Medium, BusinessLogic)
**Fichiers :** `packages/shared/src/anti-farming.ts:14-19`, `index.ts:2116,2138-2140,2173-2183,6265-6300`

`shouldCountForElo()` retourne **toujours `true`** (l'ancien plafond par paire a
été supprimé). La dégressivité anti-farming (`farmingDecayFactor`, ×0.75ⁿ) n'est
appliquée **qu'à l'ELO** (`index.ts:2138-2140`), pas aux coins ni aux quêtes :
`awardMatchEconomyTx()` verse à plat 20-50 coins et incrémente les compteurs de
quêtes de 1 à chaque match, **sans plafond par paire/fenêtre**.

**Exploit (2 comptes complices) :** A déclare `POST /matches`, B confirme avec le
score miroir. Chaque cycle crédite 20-50 coins à chacun + avance les quêtes hebdo
(jusqu'à 850 coins/semaine). En alternant les déclarants on règle ~20 matchs
classés/jour/paire → ~1400 coins/jour, scriptable. Les coins servent en boutique
et comme mises de paris → économie faussée. *(Monnaie virtuelle, nécessite
collusion → Medium.)*

**Correctif :** appliquer la dégressivité (ou un plafond/jour) **aussi** aux coins
et à la progression de quêtes ; idéalement réintroduire un vrai `shouldCountForElo`
(cap par paire) qui gate `awardMatchEconomyTx`.

---

### 🟡 #6 — Bearer 30 j en localStorage, non révocable, sans CSP (Medium, SecretLeak)
**Fichiers :** `apps/web/src/lib/storage.ts:35-42`, `api.ts:687-691`, `tokens.ts:3`, `Caddyfile`

Le credential d'API est un Bearer HMAC **valable 30 jours** (`TOKEN_TTL_SECONDS`),
stateless **non révocable** (aucune denylist/`tokenVersion`), stocké en clair dans
`localStorage['league:token']` (donc **lisible par tout JS**, pas de `HttpOnly`),
et **aucune CSP** n'est émise. La vérif ne lie le token ni à l'IP ni au
User-Agent → un token volé est rejouable depuis n'importe où (`curl`) 30 jours
durant. *(Pas de sink XSS first-party aujourd'hui → pas d'exploit actif, mais
blast radius maximal au moindre XSS futur ou package front compromis.)*

**Correctif :** servir la session web via cookie `HttpOnly+Secure+SameSite=Lax`
(le mécanisme existe déjà) plutôt qu'un token long-lived en localStorage ; à
défaut, CSP stricte + TTL réduit + rotation/révocation.

---

### 🟢 #7 — `/users/:login` : objet complet + compte banni lisible (Low, DataExposure)
**Fichier :** `index.ts:1270-1327`

`findUnique` sans `select` (mêmes champs sensibles que #4). De plus le garde-fou ne
teste que `deletionScheduledAt` et **n'applique pas `VISIBLE_USER_WHERE`** : un
compte `bannedAt`/`anonymizedAt` reste consultable (fiche + 50 matchs) alors qu'il
est masqué partout ailleurs — **vrai souci RGPD** (un compte anonymisé ne doit pas
être lisible). **Correctif :** `select` allow-list + 404 si `bannedAt`/`anonymizedAt`.

### 🟢 #8 — `/leaderboard` spread `...u` (Low, DataExposure)
**Fichier :** `index.ts:1364-1368`. `users.map((u,i) => ({ rank, ...u, ... }))` injecte
l'objet User complet (ftId, role, moderatorPermissions) dans chaque entrée du
classement. **Correctif :** projeter un DTO public, ne jamais spread l'objet Prisma brut.

### 🟢 #9 — `findMany` non bornés / pas de pagination (Low, DoS)
**Fichier :** `index.ts:1234,1364,1376,1833`. `/users`, `/leaderboard`,
`/teams/leaderboard` (4 `include` de jointures), `/matches` sans `take`. Coût
linéaire avec la base, appelable 120/min/compte. Borné aujourd'hui (un seul
campus) → dette de scalabilité. **Correctif :** `take`/curseur + cache court (5-10 s)
sur les classements.

### 🟢 #10 — Mot de passe Postgres `league:league` (Low, SecretLeak)
**Fichier :** `docker-compose*.yml`. Credential trivial committé sur les 4
environnements. **Atténué :** aucun port DB publié en prod/staging (Postgres
joignable seulement via le réseau Docker interne) → non exploitable à distance sans
pivot. **Correctif :** secret fort par environnement injecté via `.env` non
committé (`${POSTGRES_PASSWORD}`).

### 🟢 #11 — `docker-compose.yml` (dev) publie `0.0.0.0:5432` (Low, BrokenAccessControl)
**Fichier :** `docker-compose.yml:9-10`. Le compose **dev** mappe `5432:5432` (Docker
contourne UFW). Un dev qui fait `docker compose up` sur le LAN du campus expose sa
base locale (`league:league`). N'affecte que les **données de dev**, pas la prod.
**Correctif :** binder en `127.0.0.1:5432:5432`.

### 🟢 #12 — Conteneurs en root (Low, Hardening)
**Fichiers :** `apps/backend/Dockerfile`, `apps/web/Dockerfile`. Aucune directive
`USER`, aucun `cap_drop`/`no-new-privileges`/`read_only`. Défense en profondeur :
amplifie une éventuelle RCE. **Correctif :** `USER node`, user non-root nginx,
migrations dans une étape séparée, durcir les services compose.

### 🟢 #13 — Backdoor `x-dev-login` gardée par un seul booléen (Low, BrokenAccessControl)
**Fichiers :** `index.ts:110,551-559,754-755`. `getCurrentLogin`/`getStreamLogin`
renvoient le header `x-dev-login` **sans signature** quand `ALLOW_DEV_LOGIN==='true'`
→ `x-dev-login: throbert` donne SUPERADMIN. **Atténué :** défaut `false`, `.env`
gitignoré, et le **staging est protégé indépendamment** (la staging-gate utilise
`getSessionLogin` qui n'honore pas `x-dev-login`). La prod reste vulnérable **si**
son `.env` portait le flag (misconfig). **Correctif :** garde dur
`&& NODE_ENV !== 'production'` indépendant du flag ; refus de boot si `true` en
prod ; retirer `x-dev-login` du CORS en prod.

### 🟢 #14 — Paris tournoi : sur-soi + réouverture du marché (Low, BusinessLogic)
**Fichiers :** `index.ts:6536-6539` (pas d'interdiction de parier sur soi en
tournoi, contrairement à la branche `match` l.6552) ; `index.ts:6546-6547` +
`4539-4547` (un `reject`/score divergent remet `recordedByLogin` à null → le marché
de paris se **rouvre** après que le score a été divulgué via `GET /tournaments`).
Edge probabiliste, monnaie virtuelle, règlement sur l'issue réelle → Low.
**Correctif :** interdire `choiceLogin === me` / tout participant pour les paris
`tournament` ; flag `bettingClosed` figé au 1er record.

### 🟢 #15 — Token extension en query string (Low, SecretLeak)
**Fichier :** `apps/extension/src/background/index.ts:28-35`. Le token est lu via
`searchParams.get('token')` (query) alors que le web utilise volontairement le
**fragment** (`#`) pour éviter les logs. **Correctif :** aligner l'extension sur le
fragment (`#token=`, lecture via `parsed.hash`).

---

## 4. Plan de remédiation priorisé

### Quick wins (≤ 1 h chacun, fort ratio impact/effort)
1. **`bodyLimit` Hono global** (64-256 Ko) + `request_body max_size` Caddy → tue #3.
2. **`trusted_proxies` Caddy + `x-real-ip`** dans `clientIp()` → tue #2 (et la 3e
   occurrence du XFF sur les autres zones).
3. **Garde dur `x-dev-login`** : `ALLOW_DEV_LOGIN && NODE_ENV !== 'production'` + refus
   de boot si actif en prod → ferme #13.
4. **`select` allow-list** sur `/users`, `/users/:login`, `/leaderboard` + DTO public →
   ferme #4, #7, #8 (réutiliser un seul helper `toPublicUser`).
5. **Binder le port dev en loopback** `127.0.0.1:5432:5432` → #11.

### Chantiers (à planifier)
6. **Plafond de connexions SSE** par login + timeout de vie → la seule High (#1).
7. **Dégressivité/plafond coins & quêtes** (réintroduire un vrai cap par paire) → #5.
8. **Migrer l'auth web sur cookie HttpOnly** (ou CSP stricte + TTL court + révocation) → #6.
9. **Pagination** (`take`/curseur) + cache court sur les listes → #9.
10. **Durcir Docker** (`USER`, `cap_drop`, secrets par env) → #10, #12.
11. **Garde-fous paris tournoi** (anti-self + marché figé) → #14, et token extension en fragment → #15.

---

## 5. Points positifs (déjà solides)

- **Pas d'injection SQL** : Prisma paramétrise tout, aucun `$queryRaw`/SQL brut.
- **Comparaison de token timing-safe** (HMAC), nonces OAuth via `randomBytes`,
  vérif de `state` (anti-CSRF du flux OAuth).
- **CORS rigoureux** : allow-list + `isTrusted42Origin` qui compare le **hostname
  exact** (les tests rejettent `intra.42.fr.evil.com`, `evilintra.42.fr`,
  `http://intra.42.fr`) ; **`Access-Control-Allow-Credentials` jamais positionné**
  → un ACAO empoisonné ne lit pas de réponse authentifiée.
- **Cookie de session `HttpOnly` + signé** (le token long-lived en localStorage est
  le seul écart).
- **Postgres non exposé en prod/staging** (réseau Docker interne uniquement).
- **`escapeHtml`** sur les valeurs interpolées dans les pages de callback.
- **Backdoor dev fail-secure par défaut** (`false`) + **staging-gate** indépendante
  qui n'honore pas `x-dev-login`.
- **Rate-limiting maison** avec pénalités progressives (le maillon faible est
  uniquement la dérivation d'IP, cf. #2).
- **En-têtes de durcissement Caddy** (HSTS preload, nosniff, X-Frame-Options, COOP)
  + audit sécurité quotidien en CI.

---

*Méthodo : 8 agents de scan (1 par zone) → vérification adversariale de chaque
finding (un agent sceptique relit le code réel pour réfuter) → synthèse. 33 agents,
~830 k tokens, 24 findings bruts → 16 confirmés, 8 réfutés/rétrogradés.*

---

## 6. Statut de remédiation — 2026-06-05

**Toutes les failles confirmées ont été corrigées** (admins exemptés des garde-fous
anti-abus pour pouvoir tester librement). Backend/web/extension typecheck OK,
180 tests backend au vert.

| # | Faille | Statut | Correctif appliqué |
|---|--------|--------|--------------------|
| 1 | SSE sans plafond | ✅ Corrigé | `sse.ts` : max 5 flux/login (éviction du + ancien), admins illimités |
| 2 | Spoof X-Forwarded-For | ✅ Corrigé | Caddy `header_up X-Forwarded-For {remote_host}` (prod+staging) |
| 3 | Body sans limite | ✅ Corrigé | `bodyLimit` 1 Mo global (→413), admins exemptés |
| 4 | `/users` sur-exposition | ✅ Corrigé | `toPublicUser` (deny-list ftId/perms/staging/RGPD) + `take` |
| 5 | Farming de coins | ✅ Corrigé | Dégressivité appliquée aux coins ; quêtes non créditées sur rematch dégressé (1v1+2v2) |
| 6 | Bearer 30 j + pas de CSP | ✅ Atténué | CSP Caddy (`connect-src 'self'` bloque l'exfil fetch/XHR/beacon) |
| 7 | `/users/:login` banni lisible | ✅ Corrigé | 404 si banni/anonymisé (sauf admin) + `toPublicUser` |
| 8 | `/leaderboard` spread | ✅ Corrigé | `toPublicUser` dans le map + `take` |
| 9 | `findMany` non bornés | ✅ Corrigé | `take: 1000` sur /users, /leaderboard, /teams/leaderboard, /matches |
| 10 | Mdp Postgres `league` | ✅ Corrigé | `${POSTGRES_PASSWORD:-league}` (compose prod/staging/registry) |
| 11 | Dev expose 5432 | ✅ Corrigé | `127.0.0.1:5432:5432` (loopback) |
| 12 | Conteneurs root | ✅ Corrigé | `USER node` + cache npm /tmp (Dockerfile backend) |
| 13 | Backdoor `x-dev-login` | ✅ Corrigé | Garde dure `NODE_ENV !== 'production'` + header CORS conditionnel |
| 14 | Paris tournoi (self + réouverture) | ✅ Corrigé | Anti-self + colonne `betsLockedAt` (verrou permanent) |
| 15 | Token extension en query | ✅ Corrigé | Lecture dans le fragment `#token=` |
| — | `Vary: Origin` absent | ✅ Corrigé | `Vary: Origin` (CORS + onError) |

**Exemptions admin** (rôle ADMIN/SUPERADMIN, via Bearer signé ou rôle DB) : rate-limit,
body-limit, plafond SSE. L'anti-farming des coins reste appliqué à tous (les admins
créditent via le grant boutique).

**Action de déploiement requise** : la migration
`20260605130000_tournament_bets_lock` (colonne `bets_locked_at`) est appliquée
automatiquement au boot du conteneur backend (`prisma migrate deploy`). En dev local :
`npm run -w @42-league/backend db:migrate`.

**Reste en durcissement (non bloquant)** : migrer le Bearer web vers un cookie
HttpOnly (au lieu de localStorage) + raccourcir le TTL/ajouter une révocation ;
resserrer `img-src` / retirer `script-src 'unsafe-inline'` via nonces ; passer le
conteneur nginx en non-root.
