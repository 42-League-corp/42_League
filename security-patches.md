# 42 League — Security Patches & Threat Model

> **Règle obligatoire :** À chaque code review (PR ou pair review), le reviewer doit
> consulter ce fichier et le compléter si la PR introduit une nouvelle surface d'attaque
> ou corrige une faille. Ce document est la mémoire de sécurité du projet.

---

## Architecture de sécurité (vue d'ensemble)

```
Internet → OAuth 42 Intra → Whitelist check → Session cookie (HMAC-SHA256)
                                            └→ Bearer token (extension)
                                                      ↓
                               Role check (SUPERADMIN hardcoded, ADMIN en DB)
                                                      ↓
                                    Validation Zod → Handler → Prisma (paramétré)
```

---

## Patch 001 — Usurpation de score (Score Spoofing)

**Vecteur :** Un joueur déclare un score falsifié (ex: 10-0 alors que la vraie partie était 5-10).

**Mitigation :**
- Validation bilatérale obligatoire : l'adversaire doit confirmer **exactement** le score inverse.
- En cas de divergence (`confirmedSelf !== p.scoreOpponent || confirmedOpponent !== p.scoreDeclarer`), le `PendingMatch` est **supprimé** — aucun des deux scores ne passe en DB.
- Aucun ELO n'est modifié sans confirmation bilatérale (`PlayedMatch` n'est créé qu'après accord).
- Même logique sur les `TournamentMatch` (reset des scores, ré-saisie obligatoire).

**Fichiers concernés :** `index.ts` → `POST /matches/:id/confirm`, `POST /tournaments/:id/matches/:matchId/confirm`

---

## Patch 002 — Privilege Escalation (Auto-attribution de rôle Admin)

**Vecteur :** Un utilisateur tente de s'auto-promouvoir ADMIN/SUPERADMIN via l'API.

**Mitigations :**
- Le rôle `SUPERADMIN` est **hardcodé** dans `SUPERADMINS = new Set(['abidaux', 'throbert'])` côté serveur. Aucune route API ne peut attribuer ce rôle.
- À chaque connexion (`getOrCreateUser`), si le login est dans `SUPERADMINS`, le champ `role` est **force-écrasé** à `SUPERADMIN` en base, même si quelqu'un avait tenté de le modifier directement en DB.
- La route `POST /admin/users/:login/role` n'accepte que `USER` ou `ADMIN` (schéma Zod `SetRoleSchema`). Elle vérifie `requireSuperAdmin(me)` — uniquement les membres de `SUPERADMINS` peuvent l'appeler.
- Tenter de modifier le rôle d'un SUPERADMIN via cette route retourne HTTP 400 (`cannot change role of a superadmin`).

**Fichiers concernés :** `index.ts` → `SUPERADMINS`, `getOrCreateUser`, `POST /admin/users/:login/role` ; `schemas.ts` → `SetRoleSchema`

---

## Patch 003 — Injection de Game Falsifiée (Ghost Match Injection)

**Vecteur :** Un utilisateur crée un `PendingMatch` contre un tiers sans que la partie ait eu lieu, en espérant que l'adversaire ne rejette pas à temps.

**Mitigations :**
- L'adversaire dispose de `POST /matches/:id/reject` avec raison obligatoire (`never_played` | `wrong_score`) + message textuel (10–500 chars) — la contestation est loggée.
- L'adversaire peut aussi déclarer un score différent → mismatch détecté → match annulé automatiquement.
- L'anti-farming (`shouldCountForElo`) empêche qu'un même duo gagne de l'ELO plus de 2× par semaine, limitant l'impact d'une injection réussie.
- Notification SSE instantanée (`match:pending`) : l'adversaire est alerté immédiatement sans refresh, réduisant la fenêtre d'exposition.

**Fichiers concernés :** `index.ts` → `POST /matches`, `POST /matches/:id/reject` ; `anti-farming.ts`

---

## Patch 004 — CSRF sur l'OAuth Callback

**Vecteur :** Forcer un utilisateur à initier un OAuth callback avec un `code` valide mais un `state` contrôlé par l'attaquant.

**Mitigation :**
- Le `state` est un nonce cryptographique 16 octets (`randomBytes(16)`) stocké dans un cookie signé HMAC (`STATE_COOKIE`, TTL 10 min).
- Le callback vérifie `stored.nonce !== stateParam` → 400 si mismatch.
- Cookie `httpOnly`, `sameSite: 'Lax'` — non accessible au JS côté client, protection contre le CSRF traditionnel.
- Le `STATE_COOKIE` est supprimé dès lecture (one-shot).

**Fichiers concernés :** `auth.ts` → `startOauth`, `GET /auth/callback`

---

## Patch 005 — Session Hijacking / Token Forgery

**Vecteur :** Un attaquant tente de forger ou modifier un session cookie / bearer token pour usurper une identité.

**Mitigation :**
- Session cookie signé HMAC-SHA256 via `SESSION_SECRET` (variable d'environnement, jamais en code).
- Bearer token (extension) signé HMAC-SHA256 + TTL 30 jours, vérifié avec `timingSafeEqual` pour éviter les timing attacks.
- Aucun token n'est stocké en DB — révocation par expiration uniquement (acceptable pour ce cas d'usage).

**Fichiers concernés :** `auth.ts` → `getSessionLogin` ; `tokens.ts` → `issueToken`, `verifyToken`

---

## Patch 006 — Open Redirect via OAuth

**Vecteur :** Manipuler `ext_redirect` ou `return_to` pour rediriger l'utilisateur vers un site malveillant après OAuth.

**Mitigation :**
- `ext_redirect` : validé strictement — `https:` uniquement + hostname `.chromiumapp.org` (`isValidExtRedirect`).
- `return_to` : comparé à la liste blanche `WEB_APP_URLS` (variable d'env), reject sinon.
- Ces valeurs sont stockées dans le `STATE_COOKIE` signé — non modifiables après emission.

**Fichiers concernés :** `auth.ts` → `isValidExtRedirect`, `isValidWebRedirect`, `startOauth`

---

## Patch 007 — ELO Farming / Boosting (Anti-Smurfing)

**Vecteur :** Deux joueurs complices jouent des dizaines de parties pour accumuler de l'ELO artificiellement.

**Mitigation :**
- Maximum 2 matchs comptant pour l'ELO par paire par fenêtre de 7 jours (`shouldCountForElo`).
- Les matchs supplémentaires sont enregistrés en DB (`PlayedMatch.countedForElo = false`) mais sans impact ELO.
- La fenêtre anti-farming est vérifiée **dans la transaction** — pas de race condition possible.

**Fichiers concernés :** `anti-farming.ts` ; `index.ts` → `POST /matches/:id/confirm`

---

## Patch 008 — Accès non autorisé aux Feature Requests

**Vecteur :** Un utilisateur ordinaire tente de lire toutes les feature requests (données potentiellement sensibles).

**Mitigation :**
- `GET /feature-requests` vérifie `getUserRole(me)` → requiert `ADMIN` ou `SUPERADMIN`.
- `PATCH /feature-requests/:id/status` idem — seuls les admins peuvent changer le statut.
- N'importe quel utilisateur authentifié peut **soumettre** une feature request — pas de restriction.

**Fichiers concernés :** `index.ts` → `GET /feature-requests`, `PATCH /feature-requests/:id/status`

---

## Patch 009 — Injection SQL

**Vecteur :** Injection de SQL via les paramètres d'entrée utilisateur.

**Mitigation :**
- Toutes les requêtes DB passent par **Prisma Client** avec des paramètres préparés — aucune concaténation de SQL brut.
- Les entrées utilisateur sont validées par **Zod** avant d'atteindre Prisma (types, longueurs, formats).
- Aucune utilisation de `prisma.$queryRaw` dans le codebase actuel — si jamais ajouté, utiliser impérativement `Prisma.sql` template literal (paramétré).

**Fichiers concernés :** Toutes les routes dans `index.ts` ; `schemas.ts`

---

## Patch 010 — Bypass de l'Admin Check sur les Tournois Officiels

**Vecteur :** Un utilisateur non-admin crée un tournoi `kind: 'official'` en manipulant le payload.

**Mitigation :**
- `CreateTournamentSchema` valide que `kind` est `'friendly'` ou `'official'` uniquement.
- Si `kind === 'official'`, vérification `isAdmin(me)` (liste hardcodée) avant création.
- La validation Zod empêche toute valeur arbitraire pour `kind`.

**Fichiers concernés :** `index.ts` → `POST /tournaments` ; `schemas.ts` → `CreateTournamentSchema`

---

## Patch 011 — Déni de Service via SSE (Connection Flood)

**Vecteur :** Un attaquant ouvre des milliers de connexions SSE simultanées pour épuiser les sockets serveur.

**État actuel :** Non mitigé — à surveiller en production.

**Recommandations futures :**
- Rate-limit sur `GET /events` (ex: max 3 connexions par IP via un middleware).
- Timeout sur les connexions SSE inactives (au-delà de X secondes sans ping répondu).
- Monitoring du nombre de connexions actives dans le `connections` Map de `sse.ts`.

**Fichiers concernés :** `sse.ts`, `index.ts` → `GET /events`

---

## Patch 012 — Challenge Phantom (Défi accepté puis score falsifié)

**Vecteur :** Joueur A envoie un défi à B, B accepte. A enregistre un faux score avantageux.

**Mitigation :**
- `POST /challenges/:id/record` crée un `PendingMatch` → **confirmation bilatérale identique** au flux ad-hoc (voir Patch 001).
- Le score final ne passe en `PlayedMatch` qu'après accord des deux parties.
- Si A refuse de confirmer après enregistrement → la partie reste en `pending` jusqu'à contestation.

**Fichiers concernés :** `index.ts` → `POST /challenges/:id/record`, `POST /matches/:id/confirm`

---

## Checklist de review sécurité

À vérifier pour chaque PR :

- [ ] Toute nouvelle route vérifie l'authentification (`getCurrentLogin`)
- [ ] Les données utilisateur passent par un schema Zod avant usage
- [ ] Les checks de rôle/permission sont faits **avant** toute modification en DB
- [ ] Aucune concaténation SQL brute (`$queryRaw` sans template paramétré)
- [ ] Les nouvelles actions sensibles (création/suppression) émettent un log ou un SSE event
- [ ] Si une route modifie un rôle ou des permissions : documenter dans ce fichier
- [ ] Les nouveaux endpoints sont couverts par cette checklist
