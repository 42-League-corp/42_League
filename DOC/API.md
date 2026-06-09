# Référence API HTTP — 42 League

Référence exhaustive de tous les endpoints du backend Hono (`apps/backend/src/index.ts` + `auth.ts`),
multi-discipline (babyfoot, smash, échecs, street fighter, fléchettes) avec économie de coins, boutique,
quêtes hebdo et paris.

**Conventions**
- Base URL locale : `http://localhost:3000`. En prod : `https://oneleague.fr/api` (via Caddy).
- Auth : voir [SECURITY.md §7](./SECURITY.md). En résumé, un endpoint « auth » accepte un cookie de
  session signé, un `Authorization: Bearer <token>`, ou (dev uniquement) l'en-tête `x-dev-login`.
- Toutes les erreurs renvoient `{ "message": "..." }` avec le code HTTP correspondant (handler global).
- Les schémas Zod cités sont définis dans `packages/shared/src/schemas.ts` (voir [DOMAIN.md §3](./DOMAIN.md)).
  Quelques schémas spécifiques aux routes admin/tournoi/saison/suivi/boutique sont déclarés **inline** dans
  `index.ts` (`AdminCreateUserSchema`, `AdminForceResultSchema`, `AddTournamentPlayerSchema`, `CreateSeasonSchema`,
  `FollowPrefsSchema`, `AdminUpdateTournamentSchema`, `ShopItemUpdateSchema`, `ShopGrantSchema`, `ShopGrantItemSchema`,
  `EquipSchema`, `PlaceBetSchema`).

---

## Rate-limiting

Middleware `rate-limit.ts` (par IP, fenêtre glissante en mémoire). **Désactivé sous `NODE_ENV=test`.**
Une requête bloquée renvoie `429`.

| Limiteur | Portée | Plafond |
|---|---|---|
| `global` | `*` (backstop anti-flood/scan) | 600 req / 60 s |
| `auth` | `/auth/*` (anti brute-force OAuth) | 50 req / 15 min |
| `write` | mutations (`POST/PATCH/PUT/DELETE`) sur `/matches*`, `/challenges*`, `/tournaments*`, `/ops`, `/feature-requests` | 120 req / 60 s |

> Le preflight CORS (`OPTIONS`) est court-circuité avant les limiteurs et n'est pas compté.

---

## Gardes d'authentification / autorisation

| Garde | Vérifie | Échec |
|---|---|---|
| `getCurrentLogin(c)` | cookie session / Bearer / `x-dev-login` | 401 |
| `getStreamLogin(c)` | idem + token **éphémère de scope `sse`** en `?token=` (pour SSE — voir `GET /auth/stream-token`) | 401 |
| `requireAdmin(login)` | rôle `ADMIN` ou `SUPERADMIN` | 403 |
| `requirePerm(login, perm)` | `ADMIN`/`SUPERADMIN`, **ou** `MODERATOR` avec la permission granulaire `perm` (`canBan`, `canDeleteMatches`, `canDeleteTournaments`, `canViewSuspicious`, …) | 403 |
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
| `GET /auth/callback?code&state` | — | Retour OAuth : vérifie `state` (anti-CSRF), échange le code, lit `/v2/me`, crée/maj user. **Plus de whitelist** (open access — `whitelist.ts` supprimé, cf. [SECURITY.md §7](./SECURITY.md)). Un tout nouveau compte déclenche une notif `new_player` à la ligue. | 302 (ext/web, token dans le fragment `#`) / HTML (cookie posé) / 400 (CSRF) / 502 (API 42 KO) |
| `GET /auth/stream-token` | session/Bearer | Échange le credential complet contre un **token éphémère de scope `sse`** (TTL **60 s**) à passer en `?token=` pour ouvrir `/events`. Évite de mettre le Bearer 30 j en query string (logs/Referer). **Exempté du rate-limit `auth`** (le front en redemande à chaque reconnexion). | `200 { token }` / 500 si `SESSION_SECRET` absent |
| `POST /auth/logout` | session | Supprime le cookie de session. | `200 { ok: true }` |

Cookies posés (`league_session`, `league_oauth_state`) : `httpOnly`, `sameSite=Lax`, **`secure` en prod**
(`NODE_ENV=production`). Token Bearer : HMAC-SHA256, scope `auth`, TTL 30 jours. Token de stream :
HMAC-SHA256, scope `sse`, TTL 60 s — **refusé** sur toute route mutante (ne peut qu'ouvrir `/events`).

---

## Profil & RGPD

### `GET /me` — auth
→ `200 { login, user, role, isAdmin, ownedTitles, titleColor, equippedBadge, equippedBanner, coins, stagingAllowed, badges, palmares, consentRequired, termsVersion }`.
- `badges` : codes de badges (par défaut dérivés du rôle/fondateur + gagnés) — catalogue front `lib/badges.ts`.
- `palmares` : classements finaux par saison (`{ seasonId, seasonName, rank, elo, wins, losses }[]`, récents d'abord).
- `ownedTitles` : titres débloqués (accomplissements) proposés au sélecteur de titre (cf. `PUT /me/title`).
- `titleColor`/`equippedBadge`/`equippedBanner` : cosmétiques **boutique** actuellement équipés.
- `coins` : solde **League Coins** du porte-monnaie boutique (`user.leagueCoins`, défaut 0). Voir [§ Économie de coins](#économie-de-coins--boutique-quêtes-paris).
- `stagingAllowed` : autorisé à la barrière staging (`STAGING_ALLOWED`/testeur).
- `consentRequired`/`termsVersion` : pilotent la consent-gate front (CGU).

### `PUT /me/title` — auth — `{ title: string|null }`
Le joueur choisit lui-même un titre **parmi ceux qu'il possède** (`ownedTitles`), ou conserve son titre porté.
`title` vide/`null` → retire le titre. `403` si titre non débloqué. → `200 { login, title }`.

### `POST /me/consent` — auth — `ConsentSchema` `{ accept: boolean }`
Enregistre (preuve = date + version) ou refuse le consentement CGU. Sur **refus** : compte vierge → suppression
sèche, sinon anonymisation ; refusé pour un SUPERADMIN (400). → `200 { ok, accepted, deleted? }`.

### `PATCH /me/games` — auth — `{ games: GameId[] }`
Adhésion aux modes de jeu (onboarding/réglages). Valeurs : `babyfoot`/`smash`/`chess`/`streetfighter`/`flechettes`.
Liste vide → `400`. Pose `onboardedAt`. → `200 { games, onboardedAt }`. **Emit** `leaderboard:update` → soi.

### `PATCH /me/favorites` — auth — `FavoritesUpdateSchema` `{ smash?, streetfighter? }`
Personnages favoris (« mains ») par jeu de combat. PATCH partiel, dédup. → `200 { favSmash, favSf }`. **Emit** `leaderboard:update` → soi.

### `GET /me/export` — auth — RGPD Art. 20 (portabilité)
Exporte toutes les données perso de l'appelant. Header `Content-Disposition: attachment`.
→ `200 { exportDate, profile, matchHistory, challenges, tournaments, featureRequests, ops }`.

### `DELETE /me/account` — auth — RGPD Art. 17 (effacement)
**Programme** la suppression : pose `deletionScheduledAt = now` (le compte n'est PAS effacé tout de suite).
Le compte disparaît aussitôt des listings, mais **se reconnecter avant l'échéance annule la suppression**
(`getOrCreateUser` remet `deletionScheduledAt` à null). Un job quotidien anonymise les comptes échus
après `ACCOUNT_GRACE_DAYS` (défaut **30 j**) : login → `anon_<hash>`, ftId/campus/imageUrl/title vidés,
`anonymizedAt` posé, propagé en cascade via `onUpdate: Cascade`. Refusé pour un SUPERADMIN.
→ `200 { ok: true, graceDays }` / `400` (superadmin).

---

## Utilisateurs & classement

| Route | Auth | Description | Réponse |
|---|---|---|---|
| `GET /users` | auth | Users (hors suppression programmée) triés par ELO desc. | `200 User[]` |
| `GET /users/:login` | auth | Profil + rang + W/L + 50 derniers matchs + badges + palmarès + statut de suivi. `404` aussi si suppression programmée. | `200 { user, rank, wins, losses, recent, badges, palmares, following, followPrefs }` / `404` |
| `GET /leaderboard?game` | auth | Classement **par discipline** (`game`, défaut `babyfoot`) avec rang (hors comptes hors-jeu) + stats projetées du mode. | `200 ({ rank, ...User, ...stats })[]` |
| `GET /teams/leaderboard` | auth | Classement des équipes 2v2 (babyfoot) enrichi + rang. | `200 ({ rank, ... })[]` |
| `GET /team/photos?logins=a,b,c` | auth | Avatars d'un lot de logins (cache). | `200 { photos: { login: url } }` |
| `GET /contributors/stats` | auth | Stats de contribution (GitHub). | `200 { stats }` |
| `GET /locations` | auth | `login → host` des users actuellement loggés sur l'intra (cache 5 min). | `200 { login: host }` |

> **Multi-discipline.** La ligue couvre `babyfoot`, `smash`, `chess`, `streetfighter`, `flechettes` (cf.
> `GameSchema`). Chaque joueur a un ELO + des compteurs par mode ; il n'apparaît dans les classements/stats d'un
> mode que s'il y **adhère** (`PATCH /me/games`). Les endpoints classement/standings filtrent par `?game`.

> **Comptes hors-jeu masqués (`VISIBLE_USER_WHERE`).** `GET /users`, `/leaderboard` et les profils
> excluent les comptes **bannis** (`bannedAt`), **en suppression programmée** (`deletionScheduledAt`)
> ou **anonymisés** (`anonymizedAt`). Ces comptes ne sont pas non plus ciblables (OPS, suivi, ajout en tournoi).
> `following`/`followPrefs` ne sont renseignés que si le visiteur suit ce joueur (et `null` sur son propre profil).

---

## Notifications (centre in-app)

| Route | Auth | Description |
|---|---|---|
| `GET /notifications` | auth | 40 dernières notifs + compteur non lues. → `200 { notifications, unread }`. |
| `POST /notifications/read` | auth | Marque comme lues : **toutes** par défaut, ou seulement `{ ids: string[] }`. → `200 { ok: true }`. |

> Les notifs sont créées en best-effort par les handlers (`notify`/`notifyMany`) et poussent l'événement
> SSE `notification` (ciblé) pour rafraîchir la cloche. Le front poll aussi `/notifications` en secours.

---

## Saisons

> **Permissions durcies → `requireSuperAdmin`** sur toutes les mutations de saison (création/bascule/suppression)
> et sur la synchro ELO. Les lectures restent en `auth`.

| Route | Auth | Description |
|---|---|---|
| `GET /seasons` | auth | Toutes les saisons (récentes d'abord). → `200 Season[]`. |
| `GET /seasons/current` | auth | Saison active (ou `null`). → `200 Season \| null`. |
| `GET /seasons/:id/standings?game` | auth | Classement figé d'une saison **par discipline** (`game`, défaut `babyfoot`). → `200 SeasonStanding[]`. |
| `POST /seasons` | `requireSuperAdmin` — `CreateSeasonSchema` `{ name (2–40) }` | Démarre une nouvelle saison. S'il y a une saison active, elle est **clôturée dans la même transaction** : snapshot du classement **par discipline** (`SeasonStanding`), badge `season_champion` au n°1 de chaque mode, **reset de tous les ELO au plancher du grade courant** (`seasonResetElo`, pas un plat 1000 ; Étains remontés au plancher Bronze) + compteurs de matchs à 0 (historique conservé, taggé par saison). → `201 Season & { previous }`. **Broadcast** `data:update` + `leaderboard:update`. |
| `POST /seasons/:id/activate` | `requireSuperAdmin` | **Bascule de vue** : cible cette saison (`isActive=true`, `endedAt=null`) et désactive toute autre saison active, sans reset ELO ni snapshot. `404` si absente. → `200 Season`. **Broadcast** `data:update` + `leaderboard:update`. |
| `POST /admin/seasons/sync-elo-from-prod` | `requireSuperAdmin` — **staging only** | Recopie l'**ELO + compteurs** (par discipline) de la **prod** (lecture seule via `PROD_READONLY_URL`) vers staging. Jamais les rôles/permissions/coins/historique. Met à jour les comptes existants, crée ceux absents (rôle USER), saute les collisions. `403` hors staging (`APP_ENV`), `503` si `PROD_READONLY_URL` absent. → `200 { updated, created, skipped }`. Loggée `SYNC_ELO_FROM_PROD`. **Broadcast** `data:update` + `leaderboard:update`. |
| `DELETE /seasons/:id` | `requireSuperAdmin` | Supprime une saison : retire son classement figé, re-pointe ou retire les badges champion liés, détague ses matchs (`seasonId → null`, matchs conservés). **`409` si c'est la saison active** (activer d'abord une autre saison). `404` si absente. IRRÉVERSIBLE (ne restaure pas les ELO). → `200 { deleted: true }`. **Broadcast** `data:update` + `leaderboard:update`. |

---

## Suivi (followers / following)

| Route | Auth | Description |
|---|---|---|
| `GET /follows` | auth | Joueurs que je suis (+ infos + mes préférences). → `200 Follow[]`. |
| `POST /follows` | auth — `{ login }` | Suivre un joueur. Refuse auto-suivi (400) et cible hors-jeu (403). Idempotent (upsert). → `201`. |
| `DELETE /follows/:login` | auth | Ne plus suivre. → `200 { ok: true }`. |
| `PATCH /follows/:login` | auth — `FollowPrefsSchema` | Met à jour les préférences de notif (`notifyTournament`/`notifyTop3`/`notifyTrophy`/`notifyOps`). `404` si non suivi. → `200 Follow`. |

> Les préférences pilotent `notifyFollowers` : un abonné n'est notifié (`follow_top3`, `follow_ops`,
> `follow_tournament`…) que si la préférence correspondante est `true`. L'entrée top 3 ne notifie qu'à
> la **transition** (un joueur qui *entre* dans le top 3).

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

### `POST /matches/:id/cancel` — auth
Le **déclarant** annule sa propre déclaration tant qu'elle est `pending`. Introuvable → `404` ;
pas le déclarant → `403`. Supprime le `PendingMatch`.
→ `200 { id, status: 'cancelled' }`. **Emit** `match:cancelled` → adversaire.

> **`game` sur les matchs 1v1.** `DeclareMatchSchema`/`ConfirmMatchSchema`/`RecordResultSchema` portent un champ
> `game` (défaut `babyfoot`) ; l'ELO et la validation de score s'appliquent à la discipline visée.

### Matchs par équipe / multijoueur (2v2, FFA, fléchettes)

| Route | Auth | Description |
|---|---|---|
| `POST /matches/2v2` | auth — `Declare2v2MatchSchema` | Déclare un match babyfoot 2v2 (4 joueurs). Crée un `PendingMatch` à confirmer. → `201 { id, status: 'pending' }`. |
| `GET /matches/ffa` / `GET /matches/ffa/pending` | auth | Matchs **free-for-all** joués / en attente. |
| `POST /matches/ffa` | auth — `DeclareFfaSchema` | Déclare un FFA (classement de positions). → `201 { id, status: 'pending' }`. **Emit** `ffa:pending`. |
| `POST /matches/ffa/:id/confirm` | auth — `ConfirmFfaPositionSchema` | Chaque participant valide sa position ; FFA résolu quand tous ont confirmé. → `{ id, status, confirmed, total }`. **Emit** `ffa:progress`/`ffa:confirmed`. |
| `POST /matches/ffa/:id/contest` | auth — `ContestFfaSchema` | Conteste le classement (annule le FFA). **Emit** `ffa:contested`/`ffa:cancelled`. |
| `POST /matches/ffa/:id/cancel` | auth | Le déclarant annule. **Emit** `ffa:cancelled`. |
| `GET /matches/darts` / `GET /matches/darts/pending` | auth | Matchs **fléchettes** joués / en attente. |
| `POST /matches/darts` | auth — `DeclareDartsSchema` | Déclare un match fléchettes. **Emit** `darts:pending`. |
| `POST /matches/darts/:id/confirm` | auth — `ConfirmDartsSchema` | Confirmation multipartite. **Emit** `darts:progress`/`darts:confirmed`. |
| `POST /matches/darts/:id/contest` | auth — `ContestDartsSchema` | Conteste / annule. **Emit** `darts:contested`/`darts:cancelled`. |
| `POST /matches/darts/:id/cancel` | auth | Le déclarant annule. **Emit** `darts:cancelled`. |

---

## File d'attente (matchmaking)

| Route | Auth | Description |
|---|---|---|
| `POST /queue/join` | auth — `{ game }` | Rejoint la file d'une discipline. Apparie atomiquement avec le plus ancien autre joueur de ce mode → crée un **défi déjà `accepted`** entre les deux. `assertNotBanned`. → `200 { matched: false }` ou `{ matched: true, game, opponent }`. Notifie + **emit** `challenge:received` + notif `matchmaking` aux 2 joueurs. |
| `POST /queue/leave` | auth — `{ game? }` | Quitte une file (`game` fourni) ou **toutes** mes files (cleanup logout). → `200 { ok: true }`. |
| `GET /queue/status` | auth | Files où je suis en attente + appariements récents (lus une seule fois). → `200 { queued, matches }`. |

---

## Défis (challenges)

> **Défis 2v2.** `POST /challenges/2v2` (`CreateChallenge2v2Schema`) crée un défi babyfoot par équipes ;
> sa résolution (`/challenges/:id/record`) crée un `PendingMatch` 2v2. Les défis 1v1 portent aussi un champ `game`.

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
| `GET /tournaments` | auth | Liste filtrée : un **tournoi privé** n'apparaît qu'à son créateur/invités/admin ; un **amical terminé/annulé** n'apparaît qu'à ses participants/admin (les officiels et tout ce qui est vivant restent visibles). |
| `GET /tournaments/:id` | auth | Détail + entries + bracket/poules (`matches`). `404` si absent **ou** privé non autorisé. |
| `POST /tournaments` | auth + `isAdmin` si `kind=official` | `CreateTournamentSchema` `{ name(2–60), capacity(8–64, puissance de 2), kind, format('elimination'\|'pools'), game(défaut babyfoot), private, imageUrl?(http(s)), prize?(officiel uniquement) }`. `pools` exige `capacity ≥ 12`. Organisateur auto-inscrit. → `201 Tournament`. |
| `POST /tournaments/:id/join` | auth | `registration` only ; **tournoi privé → 403** (sur invitation) ; refus si plein/déjà inscrit (409). Auto-start si plein (génère bracket **ou** poules selon `format`). Notifie les abonnés (`follow_tournament`). |
| `POST /tournaments/:id/add-player` | auth (organisateur **ou** `isAdmin`) | Ajoute un joueur existant. `AddTournamentPlayerSchema` `{ login }`. `registration` only (409) ; joueur introuvable / hors-jeu (404) ; déjà inscrit / complet (409). Dernière place → auto-start. → `200 { id, added, status }`. |
| `POST /tournaments/:id/invite` | auth (organisateur **ou** `isAdmin`) | Invite un joueur (idempotent ; re-pending après refus). `{ login }`. `403` non autorisé ; `404` joueur hors-jeu ; `409` pas en inscription / déjà inscrit / complet. → `201 TournamentInvite`. Notif + **emit** `tournament:invite` → invité. |
| `POST /tournaments/:id/invites/:inviteId/accept` | auth (invité) | Accepte → inscrit (auto-start si plein). `403` pas le destinataire ; `409` invitation non pending / pas en inscription / complet. → `200 { id, inviteId, status }`. |
| `POST /tournaments/:id/invites/:inviteId/decline` | auth (invité) | Refuse l'invitation. → `200 { id, inviteId, status: 'declined' }`. **Emit** `tournament:invite_declined` → inviteur. |
| `POST /tournaments/:id/leave` | auth | `registration` only. |
| `POST /tournaments/:id/start` | auth (organisateur) | Doit être plein (409). Génère le bracket ou les poules. |
| `POST /tournaments/:id/cancel` | auth (organisateur **ou** `isAdmin`) | **Supprime** le tournoi (cascade entries+matchs) — pas de statut « annulé », il disparaît des listes. Rembourse les paris ouverts. |
| `POST /tournaments/:id/matches/:matchId/record` | auth (participant) | `TournamentRecordSchema` `{ scoreA, scoreB }` (validé par discipline). Pose `betsLockedAt` à la 1re saisie (ferme les paris). → `{ id, status: 'pending_confirmation' }`. |
| `POST /tournaments/:id/matches/:matchId/confirm` | auth (participant, ≠ recorder) | Scores ≠ → reset + 409. Propagation partagée (`settleConfirmedTournamentMatch`) : règle les **paris**, match de **poule** → bracket des qualifiés (top 2/poule) quand toutes finies, match de **bracket** → avance le vainqueur ; finale → `finished` + `tournamentsWon++` + récompense. |
| `POST /tournaments/:id/matches/:matchId/reject` | auth (participant) | Reset des scores saisis. |
| `POST /tournaments/:id/matches/:matchId/toss` | auth (participant **ou** officiant) | **Pile-ou-face** d'avant-duel (bracket only), résultat figé en base et partagé. `400` si déjà tiré. → `TournamentMatch`. |
| `POST /tournaments/:id/matches/:matchId/advantage` | auth (gagnant du toss) | `TournamentAdvantageSchema` `{ pick }`. Le gagnant du toss choisit son avantage (option propre au jeu, validée). `403` si pas le gagnant ; `400` déjà choisi / option invalide. → `TournamentMatch`. |
| `POST /tournaments/:id/matches/:matchId/announce` | auth (organisateur **ou** `isAdmin`) | « **Match suivant** » : pose `activeMatchId` → déclenche l'écran VERSUS. Bracket only, tournoi `in_progress`, **interdit aux échecs** (matchs en parallèle). → tournoi MAJ. |

Toutes les mutations `/tournaments*` déclenchent un **broadcast** `tournament:update` (middleware).
Génération des brackets (avec **byes** si pas une puissance de 2) et des poules : `apps/backend/src/tournament.ts`.

---

## Économie de coins : boutique, quêtes, paris

> Porte-monnaie unique `User.leagueCoins` (exposé par `GET /me` et chaque endpoint ci-dessous), alimenté par
> trois sources, toutes créditées/débitées via `grantCoinsTx` **dans une transaction** (jamais de solde négatif :
> bornage à 0, et les débits vérifient le solde en amont).
> - **Volet A — gains de match** : à chaque match **classé**, prime de participation **20** coins, ou **50** pour
>   le vainqueur (remplace la participation). Coins et progression de quête sont **dégressifs** sur les rematchs
>   anti-farming (un rematch dégressé ne fait pas avancer les quêtes).
> - **Volet B — quêtes hebdomadaires** (`/quests`).
> - **Volet C — paris** (`/bets`) : cote fixe ×2 (un pari gagnant rapporte 2× la mise).
>
> Toutes les mutations coins/inventaire émettent **`panel:update`** ciblé au(x) joueur(s) concerné(s) pour
> rafraîchir le solde en direct.

### Boutique

| Route | Auth | Description |
|---|---|---|
| `GET /shop` | auth | Solde + catalogue actif + objets possédés. → `200 { coins, items, owned: itemId[] }`. |
| `POST /shop/:id/buy` | auth | Achète un objet. Re-vérifie solde & possession **en transaction** (anti double-achat). `404` objet introuvable/inactif ; `409` déjà possédé ; `400` solde insuffisant. → `200 { ok, coins }`. **Emit** `panel:update` → soi. |
| `GET /me/inventory` | auth | Inventaire détaillé du joueur (objet + état équipé). → `200 ({ itemId, item, equipped, acquiredAt })[]`. |
| `POST /me/inventory/:id/equip` | auth — `EquipSchema` `{ equipped: boolean }` | (Dé)équipe un objet possédé. **Au plus un objet équipé par catégorie** (titre/bannière/badge) ; un **titre** équipé est reflété dans `user.title`. `404` si non possédé. → `200 { ok }`. **Emit** `panel:update` → soi. |

> **Catégories** : `title` / `banner` / `badge`. *(Les cosmétiques de récompense de tournoi peuvent être créés
> inline et `active:false` → non achetables en boutique.)* Le `payload` est validé contre la catégorie à la
> création **et revalidé au PATCH** (bannière = data-URL image ≤ ~700 Ko ; badge = `code` + `label`).

### Quêtes hebdomadaires (volet B)

Source de vérité serveur : 4 quêtes évaluées à la volée depuis les compteurs de la **semaine ISO** courante
(`WeeklyQuestProgress`, partition par `weekKey` « 2026-W23 » → reset implicite chaque semaine).

| Quête | Récompense | Objectif |
|---|---|---|
| `two_modes` | 200 | jouer **2 disciplines distinctes** |
| `all_modes` | 300 | jouer **toutes les disciplines** |
| `play_5` | 150 | **5 matchs** joués |
| `win_3` | 200 | **3 victoires** |

| Route | Auth | Description |
|---|---|---|
| `GET /quests` | auth | État des quêtes de la semaine. → `200 { weekKey, coins, quests: ({ id, reward, target, progress, claimed, claimable })[] }`. |
| `POST /quests/:id/claim` | auth | Réclame la récompense d'une quête terminée. `404` quête inconnue ; `409` non terminée **ou** déjà réclamée. **Verrou de ligne `FOR UPDATE`** (anti double-claim concurrent). Crédite `reward`. → `200 { id, reward, coins }`. **Emit** `panel:update` → soi. |

### Paris (volet C)

On parie **uniquement sur le VAINQUEUR d'un tournoi** (les paris match par match ont été retirés ; `targetType`
reste le littéral `'tournament'`). Marché **ouvert au tout début seulement** : tournoi `in_progress`, vainqueur
inconnu, et **avant le premier match confirmé** (dès qu'un résultat est confirmé / un score saisi, `betsLockedAt`
ferme le marché). Le pari est **verrouillé à la pose** (aucune modification possible).

| Route | Auth | Description |
|---|---|---|
| `GET /bets` | auth | Solde + mes paris (avec tournoi/jeu/statut/payout) + tournois actuellement **ouverts aux paris**. → `200 { coins, myBets, openTournaments }`. |
| `POST /bets` | auth — `PlaceBetSchema` `{ targetType: 'tournament', tournamentId, choiceLogin, stake (int>0) }` | Pose un pari. Débit de la mise **en transaction** (solde vérifié AVANT). `404` tournoi/utilisateur introuvable ; `409` paris fermés (pas `in_progress` / déjà commencé) ; `403` si je participe au tournoi ; `400` si le pronostic n'est pas un participant ; `409` **un seul pari ouvert par tournoi** ; `409` solde insuffisant. → `201 { bet, coins }`. **Emit** `panel:update` → soi. |

**Résolution / remboursement** (effets internes, pas d'endpoint dédié) :
- **Règlement** à la confirmation/forçage du match qui désigne le vainqueur du tournoi : cote ×2 aux bons
  pronostics, perdu sinon (`status` `won`/`lost`, `payout`, `settledAt`). Les parieurs **gagnants** reçoivent
  `panel:update` (solde crédité).
- **Remboursement intégral** (`status: 'refunded'`) des paris encore ouverts **avant toute suppression** de
  tournoi (suppression admin, annulation, purge de compte, suppression d'un faux joueur), pour ne pas perdre la
  mise au cascade. Les remboursés reçoivent `panel:update`.

> **GOAT.** Il n'existe **aucun endpoint GOAT** : le classement « GOAT » est **calculé entièrement côté front**
> (`web/src/lib/goat.ts`, `computeGoat`/`GOAT_WEIGHTS`) à partir du `/leaderboard` et de l'historique des matchs ;
> le scope saison est dérivé des données déjà servies par les endpoints existants.

---

## Ops (vantardise)

| Route | Auth | Description |
|---|---|---|
| `GET /ops` | — (public) | Tous les ops actifs (`expiresAt > now`). |
| `GET /ops/me` | auth | `{ current, targetedBy, canDeclareAt }`. |
| `GET /ops/user/:login` | — (public) | `{ owns, targetedBy }` d'un user. |
| `POST /ops` | auth — `DeclareOpsSchema` | `{ targetLogin }`. Refuse : auto-cible (400), cible hors-jeu (403), 1 ops actif/owner, cooldown 7 j actif, cible déjà engagée (409). Crée un ops **24 h**. **Emit** `ops:update` → [owner, target] ; notif `ops_targeted` à la cible + `follow_ops` aux abonnés. → `201 Ops`. |

> **OPS « chasse » (refonte mai 2026).** Pendant les 24 h, la cible doit affronter le traqueur :
> ses **3 premiers défis forcés** (`forcedUsed < OPS_FORCED_MATCHES`) ne peuvent être refusés sans
> surcoût. Refuser un de ces défis coûte **3× la perte d'ELO** d'une défaite estimée
> (`OPS_REFUSE_MULTIPLIER × estimatedEloLoss`) au lieu du dodge classique (−10), et incrémente
> `forcedUsed`. Constantes partagées dans `@42-league/shared` (`elo.ts`). Voir [DOMAIN.md §7](./DOMAIN.md).

---

## Feature requests

| Route | Auth | Description |
|---|---|---|
| `POST /feature-requests` | auth — `FeatureRequestSchema` | `{ text (10–500) }`. → `201`. |
| `GET /feature-requests` | `requireAdmin` | Toutes les demandes + auteur. |
| `PATCH /feature-requests/:id/status` | `requireAdmin` — `SetFeatureRequestStatusSchema` | `{ status: 'pending'\|'accepted'\|'rejected' }`. |

## Bug reports (boîte à tickets)

| Route | Auth | Description |
|---|---|---|
| `POST /bug-reports` | auth — `BugReportSchema` | `{ text (10–500) }`. → `201`. |
| `GET /bug-reports` | `requireAdmin` | Tous les tickets + auteur. |
| `PATCH /bug-reports/:id/status` | `requireAdmin` — `SetBugReportStatusSchema` | `{ status: 'open'\|'resolved'\|'closed' }`. |

---

## Admin

> Toutes les mutations sous `/admin/*` déclenchent un **broadcast** `data:update` (middleware).
> Les actions sensibles sont tracées via `logAdminAction` (voir [SECURITY.md §1](./SECURITY.md)).
>
> **Délégation aux modérateurs.** Plusieurs routes listées « `requireAdmin` » ci-dessous utilisent en réalité
> `requirePerm(login, <perm>)` : un `MODERATOR` les obtient s'il a la permission granulaire correspondante
> (`canEditStats`, `canBan`, `canDeleteMatches`, `canEditMatches`, `canDeleteRejectedMatches`,
> `canDeletePendingMatches`, `canDeleteChallenges`, `canDeleteOps`, `canDeleteTournaments`, `canViewSuspicious`,
> `canViewAuditLog`, `canViewHistory`). Les `ADMIN`/`SUPERADMIN` les ont toutes.

| Route | Auth | Action loggée | Description |
|---|---|---|---|
| `POST /admin/users/:login/title` | `isAdmin` | `EDIT_TITLE` | `SetTitleSchema` `{ title: string\|null (≤40) }`. |
| `POST /admin/users/:login/role` | `requireSuperAdmin` | `SET_ROLE` | `SetRoleSchema` `{ role: 'USER'\|'MODERATOR'\|'ADMIN' }` (`SUPERADMIN` non assignable). Cible SUPERADMIN immuable (400). |
| `POST /admin/users/:login/staging-access` | `requireSuperAdmin` | `SET_ROLE` | `{ grant: boolean }`. Modifie **uniquement** le flag `stagingAllowed` (le rôle DB est préservé). SUPERADMIN immuable (400). → `{ login, role, stagingAllowed }`. |
| `PATCH /admin/users/:login/moderator-permissions` | `requireAdmin` | `SET_MODERATOR_PERMISSIONS` | Liste blanche stricte de booléens (`canBan`, `canDeleteMatches`, `canDeleteTournaments`, `canViewSuspicious`, …). Cible doit être un `MODERATOR` (400 sinon) ; SUPERADMIN immuable (400). → `{ login, moderatorPermissions }`. |
| `POST /admin/impersonate-tester` | `requireAdmin` — **staging only** | `IMPERSONATE_TESTER` | Délivre un token d'auth du compte de test générique `tester` (rôle USER). `403` hors staging. → `{ token, login }`. |
| `POST /admin/impersonate-fresh-tester` | `requireAdmin` — **staging only** | `IMPERSONATE_TESTER` | Crée un compte `tester-…` tout neuf (onboarding à rejouer) et délivre son token. `403` hors staging. → `{ token, login }`. |
| `GET /admin/rate-limit/me` | `requireAdmin` | — | État du rate-limit de l'appelant. |
| `DELETE /admin/rate-limit/me` | `requireAdmin` | — | Réinitialise les compteurs de rate-limit de l'appelant. |
| `GET /admin/users` | `requireAdmin` | — | Tous les users (rôle, stats, ban). |
| `PATCH /admin/users/:login/stats` | `requireAdmin` | `EDIT_STATS` | `{ elo?, matchesPlayed?, dodgeCount?, tournamentsWon? }` (int ≥ 0). |
| `POST /admin/users/:login/ban` | `requireAdmin` | `BAN_USER` | Pose `bannedAt`. Refuse un SUPERADMIN (400). |
| `POST /admin/users/:login/unban` | `requireAdmin` | `UNBAN_USER` | Vide `bannedAt`. |
| `GET /admin/users/:login/moderation` | `requireAdmin` | — | `{ user, recentMatches, topOpponents, rejectionsEmitted, rejectionsReceived }`. |
| `DELETE /admin/matches/:id` | `requireAdmin` | `DELETE_MATCH` | Supprime un match (réverse l'ELO si compté). |
| `PATCH /admin/matches/:id` | `requireAdmin` | `EDIT_MATCH` | `{ scoreA, scoreB }` ; recalcule le vainqueur. |
| `GET /admin/rejected-matches` | `requireAdmin` | — | 200 derniers litiges. |
| `DELETE /admin/rejected-matches/:id` | `requireAdmin` | `DELETE_REJECTED_MATCH` | Supprime un litige. → `{ id, deleted }`. |
| `DELETE /admin/pending-matches/:id` | `requireAdmin` | `DELETE_PENDING_MATCH` | Supprime un match en attente. **Emit** `match:cancelled` → 2 joueurs. |
| `DELETE /admin/challenges/:id` | `requireAdmin` | `DELETE_CHALLENGE` | Supprime un défi. |
| `DELETE /admin/ops/:id` | `requireAdmin` | `DELETE_OPS` | Supprime un ops. **Emit** `ops:update` → [owner, target]. |
| `DELETE /admin/tournaments/:id` | `canDeleteTournaments` | `DELETE_TOURNAMENT` | Supprime un tournoi (n'importe quel statut) ; si terminé, **décrémente** `tournamentsWon` du vainqueur (par discipline). **Rembourse les paris ouverts** avant le cascade ; nettoie un éventuel cosmétique de récompense orphelin. **Broadcast** `tournament:update`. → `{ id, deleted: true }`. |
| `GET /admin/all-history?login&type&limit` | `requireAdmin` | — | Historique unifié (défis, pending, joués, rejets, ops) en événements typés. Filtres `login` / `type` (`challenge`\|`pending_match`\|`played_match`\|`rejected_match`\|`ops`) ; `limit` max 1000. |
| `GET /admin/suspicious` | `requireAdmin` | — | Détection anti-triche (voir ci-dessous). |
| `GET /admin/audit-log?actor&target&action&limit` | `requireAdmin` | — | Journal filtrable (max 500). |
| `POST /admin/refresh-images` | ⚠️ **aucune garde** | — | Déclenche un backfill des avatars manquants. → `{ scheduled: n }`. *(à durcir : pas de check admin)* |

#### Actions SUPERADMIN (gestion forte de la ligue)

> Toutes gardées par `requireSuperAdmin`. Comme les autres `/admin/*`, elles déclenchent le broadcast
> `data:update` (middleware) et sont tracées dans l'audit log.

| Route | Action loggée | Description |
|---|---|---|
| `POST /admin/matches/:id/force-confirm` | `EDIT_MATCH` | Valide d'autorité un `PendingMatch` (l'adversaire ne confirme jamais) → `PlayedMatch` + ELO appliqué. `404` si absent. **Emit** `match:confirmed` → 2 joueurs ; **broadcast** `leaderboard:update`. → `200 PlayedMatch`. |
| `POST /admin/matches/:id/force-cancel` | `DELETE_MATCH` | Supprime un `PendingMatch` sans toucher à l'ELO. `404` si absent. **Emit** `match:expired` → 2 joueurs. → `200 { id, status: 'cancelled' }`. |
| `POST /admin/matches/force-result` | `EDIT_MATCH` | Injecte un résultat directement (faux **ou** vrais joueurs, sans confirmation). `AdminForceResultSchema` `{ playerA, playerB, scoreA, scoreB (0–50) }` (joueurs ≠, scores ≠). Ordre canonique appliqué, ELO calculé. `404` si un joueur manque. **Emit** `match:confirmed` ; **broadcast** `leaderboard:update`. → `200 PlayedMatch`. |
| `POST /admin/users` | `EDIT_STATS` | Crée un **faux joueur** (sans `ftId`). `AdminCreateUserSchema` `{ login (2–20, `[A-Za-z0-9_-]`), campus?, elo? (0–5000, défaut 1000) }`. `409` si le login existe. **Broadcast** `leaderboard:update`. → `200 User`. |
| `DELETE /admin/users/:login` | `EDIT_STATS` | Suppression **définitive** d'un **faux compte uniquement** (`ftId === null`). Refuse un SUPERADMIN (403) ou un compte réel passé par OAuth (403) ; `404` si absent. Nettoie en cascade matchs/défis/ops/rejets/feature-requests/tournois. **Broadcast** `leaderboard:update`. → `200 { login, deleted: true }`. |
| `POST /admin/reset-database` | `RESET_DATABASE` | **Reset total** de la ligue (irréversible). Body `{ confirm }` = phrase exacte `oui je suis sure de ce que je fais` (400 sinon). Efface tout l'historique (matchs/défis/ops/rejets/tournois), supprime les comptes en suppression/anonymisés (sauf SUPERADMIN), remet les autres à zéro (elo 1000, compteurs 0, titre null). **Broadcast** `leaderboard:update`. → `200 { reset: true, removedUsers, resetUsers }`. |

#### GOD — gestion d'un tournoi (panneau `/god`)

> Routes gardées par `requireAdmin` (sauf mention). La plupart sont tracées dans l'audit log sous l'action
> `EDIT_MATCH` avec un champ `forced` décrivant l'opération. Toutes **broadcast** `tournament:update`.

| Route | Auth | Description |
|---|---|---|
| `POST /admin/tournaments/:id/invites/:inviteId/force-accept` | `requireAdmin` | **Force l'acceptation** d'une invitation : le joueur invité est inscrit d'office (idempotent). **Auto-start** si la capacité est atteinte (même chemin que `/accept`). `404` invitation/tournoi absent ; `409` plus en inscription. Notif `tournament` à l'invité. → `200 { id, inviteId, status: 'accepted', started }`. |
| `POST /admin/tournaments/:id/matches/:matchId/force-result` | `requireAdmin` **OU** organisateur d'un tournoi **amical** — `TournamentForceResultSchema` `{ scoreA, scoreB }` | **Force le résultat** d'un match (sans confirmation des joueurs) : pose score + gagnant + `confirmedAt` (+ `betsLockedAt`), puis applique **exactement la même propagation que `/confirm`** (`settleConfirmedTournamentMatch` : règlement des paris, avance du bracket, finale → `tournamentsWon++` + récompense, génération du bracket des qualifiés en fin de poules). Score validé selon la discipline. `404` match absent ; `409` déjà confirmé / sans joueurs ; `400` score invalide. → `200 { id, winnerLogin, finished, bracketGenerated }`. Émits APRÈS commit (calqués sur `/confirm` : `panel:update` au vainqueur récompensé + aux parieurs gagnants). |
| `POST /admin/tournaments/:id/invites/:inviteId/cancel` | `requireAdmin` | Retire une invitation en attente. `404` si absente. → `200 { id, inviteId, cancelled: true }`. |
| `POST /admin/tournaments/:id/entries/:login/remove` | `requireAdmin` | Retire un participant inscrit. **Inscription uniquement** (`409` si lancé — retirer d'un bracket le corromprait). `404` si absent. → `200 { id, removed }`. |
| `POST /admin/tournaments/:id/players` | `requireAdmin` — `AddTournamentPlayerSchema` `{ login }` | Ajoute directement un joueur (inscription only ; auto-start si plein). `404` tournoi/joueur (hors-jeu) ; `409` pas en inscription / déjà inscrit / complet. → `200 { id, added, status }`. |
| `POST /admin/tournaments/:id/start` | `requireAdmin` | **Force le lancement** d'un tournoi en inscription, même incomplet (`≥ 2` joueurs ; le bracket gère les byes ; poules → `≥ 12`). → `200 { id, started: true, players }`. |
| `PATCH /admin/tournaments/:id` | `requireAdmin` — `AdminUpdateTournamentSchema` | Édite les paramètres : `name`/`kind`/`isPrivate` à tout moment ; `capacity`/`format` **uniquement en inscription** (`409` sinon, ou si capacité < inscrits, ou poules < 12). `capacity` = puissance de 2 (8/16/32/64). → `200 { id, updated: true }`. |

> **Propagation partagée.** `/admin/tournaments/:id/matches/:matchId/force-result` et la route joueur
> `/tournaments/:id/matches/:matchId/confirm` appellent le **même** `settleConfirmedTournamentMatch` → comportement
> identique (paris, bracket, finale, récompense). De même, `force-accept` et `/players` réutilisent le chemin
> d'auto-start standard.

#### Coins & boutique (administration)

> Gardées par `requireAdmin`. Crédits/inventaire émettent **`panel:update`** au joueur ciblé.

| Route | Auth | Description |
|---|---|---|
| `GET /admin/shop/items` | `requireAdmin` | Catalogue complet (objets inactifs inclus). |
| `POST /admin/shop/items` | `requireAdmin` — `ShopItemCreateSchema` | Crée un objet (validation `payload`↔catégorie). |
| `PATCH /admin/shop/items/:id` | `requireAdmin` — `ShopItemUpdateSchema` | MAJ partielle ; **revalide `payload`↔catégorie** si les deux sont fournis. |
| `DELETE /admin/shop/items/:id` | `requireAdmin` | Supprime un objet (cascade inventaire). → `{ ok: true }`. |
| `POST /admin/shop/grant` | `requireAdmin` — `ShopGrantSchema` `{ login, amount (int, peut être négatif) }` | Crédite/débite des League Coins (solde borné à ≥ 0). `404` si joueur absent. → `{ ok, login, coins }`. **Emit** `panel:update` → cible. |
| `POST /admin/shop/grant-item` | `requireAdmin` — `ShopGrantItemSchema` `{ login, itemId, equip? }` | Donne un cosmétique (inventaire, sans doublon) avec auto-équipement optionnel. `404` joueur/objet absent. → `{ ok, login, itemId, equipped }`. **Emit** `panel:update` → cible. |

### `GET /admin/suspicious` — flags anti-triche
Renvoie une liste de drapeaux triés par sévérité. Types détectés :
- **pair_domination** : un joueur gagne ≥75 % de ≥5 matchs contre un même adversaire.
- **recent_farming** : une paire joue ≥15 matchs en 7 jours.
- **victim_pattern** : un joueur avec WR global ≥35 % perd ≥80 % contre un adversaire précis.
- **elo_spike** : gain d'ELO > 2σ+80 sur 30 jours (≥5 matchs).

---

## Temps réel

### `GET /events` — `getStreamLogin` (accepte `?token=` éphémère scope `sse`)
Flux **Server-Sent Events** (`text/event-stream`). Le `?token=` doit être un token de stream obtenu
via `GET /auth/stream-token` (TTL 60 s) — pas le Bearer. Voir [REALTIME.md](./REALTIME.md) pour le détail.
- Événement initial `connected` ; ping keep-alive toutes les 25 s.
- Événements ciblés : `match:*` (dont `match:cancelled`), `challenge:*`, `ffa:*`, `darts:*`, `ops:update`,
  `tournament:invite`, `tournament:invite_declined`, `matchmaking`, `notification`, **`panel:update`** (coins /
  inventaire / paris — ciblé au(x) joueur(s) concerné(s)).
- Événements globaux (broadcast) : `leaderboard:update`, `tournament:update`, `data:update`.

> Les variations de **solde / paris** (gain de match, claim de quête, achat/équipement, débit de mise, règlement
> ou remboursement de pari) ne créent pas un nouveau type d'event : elles poussent **`panel:update`** ciblé pour
> rafraîchir le solde. L'**`activeMatchId`** d'un tournoi (« match suivant » annoncé) est porté par
> `tournament:update` (broadcast) — pas d'event dédié.

---

## Récapitulatif des événements SSE émis

| Événement | Déclencheur | Cible |
|---|---|---|
| `match:pending` | `POST /matches` | adversaire |
| `match:confirmed` | `POST /matches/:id/confirm`, `/admin/matches/:id/force-confirm`, `/admin/matches/force-result` | 2 joueurs |
| `match:rejected` | `POST /matches/:id/reject` | déclarant |
| `match:cancelled` | `POST /matches/:id/cancel`, `DELETE /admin/pending-matches/:id` | adversaire (ou 2 joueurs) |
| `match:expired` | `POST /admin/matches/:id/force-cancel` | 2 joueurs |
| `challenge:received` | `POST /challenges` | adversaire |
| `challenge:accepted` | `POST /challenges/:id/accept` | challenger |
| `challenge:declined` | `POST /challenges/:id/decline` | l'autre partie |
| `challenge:recorded` | `POST /challenges/:id/record` | 2 joueurs |
| `ffa:pending`/`ffa:progress`/`ffa:confirmed`/`ffa:contested`/`ffa:cancelled` | endpoints `/matches/ffa*` | participants |
| `darts:pending`/`darts:progress`/`darts:confirmed`/`darts:contested`/`darts:cancelled` | endpoints `/matches/darts*` | participants |
| `ops:update` | `POST /ops`, `DELETE /admin/ops/:id` + timers expiry/cooldown | [owner, target] |
| `tournament:invite` | `POST /tournaments/:id/invite` | invité |
| `tournament:invite_declined` | `POST /tournaments/:id/invites/:inviteId/decline` | inviteur |
| `matchmaking` | file d'attente (`/queue/*`) : appariement / annulation | joueur(s) concernés |
| `notification` | toute création de notif (`notify`/`notifyMany`) | destinataire(s) |
| `panel:update` | **coins/inventaire/paris** : achat (`/shop/:id/buy`), équip (`/me/inventory/:id/equip`), claim quête (`/quests/:id/claim`), pose de pari (`/bets`), grants admin (`/admin/shop/grant`, `/grant-item`), règlement/remboursement de paris (confirm/force-result/suppression de tournoi), gain de match | joueur(s) concerné(s) |
| `leaderboard:update` | confirm match, dodge/OPS, nouvelle saison/bascule, sync ELO, actions SUPERADMIN, `/me/games`, `/me/favorites` | broadcast (ou ciblé) |
| `tournament:update` | toute mutation `/tournaments*` + routes `/admin/tournaments/*` (force-accept, force-result, cancel/remove/players/start, PATCH, DELETE) ; porte aussi l'`activeMatchId` (« match suivant ») | broadcast |
| `data:update` | mutations `/admin/*`, `/seasons*`, sync ELO | broadcast |
