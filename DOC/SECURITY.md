# Sécurité — 42 League

Documentation du dispositif de sécurité applicative et CI/CD ajouté au projet.
Cible : un dev qui reprend le repo dans 6 mois et veut comprendre comment ça marche.

---

## Vue d'ensemble

On applique le principe de **défense en profondeur** : plusieurs couches indépendantes
qui se complètent. Si une couche cède, les autres protègent encore.

```
┌─────────────────────────────────────────────────────────────────┐
│  Couches de défense                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Validation des inputs        → Zod sur chaque endpoint       │
│  2. Authentification             → 42 OAuth + sessions           │
│  3. Autorisation                 → requireAdmin / requireSuper   │
│  4. Audit log (qui fait quoi)    → admin_audit_log + Discord     │
│  5. Visibilité UI conditionnelle → bouton GOD masqué aux non-adm │
│  6. Scan code source             → CodeQL (SAST)                 │
│  7. Scan dépendances             → npm audit + Dependabot        │
│  8. Scan images Docker           → Trivy                         │
│  9. Notifications temps réel     → 2 webhooks Discord            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Audit log des actions admin

### Le problème

Avant : un admin pouvait bannir, débannir, promote/demote, modifier les ELO sans
laisser aucune trace. Si un compte admin était compromis ou si un admin abusait,
on n'avait aucun moyen de savoir qui avait fait quoi.

### La solution

Chaque action sensible est **persistée en DB** + **notifiée Discord en temps réel**.

### Modèle de données

Fichier : `apps/backend/prisma/schema.prisma`

```prisma
enum AdminAction {
  SET_ROLE                  // promotion/demotion USER ↔ MODERATOR ↔ ADMIN
  SET_MODERATOR_PERMISSIONS // (dé)coche des permissions granulaires d'un MODERATOR
  BAN_USER         // ban d'un user
  UNBAN_USER       // unban d'un user
  EDIT_STATS       // modif ELO / matchs / dodge / tournaments_won
  EDIT_TITLE       // modif du titre cosmétique
  DELETE_MATCH     // suppression d'un match joué
  EDIT_MATCH       // modif du score d'un match
  REFRESH_IMAGES   // backfill des avatars (réservé pour usage futur)
  RESET_DATABASE   // reset total de la ligue (SUPERADMIN)
  DELETE_CHALLENGE // suppression d'un défi (All History)
  DELETE_PENDING_MATCH   // suppression d'un match en attente
  DELETE_REJECTED_MATCH  // suppression d'un litige
  DELETE_OPS       // suppression d'un OPS
  DELETE_TOURNAMENT      // suppression d'un tournoi
  IMPERSONATE_TESTER     // bascule en compte `tester` (staging, throbert/jagharra)
  SYNC_ELO_FROM_PROD     // synchro ELO prod→staging (SUPERADMIN, lecture seule prod)
}

model AdminAuditLog {
  id          String      @id @default(uuid())
  actorLogin  String      // qui a fait l'action
  actorRole   Role        // son rôle au moment de l'action
  action      AdminAction
  targetLogin String?     // sur qui (null si action globale)
  payload     Json?       // détails ({"from": "USER", "to": "ADMIN"} etc.)
  ipAddress   String?     // IP source de la requête
  userAgent   String?     // navigateur / client
  createdAt   DateTime    @default(now())

  @@index([createdAt(sort: Desc)])
  @@index([actorLogin])
  @@index([targetLogin])
}
```

Migration appliquée : `apps/backend/prisma/migrations/20260529030000_add_admin_audit_log/`

### Le helper

Fichier : `apps/backend/src/audit.ts`

```ts
await logAdminAction(c, {
  actor: me,
  actorRole: await getUserRole(me),
  action: 'BAN_USER',
  target: 'alice42',
  payload: { reason: 'cheating' },
});
```

Le helper fait **deux choses** :
1. Insère une ligne dans `admin_audit_log`
2. Poste un message Discord dans `#audit` (fire-and-forget — si Discord pète, l'audit DB passe quand même)

Les deux opérations sont **non-bloquantes** : si elles échouent (DB down, webhook révoqué), l'action métier (ban, role change…) se termine quand même. On log l'erreur dans la console, sans casser l'UX.

### Les endpoints wrappés

Fichier : `apps/backend/src/index.ts`

| Endpoint | Action loggée |
|---|---|
| `POST /admin/users/:login/role` | `SET_ROLE` |
| `PATCH /admin/users/:login/moderator-permissions` | `SET_MODERATOR_PERMISSIONS` |
| `POST /admin/users/:login/ban` | `BAN_USER` |
| `POST /admin/users/:login/unban` | `UNBAN_USER` |
| `PATCH /admin/users/:login/stats` | `EDIT_STATS` |
| `POST /admin/users/:login/title` | `EDIT_TITLE` |
| `DELETE /admin/matches/:id` | `DELETE_MATCH` |
| `PATCH /admin/matches/:id` | `EDIT_MATCH` |
| `DELETE /admin/challenges/:id` | `DELETE_CHALLENGE` |
| `DELETE /admin/pending-matches/:id` | `DELETE_PENDING_MATCH` |
| `DELETE /admin/rejected-matches/:id` | `DELETE_REJECTED_MATCH` |
| `DELETE /admin/ops/:id` | `DELETE_OPS` |
| `DELETE /admin/tournaments/:id` | `DELETE_TOURNAMENT` |
| `POST /admin/reset-database` | `RESET_DATABASE` |
| `POST /admin/impersonate-tester` · `POST /admin/impersonate-fresh-tester` | `IMPERSONATE_TESTER` |
| `POST /admin/seasons/sync-elo-from-prod` | `SYNC_ELO_FROM_PROD` |

### Consultation

- **API** : `GET /admin/audit-log?actor=X&target=Y&action=BAN_USER&limit=200`
  Filtres validés par Zod, max 500 entrées par appel.
- **UI** : nouvel onglet **AUDIT** dans le GOD panel (`/GOD` → onglet AUDIT)
  Affiche date, acteur, rôle, action, cible, payload, IP. Filtrable.

---

## 2. Webhooks Discord

### Deux canaux distincts

| Canal | Webhook | Sert à |
|---|---|---|
| **#audit** | `DISCORD_AUDIT_WEBHOOK_URL` (env serveur) | Actions admin temps réel |
| **#security** | hardcodé dans `security-alerts.yml` | Alertes CodeQL / Trivy + résumé quotidien |

### Webhook #audit (côté backend)

- Variable : `DISCORD_AUDIT_WEBHOOK_URL` dans `/opt/42_league/.env` du serveur prod
- Lu par : `apps/backend/src/audit.ts` → fonction `notifyDiscord()`
- Si la variable est absente → l'audit fonctionne quand même (DB), juste pas de ping Discord
- Format des messages : `<emoji> **<ACTION>** by \`<actor>\` (<role>) → \`<target>\` + payload en JSON`

### Webhook #security (côté CI)

- Référencé directement dans `.github/workflows/security-alerts.yml`
- Posté par le workflow GitHub Actions quand une alerte est créée
- ⚠️ Actuellement **hardcodé dans le fichier** — pour le rotater proprement, déplace-le en
  Repo Secret GitHub (`Settings → Secrets → Actions → New repository secret`) et remplace
  l'URL par `${{ secrets.DISCORD_SECURITY_WEBHOOK_URL }}` dans le workflow.

### Rotation d'un webhook

Si un webhook est compromis (collé dans un chat, dans un screen, leak quelconque) :
1. Discord → Server Settings → Intégrations → Webhooks → **Delete Webhook**
2. **Create New Webhook** → copy URL
3. Pour `#audit` : `ssh root@<server> 'sed -i "s|DISCORD_AUDIT_WEBHOOK_URL=.*|DISCORD_AUDIT_WEBHOOK_URL=<new>|" /opt/42_league/.env'` puis redémarrer le backend
4. Pour `#security` : modifier `security-alerts.yml` (ou idéalement migrer vers un secret) et push

---

## 3. Gating de l'UI

### Le problème

L'URL `/GOD` était accessible à n'importe qui (le backend rejetait l'accès, OK,
mais l'URL était devinable et apparaissait dans le bundle). Aucun moyen pour un
admin de l'atteindre depuis l'interface — il fallait taper l'URL.

### La solution

Un bouton conditionnel apparaît dans la nav **uniquement si** `me.role === 'ADMIN' || 'SUPERADMIN'`.

| Plateforme | Fichier | Endroit |
|---|---|---|
| Desktop | `apps/web/src/shell/DesktopShell.tsx` | Sidebar, sous "Réglages", séparateur rouge |
| Mobile | `apps/web/src/mobile/primitives/MobileHeader.tsx` | Bouton rond rouge à côté de l'avatar |

Icône : `Shield` (lucide-react), couleur rouge pour signaler la zone d'action sensible.

### Sécurité

⚠️ **Ce n'est qu'une couche d'UX**, pas une couche de sécurité.
Le vrai contrôle d'accès reste côté backend (`requireAdmin` / `requireSuperAdmin`).
Cacher le bouton ne fait que rendre la fonctionnalité moins découvrable.

---

## 4. Scanners CI

Trois scanners tournent en automatique sans intervention humaine.

### CodeQL (SAST — analyse statique)

Fichier : `.github/workflows/codeql.yml`

- **Quand** :
  - Cron tous les jours à **3h UTC** (5h Paris en hiver)
  - À chaque PR vers `main` qui touche `apps/**` ou `packages/**`
  - Manuel via "Run workflow"
- **Quoi** : analyse le code TypeScript/JavaScript pour détecter :
  - Injections (SQL, command, path traversal)
  - XSS
  - Désérialisation non sûre
  - Secrets hardcodés
  - Utilisation d'APIs dangereuses
- **Output** : alertes dans l'onglet **Security → Code scanning** du repo
- **Suite security-extended** activée — couvre plus de patterns que la suite par défaut

### Trivy (scan d'images Docker)

Steps dans : `.github/workflows/deploy.yml`

- **Quand** : après chaque build d'image (backend ou frontend)
- **Quoi** : scanne l'image Docker juste pushée sur ghcr.io
  - CVE dans l'image de base (`node:20-alpine`)
  - CVE dans les paquets système installés (apk add ...)
  - CVE dans les dépendances npm copiées dans l'image
- **Sévérités scannées** : CRITICAL + HIGH uniquement (skip LOW/MEDIUM pour réduire le bruit)
- **Mode** : `ignore-unfixed: true` — on ne reporte que les CVE qui ont un fix dispo
- **Mode** : `exit-code: 0` + `continue-on-error: true` — Trivy ne **bloque pas** le déploiement,
  il remonte juste les findings dans l'onglet Security
- **Output** : SARIF uploadé dans l'onglet **Security → Code scanning** (catégories `trivy-backend` / `trivy-frontend`)

### npm audit (scan des dépendances)

Fichier : `.github/workflows/dependency-audit.yml`

- **Quand** :
  - Cron tous les jours à **4h UTC** (6h Paris)
  - À chaque PR qui touche `**/package.json` ou `**/package-lock.json`
  - Manuel
- **Quoi** : `npm audit --audit-level=high --omit=dev` — CVE connues dans les dépendances de prod
- **Mode** : `continue-on-error: true` — non bloquant
- **Output** : sortie dans le **Summary** du workflow run (visible dans l'onglet Actions)

---

## 5. Notifications Discord temps réel pour la sécu

Fichier : `.github/workflows/security-alerts.yml`

Workflow déclenché par **3 événements** :

### Event 1 — Nouvelle alerte de scan code

```yaml
on:
  code_scanning_alert:
    types: [created, reopened]
```

Quand CodeQL ou Trivy crée une nouvelle alerte dans l'onglet Security, GitHub
déclenche l'event `code_scanning_alert`. Le workflow lit les détails de l'alerte
et poste un message Discord avec :
- Emoji selon sévérité (💥 critical / 🚨 high / ⚠️ medium / 🔎 low)
- Règle déclenchée (ex: `js/sql-injection`)
- Description
- Lien direct vers l'alerte sur GitHub

### Event 2 — Résumé quotidien

```yaml
schedule:
  - cron: '0 6 * * *'  # 6h UTC = 8h Paris en été
```

Tous les matins, le workflow appelle l'API GitHub pour compter les alertes ouvertes.
- **Si 0 alerte** → ping heartbeat : `✅ Tout va bien aujourd'hui — aucune faille de sécu détectée !`
- **Si N > 0** → poste un récap groupé par sévérité

Le heartbeat est important : si Discord se tait pendant 2+ jours, tu sais qu'un truc
est cassé (webhook révoqué, Actions désactivé, repo non accessible…).

Exemple de message :
```
🛡️ Daily security summary — 3 open alert(s)
high: 1 · medium: 2
https://github.com/42-League-corp/42_League/security/code-scanning
```

### Event 3 — Manuel

Bouton "Run workflow" dans l'onglet Actions, pour tester ou forcer un résumé.

### Audit sécurité quotidien consolidé (`daily-security-audit.yml`)

En complément des alertes ponctuelles, un **rapport quotidien consolidé** est poussé sur Discord :
il agrège en un seul message le résultat des **tests**, du **npm audit**, des **sondes live** (santé
de l'app déployée) et un récap des **alertes CodeQL** ouvertes. C'est l'évolution « tout-en-un » du
heartbeat : un silence prolongé signale toujours un job cassé, mais on a en plus l'état réel chaque jour.

---

## 6. Validation des inputs (Zod)

Côté backend, **toutes les mutations** valident leur payload avec Zod avant d'exécuter.
La validation rejette automatiquement les types invalides, les valeurs hors bornes,
les champs manquants.

Exemples de schémas :
- `SetRoleSchema` — body de POST /admin/users/:login/role
- Schéma inline pour PATCH /admin/users/:login/stats (`elo ≥ 0`, `matchesPlayed ≥ 0`, etc.)
- `AuditQuerySchema` — query params de GET /admin/audit-log

Aucun endpoint admin mutant n'accepte de payload non validé.

Quelques schémas spécifiques aux routes admin/saison/suivi sont déclarés **inline** dans `index.ts` plutôt que
dans le package partagé : `AdminCreateUserSchema` (login 2–20 + campus/elo bornés), `AdminForceResultSchema`
(joueurs ≠, scores 0–50 ≠), `AddTournamentPlayerSchema`, `CreateSeasonSchema`, `FollowPrefsSchema`. Le **reset de la base** exige en plus une
**phrase de confirmation exacte** (`oui je suis sure de ce que je fais`) renvoyée dans le body.

---

## 6 bis. Rate-limiting (`rate-limit.ts`)

Garde-fou anti-abus pour la bêta, par IP, fenêtre glissante en mémoire. **Désactivé sous `NODE_ENV=test`**
(les tests d'intégration partagent l'IP `unknown` et trébucheraient sur le plafond ; le middleware
lui-même est couvert par `rate-limit.test.ts`). Une requête bloquée renvoie `429`.

| Limiteur | Portée | Plafond | But |
|---|---|---|---|
| `global` | `*` | 600 req / 60 s | backstop flood / scan |
| `auth` | `/auth/*` | 50 req / 15 min | anti brute-force OAuth / spam de `state` |
| `write` | mutations sur `/matches*`, `/challenges*`, `/tournaments*`, `/ops`, `/feature-requests` | 120 req / 60 s | bloquer les floods de mutations |

Le preflight CORS (`OPTIONS`) est court-circuité en amont et n'est pas décompté. Détails dans
[API.md](./API.md#rate-limiting).

**Exemption admin** : un Bearer **signé** d'un compte ADMIN/SUPERADMIN (détecté par `isAdminRequest`,
cache 30 s) **contourne** le rate-limit, le body-limit et le plafond SSE — un admin doit pouvoir
générer beaucoup de requêtes (multi-onglets, scripts de test, modération). L'anti-farming des coins,
lui, reste appliqué à tout le monde.

À cela s'ajoute un **`bodyLimit` global de 1 Mo** (`hono/body-limit` → `413`, admins exemptés) qui
borne la mémoire bufferisée par requête (anti-DoS), et un **plafond de 5 flux SSE par login**
(éviction du plus ancien, admins illimités).

---

## 7. Authentification (42 OAuth + sessions)

### Le principe

L'identité d'un utilisateur vient de l'**intra 42**. On ne stocke aucun mot de passe.
On délègue l'authentification à l'OAuth de 42.

### Le flux OAuth

Fichier : `apps/backend/src/auth.ts`

| Route | Rôle |
|---|---|
| `GET /auth/login` | Démarre le flux OAuth (redirige vers l'intra 42). |
| `GET /auth/callback` | Retour de l'intra. Vérifie le code, récupère le profil 42, crée/maj l'utilisateur. |
| `GET /auth/web/login` | Variante du démarrage pour le site web. |
| `GET /auth/extension/login` | Variante pour l'extension navigateur. |
| `POST /auth/logout` | Détruit la session. |

Étapes du callback :
1. L'intra 42 renvoie un `code` + un `state`.
2. Le `state` est vérifié via un cookie signé (anti-CSRF du flux OAuth).
3. Le backend échange le `code` contre un access token 42, puis lit le profil (`login`, `campus`, image).
4. **Plus de whitelist.** Le filtre `whitelist.ts` a été **supprimé** (commit *remove whitelist*) :
   tout login 42 valide est admis (open access). L'identité reste garantie par l'OAuth 42 ; le contrôle
   de privilèges repose désormais entièrement sur les rôles/`isAdmin` (§8), pas sur une liste d'accès.
5. L'utilisateur est créé ou mis à jour en DB (`getOrCreateUser`). Au passage, une éventuelle
   **suppression programmée** (`deletionScheduledAt`) est annulée — se reconnecter pendant la période
   de grâce restaure intégralement le compte (RGPD Art. 17, voir [API.md](./API.md) `DELETE /me/account`).
   Un tout **nouveau compte** déclenche une notif `new_player` à la ligue.

### Les deux preuves de session acceptées

Le backend accepte **deux** moyens de prouver son identité (`getSessionLogin`) :

1. **Token Bearer** — en-tête `Authorization: Bearer <token>`.
   - Format : `<payloadBase64url>.<signature>`.
   - Signature : **HMAC-SHA256** avec `SESSION_SECRET` (`apps/backend/src/tokens.ts`).
   - Payload : `{ login, iat, exp }`. Durée de vie : **30 jours**.
   - Vérification : comparaison **timing-safe** (`timingSafeEqual`) + contrôle de l'expiration.
   - C'est ce que le **site web** utilise : le token est stocké dans `localStorage` et envoyé à chaque requête.

2. **Cookie de session signé** — cookie `httpOnly`, `SameSite=Lax`, signé avec `SESSION_SECRET`.

`getCurrentLogin` applique l'ordre : token/cookie d'abord, puis en dernier recours l'en-tête `x-dev-login` (réservé au développement local), sinon renvoie **401**.

### Cas du temps réel (SSE) — token éphémère de scope `sse`

`EventSource` ne peut pas envoyer d'en-tête `Authorization` : le token passe en **query string**
(`/events?token=…`), où il peut fuiter (logs d'accès, header `Referer`). On n'y met donc **jamais**
le Bearer 30 jours. À la place :

1. Le front appelle `GET /auth/stream-token` (avec son Bearer/cookie) → token **scope `sse`, TTL 60 s**
   (`issueStreamToken`, `tokens.ts`), redemandé à chaque (re)connexion.
2. `GET /events` accepte ce token via `getStreamLogin` → `verifyStreamToken` (n'accepte **que** le
   scope `sse`).
3. **Cloisonnement de scope** : `verifyToken` (toutes les routes mutantes) **refuse** un token `sse`.
   Un token de stream qui fuiterait ne peut donc qu'ouvrir le flux en lecture — jamais muter le compte.
4. `GET /auth/stream-token` est **exempté du rate-limit `auth`** (sinon une longue session SSE, qui en
   redemande souvent, se ferait throttler).

(En dev, `x-dev-login` reste accepté sur `/events` quand `ALLOW_DEV_LOGIN=true`.)

### Secret

- `SESSION_SECRET` signe **à la fois** les tokens Bearer et les cookies.
- S'il est absent, `getSessionLogin` renvoie `null` (personne n'est authentifié).
- Le générer : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

---

## 8. Autorisation (requireAdmin / requireSuperAdmin)

Une fois l'utilisateur **authentifié** (section 7), on vérifie ce qu'il a le **droit** de faire.

### Les rôles

- Enum `Role` en DB : `USER`, `MODERATOR`, `ADMIN`, `SUPERADMIN` (`apps/backend/prisma/schema.prisma`).
- `getUserRole(login)` (`apps/backend/src/index.ts`) calcule le rôle :
  - Si le login est dans la liste **SUPERADMINS hardcodée** (`abidaux`, `throbert`) → toujours `SUPERADMIN`.
  - Sinon → le rôle stocké en DB.
  - Sinon → `USER` par défaut.
- `SetRoleSchema` (`packages/shared/src/schemas.ts`) n'accepte que `USER` / `MODERATOR` / `ADMIN` :
  le rôle `SUPERADMIN` n'est **jamais** accordable par API (réservé à la liste hardcodée, cf. plus bas).

### Le rôle MODERATOR et ses permissions granulaires

Entre `USER` et `ADMIN`, le rôle **`MODERATOR`** ne donne **aucun** pouvoir par défaut. Chaque
capacité est débloquée individuellement par un flag booléen, stocké dans la colonne JSON
`moderatorPermissions` de `User` (`null` = aucune permission). Un ADMIN coche/décoche ces flags
via `PATCH /admin/users/:login/moderator-permissions` (action auditée `SET_MODERATOR_PERMISSIONS`).

La liste fait foi dans `MODERATOR_PERMISSIONS` (`apps/backend/src/index.ts`) :

| Permission | Route(s) débloquée(s) |
|---|---|
| `canBan` | ban / unban d'un user |
| `canEditStats` | `PATCH /admin/users/:login/stats` |
| `canDeleteMatches` | `DELETE /admin/matches/:id` |
| `canEditMatches` | `PATCH /admin/matches/:id` |
| `canDeletePendingMatches` | `DELETE /admin/pending-matches/:id` |
| `canDeleteRejectedMatches` | `GET` + `DELETE /admin/rejected-matches` |
| `canDeleteChallenges` | `DELETE /admin/challenges/:id` |
| `canDeleteOps` | `DELETE /admin/ops/:id` |
| `canDeleteTournaments` | `DELETE /admin/tournaments/:id` |
| `canViewSuspicious` | `GET /admin/suspicious` (détection anti-triche) |
| `canViewAuditLog` | `GET /admin/audit-log` |
| `canViewHistory` | `GET /admin/all-history` |

### Les gardes

| Garde | Règle | Si échec |
|---|---|---|
| `requireAdmin(login)` | Le rôle doit être `ADMIN` ou `SUPERADMIN`. | `403` |
| `requireAdminOrModerator(login)` | Rôle `ADMIN`, `SUPERADMIN` **ou** `MODERATOR` (consultation basique). | `403` |
| `requirePerm(login, perm)` | `ADMIN`/`SUPERADMIN` → toujours OK ; `MODERATOR` → OK **si** `moderatorPermissions[perm]` ; `USER` → refusé. | `403` |
| `requireSuperAdmin(login)` | Le login doit être dans la liste SUPERADMINS hardcodée. | `403` |
| `assertNotBanned(login)` | L'utilisateur ne doit pas avoir `bannedAt`. | `403` |

Chaque endpoint admin appelle la garde correspondante **avant** d'exécuter quoi que ce soit. Les
endpoints délégables à un modérateur sont gardés par `requirePerm(me, '<permission>')` plutôt que par
`requireAdmin` — un ADMIN/SUPERADMIN les traverse toujours, un MODERATOR uniquement si le flag est posé.

### Le rôle SUPERADMIN est immuable

À chaque connexion, `getOrCreateUser` **réimpose** le rôle `SUPERADMIN` aux logins de la
liste hardcodée. Aucune route API ne peut accorder ou retirer ce rôle. La liste vit
uniquement dans le code (`SUPERADMINS` dans `apps/backend/src/index.ts`).

### Deux notions d'« admin » distinctes (à ne pas confondre)

1. **Rôle `USER`/`MODERATOR`/`ADMIN`/`SUPERADMIN`** (ci-dessus) → contrôle l'accès au **GOD panel** et aux actions admin (ban, ELO, rôles…). Gardé par `requireAdmin` / `requireSuperAdmin` / `requirePerm`.
2. **Liste `isAdmin()`** (`apps/backend/src/admins.ts`, logins `throbert`/`abidaux` — les **founders**) → autorise uniquement la **création/validation des tournois OFFICIELS** et le **forçage des résultats** (cf. §8 ter). C'est une liste séparée, indépendante du rôle DB.

---

## 8 bis. Saisons — actions durcies en SUPERADMIN

La gestion des saisons (`apps/backend/src/index.ts`) est **réservée aux SUPERADMIN** (`requireSuperAdmin`),
pas aux simples ADMIN : une bascule de saison remet des ELO à zéro et fige un classement — c'est
destructif et irréversible. Sont gardés en SUPERADMIN : `POST /seasons` (clôturer la saison courante +
en ouvrir une neuve, reset ELO), `POST /seasons/:id/activate` (bascule de la vue saison),
`POST /admin/seasons/sync-elo-from-prod` (§8 quater) et `DELETE /seasons/:id`.

**Refus de supprimer la saison active** : `DELETE /seasons/:id` rejette en `400` si `season.isActive`
(« activez d'abord une autre saison ») — sinon la ligue se retrouverait sans aucune saison courante.

`CreateSeasonSchema` valide le nom (`z.string().trim().min(2).max(40)`) ; toute la bascule
(désactiver l'ancienne + reset + créer la neuve) se fait dans **une seule transaction** Prisma.

---

## 8 ter. Impersonation testeur & endpoints god « force »

### TesterSwitch — impersonation du compte `tester` (staging only)

Pour vivre l'expérience d'un joueur lambda (UI sans privilèges), un admin peut basculer sur un
compte de test. Garde-fous cumulés sur `POST /admin/impersonate-tester` et
`POST /admin/impersonate-fresh-tester` :

- **staging UNIQUEMENT** : refus `403` si `APP_ENV !== 'staging'` (jamais en prod, fail-secure).
- **réservé à `throbert` / `jagharra`** : `TESTER_SWITCH_LOGINS` (`apps/backend/src/index.ts`).
  Le front masque aussi le bouton hors de ces logins (`TesterSwitch.tsx`).
- **seul le compte dédié `tester`** (rôle USER) est ciblable — on ne *mint* jamais le token d'un
  vrai joueur arbitraire : aucune usurpation possible. La variante *fresh* crée un compte
  `tester-<uuid8>` neuf (onboarding rejoué).
- Chaque bascule est auditée (`IMPERSONATE_TESTER`). Le retour au compte d'origine est purement
  côté client (`startImpersonation` / `stopImpersonation`, `apps/web/src/lib/storage.ts`).

`jagharra` est un invité de test (rôle ADMIN sur staging, **jamais** SUPERADMIN, cf.
`staging-seed.ts`). `abidaux` et `throbert` sont les **founders** (page À propos + `isAdmin()`).

### Endpoints god « force » de tournoi

| Endpoint | Qui peut |
|---|---|
| `POST /admin/tournaments/:id/invites/:inviteId/force-accept` | `requireAdmin` (ADMIN/SUPERADMIN) — inscrit d'office un invité. |
| `POST /admin/tournaments/:id/matches/:matchId/force-result` | ADMIN/SUPERADMIN (`isAdminLogin`) **ou** le créateur d'un tournoi *amical* (`friendly`). Pose le score sans confirmation des joueurs, puis applique la même propagation que la confirmation normale. |

Côté UI, l'accès au GOD panel et aux boutons « force » est gaté par `isAdmin` (rôle), mais — comme
toujours — le **vrai contrôle reste serveur** : ces routes appellent leur garde avant d'agir.

---

## 8 quater. Synchro ELO prod → staging

`POST /admin/seasons/sync-elo-from-prod` recopie les ELO/compteurs de la prod vers le staging pour
que le classement staging reflète le réel. Garde-fous (`apps/backend/src/index.ts`) :

- **staging UNIQUEMENT** (`APP_ENV === 'staging'`) et **`requireSuperAdmin`**.
- **lecture seule de la prod** : un `PrismaClient` dédié pointe `PROD_READONLY_URL` (un rôle
  Postgres SELECT-only attendu — défense en profondeur : même un bug ne peut rien écrire en prod) ;
  `503` si la variable n'est pas configurée. Le client est `$disconnect()` dans un `finally`.
- **seuls l'ELO + les compteurs** sont copiés (jamais rôle, permissions, coins) ; les comptes
  prod absents du staging sont créés en rôle `USER` minimal. Audité `SYNC_ELO_FROM_PROD`.

---

## 8 quinquies. Anti-triche / anti-farming de l'économie virtuelle

Suite à l'AUDIT_CYBER (cf. §10), l'intégrité de l'économie League Coins a été durcie :

- **Gains de coins dégressifs** : la dégressivité anti-farming (`farmingDecayFactor`, ×0.75ⁿ pour
  chaque rematch du jour contre le même adversaire/duo) s'applique désormais **aussi** aux coins,
  pas seulement à l'ELO (`awardMatchEconomyTx`, 1v1 + 2v2). Les quêtes ne sont **pas** créditées sur
  un rematch dégressé. But : neutraliser le farming de coins par matchs collusoires.
- **Verrou des paris** (`betsLockedAt`) : en tournoi, le marché de paris est **figé définitivement**
  au premier enregistrement d'un score (`m.betsLockedAt ?? new Date()`). Un `reject`/score divergent
  ne peut plus *rouvrir* le marché après que l'issue a fuité via `GET /tournaments`. On interdit aussi
  de **parier sur soi-même**. Migration `20260605130000_tournament_bets_lock`.
- **Boutique cosmétique non-achetable pour l'instant** : aucune vraie pièce cosmétique n'est en
  vente (cartes *placeholder* côté `ShopPage.tsx`) ; les coins se gagnent en match / quêtes mais ne
  s'obtiennent autrement que par grant admin. L'achat (`POST /shop/:id/buy`) **revalide tout côté
  serveur dans une transaction** : objet `active`, non déjà possédé, solde suffisant — le front ne
  décide rien. L'admin du catalogue (`POST` / `PATCH /admin/shop/items/:id`) est gardé `requireAdmin`
  et valide le payload via `ShopItemCreateSchema` / `ShopItemUpdateSchema`.

---

## 8 sexies. RGPD — consentement explicite

Les CGU de l'API 42 exigent le consentement explicite **avant** tout traitement des données
(`apps/backend/src/index.ts`). Le dispositif :

- Preuve stockée sur la ligne `User` : `termsAcceptedAt` + `termsVersion`. Si la politique évolue,
  on bumpe `CURRENT_TERMS_VERSION` (`'2026-05-31'`) → tous les utilisateurs doivent **re-consentir**.
- **Consent-gate** middleware : tant que `consentRequired(user)` est vrai, l'API refuse l'accès,
  sauf chemins exemptés (`CONSENT_EXEMPT_PATHS` : `/health`, `/me`, `/me/consent`, `/me/export`,
  `/me/account`, `/events`, `/auth/*`) qui doivent fonctionner *avant* consentement.
- Route `POST /me/consent` (`ConsentSchema`) : `accept:true` enregistre la preuve ; `accept:false`
  → suppression sèche d'un compte vierge, **anonymisation** sinon (préserve l'intégrité de
  l'historique des matchs). Un SUPERADMIN ne peut pas s'auto-supprimer.
- `termsAcceptedAt` / `termsVersion` font partie des champs **retirés** des réponses publiques
  (`PUBLIC_USER_OMIT` → `toPublicUser`, cf. §10).

---

## 9. Permissions GitHub Actions

Chaque workflow utilise le **principe du moindre privilège** :

| Workflow | Permissions |
|---|---|
| `codeql.yml` | `actions: read`, `contents: read`, `security-events: write` |
| `dependency-audit.yml` | `contents: read` |
| `deploy.yml` (builds) | `contents: read`, `packages: write`, `security-events: write` |
| `security-alerts.yml` | `contents: read`, `security-events: read` |

Aucun workflow n'a `write` global. `security-events: write` est nécessaire pour uploader
les SARIF de Trivy/CodeQL dans l'onglet Security.

---

## Comment opérer

### Voir les alertes de sécu actives

GitHub → onglet **Security** → **Code scanning** :
https://github.com/42-League-corp/42_League/security/code-scanning

### Voir l'audit log des admins

1. Connecte-toi en ADMIN/SUPERADMIN
2. Clique sur le bouton **Shield rouge** dans la nav
3. Onglet **AUDIT**
4. Filtre par acteur / cible / action

### Voir le webhook Discord en action

Va dans le canal #audit ou #security. Si vide depuis longtemps :
- #audit silencieux = aucune action admin récente (normal)
- #security silencieux = aucune alerte de sécu ouverte (normal)

### Rotater un secret/webhook

Voir section "Webhooks Discord → Rotation d'un webhook" plus haut.

### Désactiver temporairement un scanner

Dans son `.yml` :
```yaml
on:
  workflow_dispatch:   # garde le manuel
  # schedule: ...       # commenter le cron
  # pull_request: ...   # commenter le trigger PR
```

### Forcer un re-scan

GitHub → Actions → choisir le workflow → **Run workflow** → main → Run.

---

## 10. Audit cyber & corrections appliquées

Un **audit multi-agents** (8 zones, vérification adversariale de chaque finding) a été mené le
2026-06-05 — rapport complet : [AUDIT_CYBER_2026-06-05.md](./AUDIT_CYBER_2026-06-05.md). Bilan :
**0 critical, pas de RCE, pas d'injection SQL** (Prisma paramétrise tout), pas d'escalade directe.
16 findings confirmés sur 24, **tous corrigés**. Le plus grave (seul *high*) était un flux SSE sans
plafond de connexions. Résumé des durcissements (déjà reflétés dans les sections ci-dessus) :

| Faille | Correctif |
|---|---|
| SSE sans plafond (DoS) | `sse.ts` : max **5 flux/login** (éviction du plus ancien), admins illimités. |
| Spoof `X-Forwarded-For` (bypass rate-limit) | Caddy écrase `X-Forwarded-For`/`X-Real-IP` avec `{remote_host}` (prod + staging). |
| Body sans limite (DoS mémoire) | `bodyLimit` **1 Mo** global (→ `413`), admins exemptés. |
| Sur-exposition PII (`/users`, `/users/:login`, `/leaderboard`) | `toPublicUser` (deny-list `ftId` / `moderatorPermissions` / `stagingAllowed` / champs RGPD) + `take: 1000` ; `404` sur compte banni/anonymisé (sauf admin). |
| Farming de coins | dégressivité appliquée **aussi** aux coins ; quêtes non créditées sur rematch dégressé (§8 quinquies). |
| Bearer 30 j en localStorage / pas de CSP | **CSP** ajoutée côté Caddy (`connect-src 'self' https://api.intra.42.fr` bloque l'exfil) + `Vary: Origin`. |
| Mdp Postgres `league:league` | `${POSTGRES_PASSWORD:-league}` injectable par environnement (compose prod/staging/registry). |
| Dev expose `5432` | binding loopback `127.0.0.1:5432:5432`. |
| Conteneurs en root | backend : `USER node` + cache npm/npx redirigé vers `/tmp` (Dockerfile). |
| Backdoor `x-dev-login` | garde dure `NODE_ENV !== 'production'` + header CORS conditionnel. |
| Paris tournoi (sur-soi + réouverture) | anti-self + colonne `betsLockedAt` (verrou permanent, §8 quinquies). |
| Token extension en query string | lecture dans le **fragment** (`#token=`). |

**Reste en durcissement (non bloquant)** : migrer le Bearer web vers un cookie `HttpOnly` (au lieu de
localStorage) + TTL réduit / révocation ; resserrer `img-src` et retirer `script-src 'unsafe-inline'`
via nonces ; passer le conteneur nginx en non-root. Voir aussi « Ce qui n'est PAS encore en place ».

---

## Cartographie des fichiers

```
.github/workflows/
├── codeql.yml                    # SAST (CodeQL)
├── dependency-audit.yml          # npm audit
├── deploy.yml                    # build + deploy + Trivy steps
├── security-alerts.yml           # → Discord pings (alertes ponctuelles + résumé)
├── daily-security-audit.yml      # rapport quotidien consolidé → Discord
├── ci.yml                        # lint / typecheck / tests sur PR
├── build.yml                     # build manuel (non-sécu)
└── force-build-deploy.yml        # déploiement forcé manuel

apps/backend/
├── prisma/
│   ├── schema.prisma             # enum AdminAction (+ DELETE_*/RESET_DATABASE) + model AdminAuditLog
│   └── migrations/               # ... add_admin_audit_log, add_*_delete_history, etc.
└── src/
    ├── audit.ts                  # helper logAdminAction + notifyDiscord (emojis DELETE_*)
    ├── tokens.ts                 # tokens Bearer (scope 'auth') + tokens de stream (scope 'sse')
    ├── rate-limit.ts             # middleware rate-limiting (global/auth/write) + rate-limit.test.ts
    │                             #   (whitelist.ts SUPPRIMÉ — plus de filtre d'accès OAuth)
    └── index.ts                  # endpoints admin wrappés + audit-log + all-history + actions SUPERADMIN

apps/web/src/
├── shell/DesktopShell.tsx        # bouton GOD desktop (gated)
├── mobile/primitives/MobileHeader.tsx  # bouton GOD mobile (gated)
├── lib/
│   ├── api.ts                    # types AdminAuditEntry + adminAuditLog() + streamToken()
│   └── i18n.tsx                  # traduction nav.god
└── pages/GODPage.tsx             # onglets AUDIT / All History (delete inline + sudo) + AuditTab
```

---

## Ce qui n'est PAS encore en place

Liste des features sécu envisagées mais pas implémentées :

- **2FA TOTP pour SUPERADMIN** — actuellement le compte 42 seul suffit
- **Sudo mode** — re-auth avant les actions destructives (ban, role change, reset DB)
- **CSP / HSTS headers** — `helmet` middleware non installé
- **Cloudflare WAF** — pas de proxy en amont du serveur
- **Branch protection** — push direct sur `main` toujours autorisé
- **Backups DB chiffrés offsite** — non automatisé
- **DAST** — pas de scan d'app déployée
- **Honey-tokens** — pas en place

À traiter dans des PRs séparées, par ordre d'impact.

---

## Glossaire

- **SAST** (Static Application Security Testing) — analyse du code source à la recherche de vulnérabilités. Outil : CodeQL.
- **DAST** (Dynamic Application Security Testing) — attaque d'une app en cours d'exécution. Pas en place.
- **SCA** (Software Composition Analysis) — scan des dépendances tierces. Outils : npm audit + Dependabot + Trivy.
- **SARIF** (Static Analysis Results Interchange Format) — format JSON standard pour les résultats de scans de sécu. C'est ce que CodeQL et Trivy uploadent.
- **CVE** (Common Vulnerabilities and Exposures) — identifiant public d'une vulnérabilité connue (ex: CVE-2024-1234).
- **Audit log** — registre des actions sensibles, immuable. Sert au forensics post-incident.
- **Fire-and-forget** — appel asynchrone dont on n'attend pas le résultat. Utilisé pour le webhook Discord : si Discord répond pas, on s'en fiche, l'action métier doit aboutir.
- **Defense in depth** (défense en profondeur) — empiler plusieurs couches de protection indépendantes.
