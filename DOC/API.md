# Référence API HTTP — 42 League

Référence exhaustive de tous les endpoints du backend Hono (`apps/backend/src/index.ts` + `auth.ts`).

**Conventions**
- Base URL locale : `http://localhost:3000`. En prod : `https://42league.fr/api` (via Caddy).
- Auth : voir [SECURITY.md §7](./SECURITY.md). En résumé, un endpoint « auth » accepte un cookie de
  session signé, un `Authorization: Bearer <token>`, ou (dev uniquement) l'en-tête `x-dev-login`.
- Toutes les erreurs renvoient `{ "message": "..." }` avec le code HTTP correspondant (handler global).
- Les schémas Zod cités sont définis dans `packages/shared/src/schemas.ts` (voir [DOMAIN.md §3](./DOMAIN.md)).

---

## Gardes d'authentification / autorisation

| Garde | Vérifie | Échec |
|---|---|---|
| `getCurrentLogin(c)` | cookie session / Bearer / `x-dev-login` | 401 |
| `getStreamLogin(c)` | idem + `?token=` en query (pour SSE) | 401 |
| `requireAdmin(login)` | rôle `ADMIN` ou `SUPERADMIN` | 403 |
| `requireSuperAdmin(login)` | login dans la liste SUPERADMINS hardcodée | 403 |
| `isAdmin(login)` | login dans `admins.ts` (gère tournois officiels + titres) | 403 |
| `assertNotBanned(login)` | `user.bannedAt` est null | 403 |

---

## Santé & système

### `GET /health`
Public. → `200 { ok: true }`. Aucun effet.

---

## Authentification (routeur `/auth`, `auth.ts`)

| Route | Auth | Description | Réponse |
|---|---|---|---|
| `GET /auth/login` | — | Démarre l'OAuth 42. Pose un cookie `state` signé (10 min). | 302 vers l'intra |
| `GET /auth/web/login?return_to=` | — | Variante site web. `return_to` doit matcher `WEB_APP_URLS`. | 302 |
| `GET /auth/extension/login?ext_redirect=` | — | Variante extension. `ext_redirect` doit être `https://*.chromiumapp.org`. | 302 |
| `GET /auth/callback?code&state` | — | Retour OAuth : vérifie `state` (anti-CSRF), échange le code, lit `/v2/me`, **whitelist check**, crée/maj user. | 302 (ext/web, token dans le fragment `#`) / HTML (cookie posé) / 403 HTML (non whitelisté) / 400 (CSRF) / 502 (API 42 KO) |
| `POST /auth/logout` | session | Supprime le cookie de session. | `200 { ok: true }` |

Cookies posés (`league_session`, `league_oauth_state`) : `httpOnly`, `sameSite=Lax`, **`secure` en prod**
(`NODE_ENV=production`). Token Bearer : HMAC-SHA256, TTL 30 jours.

---

## Profil & RGPD

### `GET /me` — auth
→ `200 { login, user, role, isAdmin }`.

### `GET /me/export` — auth — RGPD Art. 20 (portabilité)
Exporte toutes les données perso de l'appelant. Header `Content-Disposition: attachment`.
→ `200 { exportDate, profile, matchHistory, challenges, tournaments, featureRequests, ops }`.

### `DELETE /me/account` — auth — RGPD Art. 17 (effacement)
Anonymise le compte (login → `anon_<hash>`, vide ftId/campus/imageUrl/title, pose `anonymizedAt` ;
propage en cascade via `onUpdate: Cascade`). Refusé pour un SUPERADMIN.
→ `200 { ok: true }` / `400` (superadmin).

---

## Utilisateurs & classement

| Route | Auth | Description | Réponse |
|---|---|---|---|
| `GET /users` | auth | Tous les users triés par ELO desc. | `200 User[]` |
| `GET /users/:login` | auth | Profil + rang + W/L + 50 derniers matchs. | `200 { user, rank, wins, losses, recent }` / `404` |
| `GET /leaderboard` | auth | Classement complet avec rang. | `200 ({ rank, ...User })[]` |
| `GET /locations` | auth | `login → host` des users actuellement loggés sur l'intra (cache 5 min). | `200 { login: host }` |

---

## Matchs (ad-hoc)

### `GET /matches` — auth
→ `200 PlayedMatch[]` (triés par `playedAt` desc).

### `GET /matches/pending` — auth
→ `200 PendingMatch[]` (triés par `declaredAt` desc).

### `POST /matches` — auth — `DeclareMatchSchema`
Body : `{ opponentLogin, scoreSelf, scoreOpponent }` (un camp exactement à 10).
Refuse l'auto-match (400) ; appelle `assertNotBanned` (403). Crée un `PendingMatch`.
→ `201 { id, status: 'pending' }`. **Emit** `match:pending` → adversaire.

### `POST /matches/:id/confirm` — auth — `ConfirmMatchSchema`
L'adversaire ressaisit son score. Validation bilatérale stricte :
- introuvable → `404` ; pas l'adversaire → `403` ;
- scores ≠ miroir → le pending est **supprimé** (commit) puis `409` (à redéclarer) ;
- scores = miroir → calcul ELO (si `shouldCountForElo`), création `PlayedMatch`, suppression du pending.

→ `200 PlayedMatch`. **Emit** `match:confirmed` → 2 joueurs ; **broadcast** `leaderboard:update`.

### `POST /matches/:id/reject` — auth — `RejectMatchSchema`
Body : `{ contestReason: 'never_played'|'wrong_score', contestMessage (10–500) }`.
Seul l'adversaire (403 sinon, 404 si absent). Crée un `RejectedMatch`, supprime le pending.
→ `200 { id, status: 'rejected', contestReason }`. **Emit** `match:rejected` → déclarant.

---

## Défis (challenges)

### `GET /challenges` — auth
Défis `pending`/`accepted` où je suis impliqué, triés par `scheduledAt` asc. → `200 Challenge[]`.

### `POST /challenges` — auth — `CreateChallengeSchema`
Body : `{ opponentLogin, scheduledAt (ISO, futur ou < 1 min passé) }`. Refuse l'auto-défi (400).
→ `201 Challenge`. **Emit** `challenge:received` → adversaire.

### `POST /challenges/:id/accept` — auth
Seul l'adversaire (403), défi `pending` (409 sinon). status → `accepted`.
→ `200 Challenge`. **Emit** `challenge:accepted` → challenger.

### `POST /challenges/:id/decline` — auth
Challenger (→ `cancelled`) ou adversaire (→ `declined`). Si le défi était **`accepted`** et que
l'adversaire se désiste : **dodge** → `-10 ELO` + `dodgeCount++`.
→ `200 { id, status, eloPenalty }`. **Emit** `challenge:declined` → l'autre ; **broadcast** `leaderboard:update` si pénalité.

### `POST /challenges/:id/record` — auth — `RecordResultSchema`
Participant d'un défi `accepted` (403/409 sinon). status → `recorded` ; crée un `PendingMatch`
(→ confirmation bilatérale). → `201 { pendingId, status: 'pending_confirmation' }`. **Emit** `challenge:recorded` → 2 joueurs.

---

## Tournois

| Route | Auth | Notes |
|---|---|---|
| `GET /tournaments` | — (public) | Liste avec entries + winner. |
| `GET /tournaments/:id` | — (public) | Détail + bracket (`matches`). `404` si absent. |
| `POST /tournaments` | auth + `isAdmin` si `kind=official` | `CreateTournamentSchema` `{ name(2–60), capacity(2\|4), kind }`. Organisateur auto-inscrit. → `201`. |
| `POST /tournaments/:id/join` | auth | `registration` only ; refus si plein/déjà inscrit (409). Auto-start si plein. |
| `POST /tournaments/:id/leave` | auth | `registration` only. |
| `POST /tournaments/:id/start` | auth (organisateur) | Doit être plein (409). Génère le bracket. |
| `POST /tournaments/:id/cancel` | auth (organisateur) | Sauf déjà `finished`/`cancelled`. |
| `POST /tournaments/:id/matches/:matchId/record` | auth (participant) | `TournamentRecordSchema` `{ scoreA, scoreB }`. |
| `POST /tournaments/:id/matches/:matchId/confirm` | auth (participant, ≠ recorder) | Scores ≠ → reset + 409. Sinon avance le vainqueur ; finale → `finished` + `tournamentsWon++`. |
| `POST /tournaments/:id/matches/:matchId/reject` | auth (participant) | Reset des scores saisis. |

Toutes les mutations `/tournaments*` déclenchent un **broadcast** `tournament:update` (middleware).

---

## Ops (vantardise)

| Route | Auth | Description |
|---|---|---|
| `GET /ops` | — (public) | Tous les ops actifs (`expiresAt > now`). |
| `GET /ops/me` | auth | `{ current, targetedBy, canDeclareAt }`. |
| `GET /ops/user/:login` | — (public) | `{ owns, targetedBy }` d'un user. |
| `POST /ops` | auth — `DeclareOpsSchema` | `{ targetLogin }`. Refuse : auto-cible (400), 1 ops actif/owner, cooldown actif, cible déjà engagée (409). Crée un ops 7 j. **Emit** `ops:update` → [owner, target]. → `201`. |

---

## Feature requests

| Route | Auth | Description |
|---|---|---|
| `POST /feature-requests` | auth — `FeatureRequestSchema` | `{ text (10–500) }`. → `201`. |
| `GET /feature-requests` | `requireAdmin` | Toutes les demandes + auteur. |
| `PATCH /feature-requests/:id/status` | `requireAdmin` — `SetFeatureRequestStatusSchema` | `{ status: 'pending'\|'accepted'\|'rejected' }`. |

---

## Admin

> Toutes les mutations sous `/admin/*` déclenchent un **broadcast** `data:update` (middleware).
> Les actions sensibles sont tracées via `logAdminAction` (voir [SECURITY.md §1](./SECURITY.md)).

| Route | Auth | Action loggée | Description |
|---|---|---|---|
| `POST /admin/users/:login/title` | `isAdmin` | `EDIT_TITLE` | `SetTitleSchema` `{ title: string\|null (≤40) }`. |
| `POST /admin/users/:login/role` | `requireSuperAdmin` | `SET_ROLE` | `SetRoleSchema` `{ role: 'USER'\|'ADMIN' }`. SUPERADMIN immuable (400). |
| `GET /admin/users` | `requireAdmin` | — | Tous les users (rôle, stats, ban). |
| `PATCH /admin/users/:login/stats` | `requireAdmin` | `EDIT_STATS` | `{ elo?, matchesPlayed?, dodgeCount?, tournamentsWon? }` (int ≥ 0). |
| `POST /admin/users/:login/ban` | `requireAdmin` | `BAN_USER` | Pose `bannedAt`. Refuse un SUPERADMIN (400). |
| `POST /admin/users/:login/unban` | `requireAdmin` | `UNBAN_USER` | Vide `bannedAt`. |
| `GET /admin/users/:login/moderation` | `requireAdmin` | — | `{ user, recentMatches, topOpponents, rejectionsEmitted, rejectionsReceived }`. |
| `DELETE /admin/matches/:id` | `requireAdmin` | `DELETE_MATCH` | Supprime un match (réverse l'ELO si compté). |
| `PATCH /admin/matches/:id` | `requireAdmin` | `EDIT_MATCH` | `{ scoreA, scoreB }` ; recalcule le vainqueur. |
| `GET /admin/rejected-matches` | `requireAdmin` | — | 200 derniers litiges. |
| `GET /admin/suspicious` | `requireAdmin` | — | Détection anti-triche (voir ci-dessous). |
| `GET /admin/audit-log?actor&target&action&limit` | `requireAdmin` | — | Journal filtrable (max 500). |
| `POST /admin/refresh-images` | ⚠️ **aucune garde** | — | Déclenche un backfill des avatars manquants. → `{ scheduled: n }`. *(à durcir : pas de check admin)* |

### `GET /admin/suspicious` — flags anti-triche
Renvoie une liste de drapeaux triés par sévérité. Types détectés :
- **pair_domination** : un joueur gagne ≥75 % de ≥5 matchs contre un même adversaire.
- **recent_farming** : une paire joue ≥15 matchs en 7 jours.
- **victim_pattern** : un joueur avec WR global ≥35 % perd ≥80 % contre un adversaire précis.
- **elo_spike** : gain d'ELO > 2σ+80 sur 30 jours (≥5 matchs).

---

## Temps réel

### `GET /events` — `getStreamLogin` (accepte `?token=`)
Flux **Server-Sent Events** (`text/event-stream`). Voir [REALTIME.md](./REALTIME.md) pour le détail.
- Événement initial `connected` ; ping keep-alive toutes les 25 s.
- Événements ciblés : `match:*`, `challenge:*`, `ops:update`.
- Événements globaux (broadcast) : `leaderboard:update`, `tournament:update`, `data:update`.

---

## Récapitulatif des événements SSE émis

| Événement | Déclencheur | Cible |
|---|---|---|
| `match:pending` | `POST /matches` | adversaire |
| `match:confirmed` | `POST /matches/:id/confirm` | 2 joueurs |
| `match:rejected` | `POST /matches/:id/reject` | déclarant |
| `challenge:received` | `POST /challenges` | adversaire |
| `challenge:accepted` | `POST /challenges/:id/accept` | challenger |
| `challenge:declined` | `POST /challenges/:id/decline` | l'autre partie |
| `challenge:recorded` | `POST /challenges/:id/record` | 2 joueurs |
| `ops:update` | `POST /ops` + timers expiry/cooldown | [owner, target] |
| `leaderboard:update` | confirm match, dodge | broadcast |
| `tournament:update` | toute mutation `/tournaments*` | broadcast |
| `data:update` | toute mutation `/admin/*` | broadcast |
