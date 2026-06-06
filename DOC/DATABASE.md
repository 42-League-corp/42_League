# Base de données — 42 League

Référence exhaustive du schéma Prisma : modèles, champs, relations, enums, migrations,
seed, et les flux de données critiques (matchs, ELO, tournois, ops).

- **SGBD** : PostgreSQL 16 (`postgres:16-alpine`).
- **ORM** : Prisma 5 (`@prisma/client`).
- **Schéma** : `apps/backend/prisma/schema.prisma`.
- **Connexion** : variable `DATABASE_URL`.
- **Client** : généré par `prisma generate` (obligatoire avant typecheck/exécution, sinon les
  types Prisma sont `any` et `tsc` échoue — c'est le piège classique du repo).

> Convention : chaque modèle a un `@@map` vers un nom de table en `snake_case`, et chaque champ
> un `@map` vers une colonne `snake_case`. Le code TypeScript manipule les noms `camelCase`.

> **Multi-jeu.** La ligue couvre **5 disciplines** (`GAME_IDS` dans `packages/shared/src/games.ts`) :
> `babyfoot`, `smash`, `chess`, `streetfighter`, `flechettes`. Chaque joueur possède un ELO et des
> compteurs **par discipline** (champs `elo`, `eloSmash`, `eloChess`, `eloSf`, `eloFlechettes`…).
> Les modèles de match portent un champ `game` (défaut `babyfoot`) ; les disciplines de combat
> (smash/sf) et fléchettes ont des champs supplémentaires (personnages, stocks, score de départ).

---

## 1. Enums

### `Role`
Niveau de permission d'un utilisateur.
| Valeur | Sens |
|---|---|
| `USER` | Défaut à la création. Joueur normal. |
| `MODERATOR` | Modérateur à **permissions granulaires** (`User.moderatorPermissions`, cf. `ModeratorPermission`). N'a accès qu'aux actions explicitement cochées. |
| `ADMIN` | Accès au GOD panel + actions de modération. |
| `SUPERADMIN` | Tout `ADMIN` + gestion des rôles. **Hardcodé** côté serveur (`abidaux`, `throbert`), réimposé à chaque login, jamais attribuable par l'API. |

### `AdminAction`
Type d'action tracée dans l'audit log.
`SET_ROLE`, `SET_MODERATOR_PERMISSIONS`, `BAN_USER`, `UNBAN_USER`, `EDIT_STATS`, `EDIT_TITLE`,
`DELETE_MATCH`, `EDIT_MATCH`, `REFRESH_IMAGES`, `RESET_DATABASE` (reset complet de la ligue par un
SUPERADMIN), puis les actions de modération de l'historique : `DELETE_CHALLENGE`,
`DELETE_PENDING_MATCH`, `DELETE_REJECTED_MATCH`, `DELETE_OPS`, `DELETE_TOURNAMENT` (suppressions
ciblées depuis le GOD panel « All History »), `IMPERSONATE_TESTER` (un admin se connecte en tant
que faux compte de test), `SYNC_ELO_FROM_PROD` (import des ELO depuis la prod vers le staging).

> **`ModeratorPermission` (pas un enum DB).** Liste de permissions granulaires (`MODERATOR_PERMISSIONS`
> dans `index.ts`), stockée en JSON dans `User.moderatorPermissions` : `canBan`, `canEditStats`,
> `canDeleteMatches`, `canEditMatches`, `canDeletePendingMatches`, `canDeleteRejectedMatches`,
> `canDeleteChallenges`, `canDeleteOps`, `canDeleteTournaments`, `canViewSuspicious`,
> `canViewAuditLog`, `canViewHistory`. Un MODERATOR n'est autorisé que si la permission est à `true`.

> **Grades (NON stockés).** Les paliers (`Étain`, `Bronze`, `Argent`, `Or`, `Diamant`, `Grand Master`)
> sont **calculés au runtime** depuis l'ELO et le rang — voir `packages/shared/src/rank.ts`, jamais
> persistés en base. **Grand Master** est un grade **positionnel** (et non un seuil ELO) attribué au
> **top 5** (`GRANDMASTER_TOP_N`) de chaque classement de discipline. Le `floor` de chaque palier sert
> de cible de reset en fin de saison (`seasonResetElo`).

---

## 2. Modèles

### `User` → table `users`
Clé primaire : **`login`** (le login intra 42, pas un id numérique).

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| `login` | String | non | — | `@id`. Identité 42. |
| `ftId` | Int | oui | — | `@unique`. Id intra 42. |
| `campus` | String | oui | — | Campus 42. |
| `firstName` / `lastName` | String | oui | — | Identité réelle issue du profil 42 (le front affiche « prénom nom » et retombe sur le login si absent). |
| `imageUrl` | String | oui | — | Avatar (récupéré en arrière-plan si absent). |
| `title` | String | oui | — | Titre cosmétique (ex. « 👑 Roi du Babyfoot »). |
| `role` | Role | non | `USER` | Permission. |
| `elo` | Int | non | `1000` | Classement ELO **babyfoot**. |
| `matchesPlayed` | Int | non | `0` | Matchs comptés pour l'ELO babyfoot. |
| `dodgeCount` | Int | non | `0` | Nombre de désistements sur défi accepté. |
| `tournamentsWon` | Int | non | `0` | Tournois gagnés (babyfoot). |
| `eloSmash` / `matchesPlayedSmash` / `tournamentsWonSmash` | Int | non | `1000`/`0`/`0` | Classement **Smash Bros** (rating + compteurs distincts). |
| `eloChess` / `matchesPlayedChess` / `tournamentsWonChess` | Int | non | `1000`/`0`/`0` | Classement **Échecs**. |
| `eloSf` / `matchesPlayedSf` / `tournamentsWonSf` | Int | non | `1000`/`0`/`0` | Classement **Street Fighter** (mécaniquement identique au Smash). |
| `eloFlechettes` / `matchesPlayedFlechettes` / `tournamentsWonFlechettes` | Int | non | `1000`/`0`/`0` | Classement **Fléchettes** (multijoueur 301/501, pas de tournoi). |
| `leagueCoins` | Int | non | `0` | Porte-monnaie « League Coin » — solde dépensable en boutique. |
| `games` | String[] | non | `["babyfoot"]` | Modes auxquels le joueur adhère (apparaît dans les stats/classements du mode). |
| `favSmash` / `favSf` | String[] | non | `[]` | Personnages favoris (« mains ») par jeu de combat — ids des rosters front, ordonnés. |
| `onboardedAt` | DateTime | oui | — | A choisi ses modes (1er login). |
| `bannedAt` | DateTime | oui | — | Si renseigné → compte suspendu. |
| `deletionScheduledAt` | DateTime | oui | — | Suppression programmée (RGPD Art. 17). Posée par `DELETE /me/account` ; **se reconnecter avant l'échéance la remet à null** (annule la suppression). Un job quotidien anonymise les comptes échus après `ACCOUNT_GRACE_DAYS` (défaut **30 j**). |
| `anonymizedAt` | DateTime | oui | — | Si renseigné → compte déjà anonymisé (login → `anon_<hash>`, PII purgée). |
| `termsAcceptedAt` | DateTime | oui | — | Preuve du consentement RGPD (CGU API 42). Tant qu'absent / version périmée, la consent-gate refuse tout traitement de données 42 (403). |
| `termsVersion` | String | oui | — | Version de la politique acceptée ; si la politique évolue, le consentement est re-demandé. |
| `stagingAllowed` | Boolean | non | `false` | Accès staging — flag indépendant du rôle (`/admin/users/:login/staging-access`). |
| `moderatorPermissions` | Json | oui | — | Permissions granulaires d'un MODERATOR (null = aucune). Voir `ModeratorPermission`. |
| `createdAt` | DateTime | non | `now()` | Création du compte. |

> **Période de grâce.** Tant que `deletionScheduledAt` est posé mais l'échéance non atteinte, l'utilisateur
> est **exclu** des listings (`GET /users`, `/leaderboard`, profils) mais son compte et son ELO existent
> toujours. Le job quotidien `anonymizeAccount` ne le purge qu'après la fenêtre de grâce ; une
> reconnexion entre-temps le restaure intégralement.

**Relations** (toutes les FK joueur utilisent `onDelete: Restrict`, `onUpdate: Cascade` — on ne
supprime jamais un user référencé ; renommer un login propage en cascade, ce qui sert à
l'anonymisation) :
- `declaredPending` / `awaitingPending` → `PendingMatch` (déclarant / adversaire)
- `pendingAsPartner1` / `pendingAsPartner2` → `PendingMatch` (coéquipiers 2v2)
- `matchesAsA` / `matchesAsB` / `matchesAsA2` / `matchesAsB2` → `PlayedMatch` (les `*2` = seconds joueurs des équipes 2v2)
- `challengesSent` / `challengesReceived` → `Challenge`
- `tournamentsCreated` / `tournamentsWonRel` / `tournamentEntries` / `tournamentMatchesA` / `tournamentMatchesB`
- `tournamentInvitesSent` / `tournamentInvitesReceived` → `TournamentInvite`
- `opsAsOwner` / `opsAsTarget` → `Ops`
- `featureRequests` → `FeatureRequest` ; `bugReports` → `BugReport`
- `rejectedAsDeclarer` / `rejectedAsOpponent` → `RejectedMatch`
- `notifications` → `Notification` (centre de notifications in-app)
- `badges` → `UserBadge` (badges gagnés)
- `following` / `followers` → `Follow` (suivi de joueurs, avec préférences de notif)
- `babyfootTeamsAsP1` / `babyfootTeamsAsP2` → `BabyfootTeam` (duos 2v2)
- `inventory` → `ShopInventory` (cosmétiques possédés)
- `ffaDeclared` / `ffaPendingParticipant` / `ffaPlayedParticipant` → FFA Smash/Fléchettes
- `weeklyQuests` → `WeeklyQuestProgress` ; `bets` → `Bet` (économie de coins)

---

### `PendingMatch` → table `pending_matches`
Match **déclaré mais pas encore confirmé** par l'adversaire. État transitoire.

| Champ | Type | Null | Défaut |
|---|---|---|---|
| `id` | String (uuid) | non | — |
| `declarerLogin` | String | non | — |
| `opponentLogin` | String | non | — |
| `scoreDeclarer` | Int | non | — |
| `scoreOpponent` | Int | non | — |
| `declaredAt` | DateTime | non | `now()` |
| `game` | String | non | `babyfoot` (multi-jeu) |
| `bestOf` | Int | oui | — (smash/sf) |
| `charDeclarer` / `charOpponent` | String | oui | — (personnages combat) |
| `stocks` | Int | oui | — (vies restantes du gagnant au game décisif) |
| `mode` | String | oui | `null` \| `2v2` (Babyfoot) |
| `partner1Login` / `partner2Login` | String | oui | Coéquipier du déclarant / de l'adversaire (2v2). |
| `partner1Confirmed` / `opp1Confirmed` / `opp2Confirmed` | Boolean | oui | `false` — confirmations progressives 2v2 (le déclarant est auto-validé ; settlement quand les 3 autres sont à `true`). |

Index : `(opponentLogin)` — pour lister rapidement « les matchs que je dois confirmer ».
À la confirmation, le `PendingMatch` est **supprimé** et un `PlayedMatch` est créé (ou, en cas
de score incohérent, supprimé sans rien créer).

---

### `PlayedMatch` → table `played_matches`
Match **confirmé**, immuable (sauf édition/suppression admin). Source de vérité du classement.

| Champ | Type | Null | Notes |
|---|---|---|---|
| `id` | String (uuid) | non | Réutilise l'id du pending confirmé. |
| `playerALogin` | String | non | **Ordre canonique** : `A < B` lexicographiquement (`pairKey`). |
| `playerBLogin` | String | non | |
| `scoreA` / `scoreB` | Int | non | Scores dans l'ordre canonique. |
| `winner` | String | non | `'A'` ou `'B'`. |
| `playedAt` | DateTime | non | = `declaredAt` du pending. |
| `countedForElo` | Boolean | non | `false` si bloqué par l'anti-farming. |
| `deltaA` / `deltaB` | Int | non | Variation d'ELO appliquée (0 si non compté). |
| `seasonId` | String | oui | Saison à laquelle appartient ce match (taggé à la confirmation). |
| `game` | String | non | `babyfoot` (multi-jeu). |
| `bestOf` | Int | oui | Smash/SF. |
| `charA` / `charB` | String | oui | Personnages combat. |
| `stocksA` / `stocksB` | Int | oui | Vies restantes. |
| `mode` | String | oui | `null` \| `2v2` (Babyfoot). |
| `playerA2Login` / `playerB2Login` | String | oui | Coéquipiers des équipes A/B (2v2). |
| `deltaA2` / `deltaB2` | Int | oui | Variation d'ELO des coéquipiers (2v2). |
| `teamAId` / `teamBId` | String | oui | FK → `BabyfootTeam` (entités duo, 2v2). |

> **2v2 Babyfoot.** `playerA`/`playerB` restent les « premiers » joueurs (déclarant et adversaire
> canoniques) ; `playerA2`/`playerB2` sont leurs coéquipiers ; `teamA`/`teamB` pointent sur les
> entités `BabyfootTeam`.

Index : `(playerALogin, playerBLogin, playedAt)` — sert au calcul anti-farming (matchs antérieurs
de la paire dans la fenêtre) — et `(seasonId)` pour le bilan de fin de saison. La migration
`add_seasons` rattache tout l'historique existant à la « Saison Bêta ».

> **Pourquoi l'ordre canonique `A < B` ?** Pour qu'une paire {alice, bob} soit toujours stockée
> de la même façon, quel que soit qui a déclaré. Cela simplifie le comptage anti-farming et évite
> les doublons logiques.

---

### `RejectedMatch` → table `rejected_matches`
Trace d'un match **contesté** par l'adversaire (preuve de litige, consultable par les admins).

| Champ | Type | Null | Défaut |
|---|---|---|---|
| `id` | String (uuid) | non | — |
| `declarerLogin` / `opponentLogin` | String | non | — |
| `scoreDeclarer` / `scoreOpponent` | Int | non | — |
| `contestReason` | String | non | `never_played` \| `wrong_score`. |
| `contestMessage` | String | non | Message du contestataire (10–500 car.). |
| `rejectedAt` | DateTime | non | `now()` |

Index : `(declarerLogin)`, `(opponentLogin)`.

---

### `Challenge` → table `challenges`
Un **défi** : proposition de jouer, planifiée dans le temps. Précède éventuellement un match.

| Champ | Type | Null | Défaut |
|---|---|---|---|
| `id` | String (uuid) | non | — |
| `challengerLogin` / `opponentLogin` | String | non | — |
| `status` | String | non | `pending` \| `accepted` \| `declined` \| `recorded` \| `cancelled` |
| `game` | String | non | `babyfoot` (multi-jeu). |
| `scheduledAt` | DateTime | non | Date prévue du match. |
| `createdAt` | DateTime | non | `now()` |
| `decidedAt` | DateTime | oui | Horodatage accept/decline. |
| `mode` | String | oui | `null` \| `2v2` (Babyfoot). |
| `partnerLogin` / `opponentPartnerLogin` | String | oui | Coéquipiers (2v2). |
| `opponentAcceptedAt` / `opponentPartnerAcceptedAt` | DateTime | oui | En 2v2 les **deux** adversaires acceptent (un timestamp chacun) → `accepted` quand les deux. |

Index : `(opponentLogin, status)`, `(challengerLogin, status)`.

**Cycle de vie** : `pending` → (`accepted` → `recorded`) ou (`declined`/`cancelled`).
- `record` sur un défi `accepted` crée un `PendingMatch` (→ confirmation bilatérale classique).
- Se désister (`decline`) d'un défi **déjà accepté** = dodge → pénalité ELO + `dodgeCount++`.

---

### `Tournament` → table `tournaments`
Bracket à élimination directe **ou** phase de poules suivie d'un bracket.

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| `id` | String (uuid) | non | — | |
| `name` | String | non | — | 2–60 car. |
| `kind` | String | non | `friendly` | `friendly` \| `official` (officiel = réservé `isAdmin`). |
| `isPrivate` | Boolean | non | `false` | Privé = visible/rejoignable **sur invitation uniquement** (pas d'inscription libre). |
| `imageUrl` | String | oui | — | Image de couverture optionnelle (URL) ; sinon visuel par défaut généré côté front. |
| `capacity` | Int | non | — | Nombre de joueurs. Validé **≥ 6** (et ≤ 64) à la création (`CreateTournamentSchema`) ; n'a plus besoin d'être une puissance de 2 (les **byes** sont gérés — le bracket est dimensionné à la puissance de 2 supérieure et les joueurs excédentaires reçoivent un bye au 1er tour). |
| `format` | String | non | `elimination` | `elimination` (bracket direct) \| `pools` (poules puis bracket des qualifiés ; exige **≥ 12** joueurs). |
| `game` | String | non | `babyfoot` | `babyfoot` \| `smash` (discipline du tournoi). |
| `status` | String | non | — | `registration` \| `in_progress` \| `finished` \| `cancelled` |
| `createdByLogin` | String | non | — | Organisateur. |
| `winnerLogin` | String | oui | — | FK `onDelete: SetNull`. |
| `createdAt` | DateTime | non | `now()` | |
| `startedAt` / `finishedAt` | DateTime | oui | — | |
| `activeMatchId` | String | oui | — | Match « en cours » désigné par l'organisateur (« match suivant ») : déclenche l'écran VERSUS chez les spectateurs et met le duel en avant. Sans objet pour les échecs (matchs en parallèle). **Effacé à la confirmation.** |
| `prizeKind` | String | non | `none` | Récompense du vainqueur (officiels) : `none` \| `coins` \| `cosmetic`. Versée **une seule fois** au settlement de la finale. |
| `prizeCoins` | Int | oui | — | Montant de coins si `prizeKind='coins'`. |
| `prizeItemId` | String | oui | — | FK → `ShopItem` (`onDelete: SetNull`) si `prizeKind='cosmetic'`. Peut référencer un item créé inline en `active:false` (masqué de la boutique). |

Index : `(status)`. Relations : `entries` (→ `TournamentEntry`), `matches` (→ `TournamentMatch`),
`invites` (→ `TournamentInvite`), `prizeItem` (→ `ShopItem`), `bets` (→ `Bet`).
Migrations : `add_tournament_private`, `add_tournament_image`, `add_tournament_format_pools`,
`add_smash_game`, `add_game_enrollment_tournament`, `tournament_toss`, `tournament_bets_lock`,
`add_tournament_prize`, `add_tournament_active_match`.

> Note : le champ `capacity` est un `Int` non contraint en DB ; c'est la validation applicative
> (`CreateTournamentSchema`) qui impose le minimum de 6 (et 12 pour le format `pools`).

---

### `TournamentInvite` → table `tournament_invites`
Invitation à rejoindre un tournoi (obligatoire pour les tournois `isPrivate`).

| Champ | Type | Null | Défaut |
|---|---|---|---|
| `id` | String (uuid) | non | — |
| `tournamentId` | String | non | — (`onDelete: Cascade`) |
| `inviterLogin` / `inviteeLogin` | String | non | — (`onDelete: Cascade`) |
| `status` | String | non | `pending` \| `accepted` \| `declined` |
| `createdAt` | DateTime | non | `now()` |
| `decidedAt` | DateTime | oui | — |

Contrainte unique : `(tournamentId, inviteeLogin)`. Index : `(inviteeLogin, status)`, `(tournamentId)`.
Migration `add_tournament_invites`.

---

### `TournamentEntry` → table `tournament_entries`
Inscription d'un joueur. **Clé primaire composite `(tournamentId, login)`** → pas de double inscription.

| Champ | Type | Défaut |
|---|---|---|
| `tournamentId` | String | — (`onDelete: Cascade`) |
| `login` | String | — |
| `joinedAt` | DateTime | `now()` |

---

### `TournamentMatch` → table `tournament_matches`
Une case du bracket, ou un match de poule.

| Champ | Type | Null | Notes |
|---|---|---|---|
| `id` | String (uuid) | non | |
| `tournamentId` | String | non | `onDelete: Cascade`. |
| `stage` | String | non (`bracket`) | `pool` (round-robin de poule) \| `bracket` (élimination directe). |
| `poolIndex` | Int | oui | Index de la poule quand `stage='pool'`. |
| `round` | Int | non | Bracket : 1 = premier tour. Poule : `0`. |
| `slot` | Int | non | Bracket : position dans le tour (0-indexé). Poule : index global du match. |
| `playerALogin` / `playerBLogin` | String | oui | `onDelete: SetNull`. Null tant que non assigné. |
| `scoreA` / `scoreB` | Int | oui | Null tant que non saisi. |
| `winnerLogin` | String | oui | Renseigné à la confirmation. |
| `recordedByLogin` | String | oui | Qui a saisi le score. |
| `recordedAt` / `confirmedAt` | DateTime | oui | |
| `betsLockedAt` | DateTime | oui | Verrou de paris : posé au **premier** score saisi, **jamais** remis à null (même si le score est rejeté) — empêche de rouvrir le marché une fois un score divulgué. |
| `tossWinnerLogin` | String | oui | Pile-ou-face d'avant-duel : gagnant du tirage. |
| `tossSide` | String | oui | `heads` \| `tails` (face affichée par l'anim). |
| `advantagePick` | String | oui | Clé d'option d'avantage choisie par le gagnant du toss. |
| `tossAt` | DateTime | oui | Horodatage du pile-ou-face. |

Contrainte unique : `@@unique(tournamentId, round, slot)` — intégrité du bracket.
Index : `(tournamentId, round)`. Migrations : `tournament_toss`, `tournament_bets_lock`.

---

### `Ops` → table `ops`
Mécanique de « droit de vantardise » : `owner` a déclaré un *ops* sur `target` (voir [DOMAIN.md](./DOMAIN.md)).

| Champ | Type | Null | Défaut |
|---|---|---|---|
| `id` | String (uuid) | non | — |
| `ownerLogin` | String | non | — |
| `targetLogin` | String | non | — |
| `declaredAt` | DateTime | non | `now()` |
| `expiresAt` | DateTime | non | `declaredAt + 24 h` |
| `forcedUsed` | Int | non | `0` |

Index : `(ownerLogin, expiresAt)`, `(targetLogin, expiresAt)`. Un ops est « actif » tant que
`expiresAt > now`. **Durée 24 h** (refonte mai 2026, `OPS_DURATION_MS`), puis **cooldown de 7 jours**
qui empêche l'owner de redéclarer. `forcedUsed` compte les **matchs forcés** déjà consommés (joués
ou refusés) sur cet ops : la cible ne peut pas refuser sans surcoût tant que `forcedUsed < 3`
(`OPS_FORCED_MATCHES`). Migration `add_ops_forced_used`. Détails dans [DOMAIN.md §7](./DOMAIN.md).

---

### `FeatureRequest` → table `feature_requests`
Boîte à idées.

| Champ | Type | Défaut | Notes |
|---|---|---|---|
| `id` | String (uuid) | — | |
| `text` | String | — | 10–500 car. |
| `status` | String | `pending` | `pending` \| `accepted` \| `rejected`. |
| `authorId` | String | — | FK vers `User.login`. |
| `createdAt` | DateTime | `now()` | |

---

### `BugReport` → table `bug_reports`
Signalement de bug.

| Champ | Type | Défaut | Notes |
|---|---|---|---|
| `id` | String (uuid) | — | |
| `text` | String | — | |
| `status` | String | `open` | `open` \| `resolved` \| `closed`. |
| `authorId` | String | — | FK vers `User.login`. |
| `createdAt` | DateTime | `now()` | |

Migration `add_bug_reports`.

---

### `Notification` → table `notifications`
Centre de notifications in-app (cloche). Une notif ratée ne casse jamais l'action métier (best-effort).

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| `id` | String (uuid) | non | — | |
| `recipientLogin` | String | non | — | FK → `User.login`, `onDelete: Cascade`. |
| `type` | String | non | — | `challenge_received`, `match_result`, `tournament`, `ops_targeted`, `new_player`, `badge`, `follow_top3`, `follow_ops`, `follow_tournament`… |
| `game` | String | oui | — | Jeu d'origine (babyfoot/smash/chess/streetfighter) : pilote la couleur de fond + l'emoji de la cloche et la bascule de mode au clic. Null pour les notifs transverses. |
| `title` | String | non | — | Texte affiché. |
| `body` | String | oui | — | Sous-texte optionnel. |
| `link` | String | oui | — | Route front contextuelle (ex. `/challenges`). |
| `refId` | String | oui | — | Entité liée (pendingMatch/playedMatch/challenge) : permet de marquer la notif « lue » automatiquement quand l'action sous-jacente est traitée. |
| `read` | Boolean | non | `false` | |
| `createdAt` | DateTime | non | `now()` | |

Index : `(recipientLogin, read)`, `(recipientLogin, createdAt)`, `(recipientLogin, refId)`.
Migrations : `add_notifications`, `add_notification_game`, `add_notification_ref_id`.
À la création, le backend pousse un événement SSE `notification` (ciblé) pour rafraîchir la cloche.

---

### `UserBadge` → table `user_badges`
Badges **gagnés** par un joueur (stockés). Les badges « par défaut » (`founder`, `superadmin`,
`admin`) sont **dérivés du rôle** au runtime (`badgesFor`), pas stockés.

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| `id` | String (uuid) | non | — | |
| `userLogin` | String | non | — | FK → `User.login`, `onDelete: Cascade`. |
| `code` | String | non | — | Code du badge (catalogue front), ex. `beta_tester`, `season_champion`. |
| `seasonId` | String | oui | — | Saison associée (badges de palmarès). |
| `game` | String | non | `""` | Discipline liée (`""` = global, `babyfoot`/`smash`/`chess`… = spécifique) — distingue un champion babyfoot d'un champion chess sur la même saison. |
| `awardedAt` | DateTime | non | `now()` | |

Clé unique : `(userLogin, code, game)` — pas de doublon par discipline. Index : `(userLogin)`.
Migrations `add_user_badges` (octroie `beta_tester` à tous les inscrits non-SUPERADMIN) et
`add_userbadge_game`. Catalogue : `apps/web/src/lib/badges.ts`.

---

### `Follow` → table `follows`
Relation de suivi entre joueurs, avec **préférences de notification par personne suivie**.

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| `id` | String (uuid) | non | — | |
| `followerLogin` | String | non | — | Celui qui suit. FK `onDelete: Cascade`. |
| `followeeLogin` | String | non | — | Celui qui est suivi. FK `onDelete: Cascade`. |
| `notifyTournament` | Boolean | non | `true` | Notifier quand le suivi rejoint un tournoi. |
| `notifyTop3` | Boolean | non | `true` | Notifier quand le suivi entre dans le top 3. |
| `notifyTrophy` | Boolean | non | `true` | Notifier les trophées du suivi. |
| `notifyOps` | Boolean | non | `true` | Notifier quand le suivi lance un OPS. |
| `createdAt` | DateTime | non | `now()` | |

Clé unique : `(followerLogin, followeeLogin)`. Index : `(followeeLogin)`. Migration `add_follows`.

---

### `Season` → table `seasons`
Une **saison** de classement (ère ELO). Une seule active à la fois.

| Champ | Type | Null | Défaut |
|---|---|---|---|
| `id` | String (uuid) | non | — |
| `name` | String | non | — |
| `isActive` | Boolean | non | `false` |
| `startedAt` | DateTime | non | `now()` |
| `endedAt` | DateTime | oui | — |

### `SeasonStanding` → table `season_standings`
**Snapshot figé** du classement final d'une saison (créé à sa clôture). Sert au palmarès des joueurs.

| Champ | Type | Notes |
|---|---|---|
| `id` | String (uuid) | |
| `seasonId` | String | Saison concernée. |
| `game` | String | Discipline du classement figé (`babyfoot` par défaut). |
| `login` | String | Joueur. |
| `rank` / `elo` / `wins` / `losses` | Int | Position et bilan figés à la clôture. |

Index : `(seasonId)`, `(login)`. Migrations `add_seasons` (crée la « Saison Bêta » active et y
rattache l'historique) et `add_season_standing_game`. La clôture (`POST /seasons/close`) snapshot le
classement **de chaque discipline**, octroie le badge `season_champion` au n°1 de chaque mode, puis
**remet chaque ELO au plancher de son grade courant** (`seasonResetElo` — pas un plat à 1000 ; les
Étains remontent au plancher Bronze) et les compteurs de matchs à zéro. L'historique des matchs est
conservé, taggé par saison. Voir [DOMAIN.md §11](./DOMAIN.md) et [API.md](./API.md).

---

### `AdminAuditLog` → table `admin_audit_log`
Journal **append-only** des actions admin (forensics). Détaillé dans [SECURITY.md](./SECURITY.md) §1.

| Champ | Type | Null |
|---|---|---|
| `id` | String (uuid) | non |
| `actorLogin` | String | non |
| `actorRole` | Role | non |
| `action` | AdminAction | non |
| `targetLogin` | String | oui |
| `payload` | Json | oui |
| `ipAddress` | String | oui |
| `userAgent` | String | oui |
| `createdAt` | DateTime | non (`now()`) |

Index : `(createdAt DESC)`, `(actorLogin)`, `(targetLogin)`.
Purge automatique des entrées > **24 mois** (RGPD Art. 5(1)(e)), quotidienne à 03h00.

---

### `BabyfootTeam` → table `babyfoot_teams`
Duo stable du mode **2v2 Babyfoot**. Créé silencieusement à la validation du 1er match 2v2 du duo.

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| `id` | String (uuid) | non | — | |
| `player1Login` | String | non | — | Login canoniquement « inférieur ». |
| `player2Login` | String | non | — | Login canoniquement « supérieur ». |
| `elo` | Int | non | `1000` | ELO du duo (initial pondéré 65 %/35 % du joueur fort, cf. `initTeamElo`). |
| `name` | String | oui | — | Surnom optionnel du duo. |
| `createdAt` | DateTime | non | `now()` | |

Clé unique : `(player1Login, player2Login)` — clé métier triée garantissant que (A,B) et (B,A)
pointent sur la même ligne. Index : `(player1Login)`, `(player2Login)`. Relations :
`matchesAsTeamA`/`matchesAsTeamB` → `PlayedMatch`. Migration `add_babyfoot_2v2`.

---

### `PendingFfa` / `PendingFfaParticipant` → tables `pending_ffas` / `pending_ffa_participants`
**FFA (Free-For-All, 3+ joueurs)** — exclusif au **Smash** et aux **Fléchettes**. Le déclarant
propose le **classement final complet** ; le déclarant est auto-confirmé, chaque autre participant
confirme **uniquement sa propre position**. Une contestation annule tout le FFA (delete cascade).
Le settlement (ELO via `calculateFfaElo`) se déclenche quand toutes les positions sont confirmées.

`PendingFfa` :
| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| `id` | String (uuid) | non | — | |
| `declarerLogin` | String | non | — | `onDelete: Cascade`. |
| `game` | String | non | `smash` | |
| `startScore` | Int | oui | — | Fléchettes uniquement : score de départ (301/501). |
| `declaredAt` | DateTime | non | `now()` | |

Index : `(declarerLogin)`.

`PendingFfaParticipant` :
| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| `id` | String (uuid) | non | — | |
| `pendingId` | String | non | — | FK → `PendingFfa`, `onDelete: Cascade`. |
| `login` | String | non | — | |
| `position` | Int | non | — | 1 = 1er … N = dernier (proposé par le déclarant). |
| `remaining` | Int | oui | — | Fléchettes uniquement : points restants (0 = vainqueur). |
| `confirmed` | Boolean | non | `false` | Le joueur a validé sa position / son reste. |

Uniques : `(pendingId, login)` (un joueur une fois), `(pendingId, position)` (positions uniques 1..N).
Index : `(login)`.

---

### `PlayedFfa` / `PlayedFfaParticipant` → tables `played_ffas` / `played_ffa_participants`
FFA confirmé et immuable (équivalent FFA de `PlayedMatch`).

`PlayedFfa` :
| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| `id` | String | non | — | |
| `game` | String | non | `smash` | |
| `startScore` | Int | oui | — | Fléchettes (301/501). |
| `playedAt` | DateTime | non | — | |
| `seasonId` | String | oui | — | |
| `countedForElo` | Boolean | non | `true` | |

Index : `(seasonId)`, `(playedAt)`.

`PlayedFfaParticipant` :
| Champ | Type | Null | Notes |
|---|---|---|---|
| `id` | String (uuid) | non | |
| `playedId` | String | non | FK → `PlayedFfa`, `onDelete: Cascade`. |
| `login` | String | non | |
| `position` | Int | non | Rang final. |
| `remaining` | Int | oui | Fléchettes : points restants. |
| `ratingBefore` / `delta` / `ratingAfter` | Int | non | Trace ELO du participant. |

Unique : `(playedId, login)`. Index : `(login)`. Migrations `add_smash_ffa`, `add_flechettes`.

---

### `ShopItem` → table `shop_items`
Catalogue d'objets cosmétiques achetables avec des **League Coins**.

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| `id` | String (uuid) | non | — | |
| `name` | String | non | — | |
| `description` | String | oui | — | |
| `category` | String | non | — | `title` \| `banner` \| `badge` \| `cosmetic`. |
| `price` | Int | non | — | En League Coins. |
| `color` | String | oui | — | Couleur d'accent (hex) — titres & badges, choisie dans le créateur Shop GOD. |
| `payload` | Json | oui | — | Données spécifiques à la catégorie (`title`→`{"title":…}` ; `badge`→`{"code","icon","label"}` ; `banner`→`{"image":…}`). |
| `active` | Boolean | non | `true` | Inactif = disparaît de la boutique mais reste possédé par ceux qui l'ont déjà acquis. |
| `sortOrder` | Int | non | `0` | |
| `createdAt` | DateTime | non | `now()` | |

Relations : `inventory` → `ShopInventory`, `prizeFor` → `Tournament` (récompense de tournoi).
Migrations : `shop_league_coin` (création + `User.leagueCoins`), `shop_color_drop_slug` (suppression
du `slug` jamais utilisé + ajout `color`).

> **Catégorie `cosmetic` non achetable.** Le schéma DB liste encore `cosmetic` (anciens items / items
> de récompense de tournoi créés inline), mais le schéma de validation de création/édition n'accepte
> plus que `z.enum(['title','banner','badge'])` : on **ne peut plus créer ni acheter** un item
> `cosmetic`, et seuls `title`/`badge`/`banner` sont équipables. La catégorie ne survit que pour la
> compatibilité ascendante et les prix de tournoi (`prizeKind='cosmetic'`).

---

### `ShopInventory` → table `shop_inventory`
Inventaire : objets possédés par un joueur. **Clé primaire composite `(userLogin, itemId)`.**

| Champ | Type | Défaut | Notes |
|---|---|---|---|
| `userLogin` | String | — | FK → `User.login`, `onDelete: Cascade`. |
| `itemId` | String | — | FK → `ShopItem`, `onDelete: Cascade`. |
| `equipped` | Boolean | `false` | Objet actuellement porté (au plus un équipé par catégorie). |
| `acquiredAt` | DateTime | `now()` | |

Index : `(userLogin)`.

---

### `MatchmakingQueue` → table `matchmaking_queue`
File d'attente « match aléatoire ». **Clé primaire composite `(login, game)`** — un joueur peut
chercher dans **plusieurs disciplines** en parallèle. Au `/queue/join`, on apparie le joueur avec le
plus ancien autre joueur de la même discipline puis on retire les deux entrées.

| Champ | Type | Défaut |
|---|---|---|
| `login` | String | — |
| `game` | String | — |
| `joinedAt` | DateTime | `now()` |

Migrations `add_matchmaking_queue`, `matchmaking_queue_per_game`.

---

### `WeeklyQuestProgress` → table `weekly_quest_progress`
**Économie de coins — quêtes hebdomadaires.** Une ligne par `(login, weekKey)`. Les compteurs sont
accumulés au règlement de chaque match classé (`awardMatchEconomyTx`). Les quêtes elles-mêmes sont
définies côté serveur (`WEEKLY_QUESTS` dans `index.ts`) et évaluées à la volée à partir de ces
compteurs. La semaine ISO sert de reset implicite : une nouvelle semaine = une nouvelle ligne.

| Champ | Type | Défaut | Notes |
|---|---|---|---|
| `login` | String | — | FK → `User.login`, `onDelete: Cascade`. |
| `weekKey` | String | — | Année-semaine ISO 8601, ex. `2026-W23`. |
| `matchesPlayed` | Int | `0` | Matchs classés joués cette semaine. |
| `wins` | Int | `0` | Victoires classées. |
| `gamesPlayed` | String[] | `[]` | Disciplines distinctes jouées en classé. |
| `claimed` | String[] | `[]` | Ids de quêtes déjà réclamées (anti double-claim). |
| `updatedAt` | DateTime | `@updatedAt` | |

Clé primaire composite : `(login, weekKey)`. Index : `(login)`. Migration `add_coin_economy`.

> **Quêtes (`WEEKLY_QUESTS`, non stockées).** `two_modes` (jouer 2 disciplines → 200), `all_modes`
> (toutes les disciplines → 300), `play_5` (5 matchs → 150), `win_3` (3 victoires → 200). Gains coins
> par match : **20** (participation) / **50** (victoire) — `COINS_PER_MATCH_PLAYED` / `COINS_PER_MATCH_WON`.

---

### `Bet` → table `bets`
**Économie de coins — paris** à cote fixe **×2** (`BET_PAYOUT_MULTIPLIER`). La mise est débitée à la
prise (jamais de solde négatif) ; un pari gagnant crédite **2× la mise** au règlement (gain net = mise),
un perdant ne crédite rien. Cible = vainqueur d'un **tournoi** (`tournament`) **ou** d'un **match de
bracket** précis (`match`).

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| `id` | String (uuid) | non | — | |
| `bettorLogin` | String | non | — | FK → `User.login`, `onDelete: Cascade`. |
| `targetType` | String | non | — | `tournament` \| `match`. |
| `tournamentId` | String | non | — | Toujours renseigné (FK → `Tournament`, `onDelete: Cascade`) ; pour un pari `match`, c'est son tournoi. |
| `matchId` | String | oui | — | `TournamentMatch.id` quand `targetType='match'`. |
| `choiceLogin` | String | non | — | Vainqueur pronostiqué. |
| `stake` | Int | non | — | Mise débitée à la prise. |
| `status` | String | non | `open` | `open` \| `won` \| `lost` \| `refunded`. |
| `payout` | Int | non | `0` | Coins crédités au règlement (0 si perdu). |
| `createdAt` | DateTime | non | `now()` | |
| `settledAt` | DateTime | oui | — | |

Index : `(bettorLogin)`, `(tournamentId, status)`, `(matchId, status)`. Migration `add_coin_economy`.

> **Règlement.** `settleMatchBetsTx` règle les paris d'un match de bracket à sa confirmation ;
> `settleTournamentBetsTx` règle les paris « vainqueur du tournoi » à la confirmation de la finale.
> `refundBetsTx` rembourse intégralement (mise rendue, `status='refunded'`) tous les paris ouverts
> d'un tournoi avant son annulation/suppression. Le marché est verrouillé par `TournamentMatch.betsLockedAt`.

---

## 3. Migrations

Dans `apps/backend/prisma/migrations/`, dans l'ordre chronologique (le préfixe timestamp donne l'ordre) :

| # | Migration | Apport |
|---|---|---|
| 1 | `20260523124947_init` | User, PendingMatch, PlayedMatch. |
| 2 | `20260524120916_add_challenges` | Challenge. |
| 3 | `20260524130321_add_user_image` | `User.imageUrl`. |
| 4 | `20260524152623_add_dodge` | `User.dodgeCount`. |
| 5 | `20260524190910_add_tournaments` | Tournament, TournamentEntry, TournamentMatch. |
| 6 | `20260524192023_add_tournament_kind` | `Tournament.kind`. |
| 7 | `20260524192835_add_user_title` | `User.title`. |
| 8 | `20260524200818_add_ops` | Ops. |
| 9 | `20260529000000_add_role_and_feature_requests` | Enum `Role`, `User.role`, FeatureRequest. |
| 10 | `20260529013138_add_banned_at_and_rejected_matches` | `User.bannedAt`, RejectedMatch. |
| 11 | `20260529030000_add_admin_audit_log` | AdminAuditLog + enum `AdminAction`. |
| 12 | `20260529100000_add_anonymized_at` | `User.anonymizedAt`. |
| 13 | `20260531000000_add_ops_forced_used` | `Ops.forcedUsed` (matchs forcés consommés). |
| 14 | `20260531003323_add_admin_action_delete_history` | Valeurs `DELETE_CHALLENGE/PENDING_MATCH/REJECTED_MATCH/OPS` dans `AdminAction`. |
| 15 | `20260531010000_add_reset_database_action` | Valeur `RESET_DATABASE` dans `AdminAction`. |
| 16 | `20260531020000_add_deletion_scheduled_at` | `User.deletionScheduledAt` (suppression RGPD différée). |
| 17 | `20260531120000_add_terms_consent` | `User.termsAcceptedAt`/`termsVersion` (consentement RGPD). |
| 18 | `20260601000000_add_tournament_private` | `Tournament.isPrivate`. |
| 19 | `20260601010000_add_tournament_image` | `Tournament.imageUrl`. |
| 20 | `20260602000000_add_notifications` | Modèle `Notification`. |
| 21 | `20260603000000_add_user_badges` | Modèle `UserBadge` (+ octroi `beta_tester`). |
| 22 | `20260604000000_add_follows` | Modèle `Follow`. |
| 23 | `20260604043703_add_favorite_chars` | `User.favSmash`/`favSf`. |
| 24 | `20260605000000_add_seasons` | `Season`, `SeasonStanding`, `PlayedMatch.seasonId` (+ « Saison Bêta »). |
| 25 | `20260605054236_add_flechettes` | Discipline Fléchettes (`User.eloFlechettes`…) + champs FFA `startScore`/`remaining`. ⚠️ voir note d'ordonnancement ci-dessous. |
| 26 | `20260605120000_tournament_toss` | Pile-ou-face : `TournamentMatch.tossWinnerLogin`/`tossSide`/`advantagePick`/`tossAt`. |
| 27 | `20260605130000_tournament_bets_lock` | `TournamentMatch.betsLockedAt` (verrou de paris). |
| 28 | `20260606000000_add_tournament_format_pools` | `Tournament.format`, `TournamentMatch.stage`/`poolIndex`. |
| 29 | `20260606010000_add_delete_tournament_action` | Valeur `DELETE_TOURNAMENT` dans `AdminAction`. |
| 30 | `20260606020000_add_smash_game` | Discipline Smash (`User.eloSmash`… + champs match smash). |
| 31 | `20260606030000_add_game_enrollment_tournament` | `User.games`, `Tournament.game`. |
| 32 | `20260606040000_add_chess_game` | Discipline Échecs (`User.eloChess`…). |
| 33 | `20260606050000_add_season_standing_game` | `SeasonStanding.game`. |
| 34 | `20260607000000_add_bug_reports` | Modèle `BugReport`. |
| 35 | `20260608000000_add_tournament_invites` | Modèle `TournamentInvite`. |
| 36 | `20260608000000_add_userbadge_game` | `UserBadge.game` (clé unique → `(userLogin, code, game)`). |
| 37 | `20260609000000_add_babyfoot_2v2` | `BabyfootTeam` + champs 2v2 sur pending/played/challenge. |
| 38 | `20260610000000_add_streetfighter_game` | Discipline Street Fighter (`User.eloSf`…). |
| 39 | `20260611000000_shop_league_coin` | `User.leagueCoins`, modèles `ShopItem`/`ShopInventory`. |
| 40 | `20260612000000_add_matchmaking_queue` | Modèle `MatchmakingQueue`. |
| 41 | `20260613000000_add_impersonate_tester` | Valeur `IMPERSONATE_TESTER` dans `AdminAction`. |
| 42 | `20260614000000_add_notification_game` | `Notification.game`. |
| 43 | `20260614000001_add_user_name` | `User.firstName`/`lastName`. |
| 44 | `20260615000000_add_smash_ffa` | Modèles FFA `PendingFfa`/`PendingFfaParticipant`/`PlayedFfa`/`PlayedFfaParticipant`. |
| 45 | `20260615120000_shop_color_drop_slug` | `ShopItem.color` (+ drop `slug`). |
| 46 | `20260615130000_add_challenge_2v2` | Champs 2v2 sur `Challenge`. |
| 47 | `20260616000000_matchmaking_queue_per_game` | `MatchmakingQueue` clé composite `(login, game)`. |
| 48 | `20260620000000_add_moderator_staging_permissions` | Rôle `MODERATOR`, `User.moderatorPermissions`/`stagingAllowed`, action `SET_MODERATOR_PERMISSIONS`. |
| 49 | `20260621000000_add_2v2_confirmations` | Confirmations progressives 2v2 sur `PendingMatch`. |
| 50 | `20260622000000_add_tournament_prize` | `Tournament.prizeKind`/`prizeCoins`/`prizeItemId`. |
| 51 | `20260623000000_add_notification_ref_id` | `Notification.refId`. |
| 52 | `20260624000000_add_coin_economy` | Modèles `WeeklyQuestProgress` et `Bet`. |
| 53 | `20260625000000_add_tournament_active_match` | `Tournament.activeMatchId`. |
| 54 | `20260626000000_add_sync_elo_audit_action` | Valeur `SYNC_ELO_FROM_PROD` dans `AdminAction`. |

En prod, les migrations sont appliquées par `prisma migrate deploy` au démarrage du conteneur backend.

> ⚠️ **Ordonnancement cassé — `migrate deploy` from scratch.** La migration `20260605054236_add_flechettes`
> référence des tables/colonnes (`matchmaking_queue`, `pending_ffas`, colonnes 2v2…) qui ne sont créées
> que par des migrations **postérieures** par timestamp. Appliquer toute la chaîne `migrate deploy` sur
> une base **vierge** échoue donc. Pour cette raison, **les tests d'intégration utilisent `prisma db push`**
> (qui matérialise le schéma final sans rejouer les migrations) plutôt que `migrate deploy`. La prod n'est
> pas affectée car ses migrations ont été appliquées au fil de l'eau, dans l'ordre où elles ont été créées.

---

## 4. Seed (`prisma/seed.ts`)

Initialise une base de démo réaliste :
- **9 utilisateurs** whitelistés (logins 42 réels du groupe) avec ELO 1240–1680, compteurs, titres ; avatars récupérés via l'API intra.
- **~30 matchs joués** historiques avec deltas ELO réalistes.
- **6 défis** dans des états variés (pending/accepted/recorded/cancelled).
- **2 matchs pending** en attente de confirmation.
- **3 tournois** : un `in_progress` (4 places, officiel), un en `registration` (8 places, friendly), un `finished` (4 places, officiel, vainqueur déterminé).
- **3 ops** actifs.
- **1 objet de boutique** de démo (`shopItem` upsert).

> Le seed ne crédite **pas** de coins, ne crée ni paris ni progression de quêtes : ces données
> n'apparaissent qu'au jeu réel (matchs classés, prise de paris).

Lancement : `npm run db:seed -w @42-league/backend`.

### Scripts utilitaires complémentaires (`prisma/`)
| Script | Commande | Effet |
|---|---|---|
| `seed.ts` | `npm run db:seed -w @42-league/backend` | Base de démo complète (ci-dessus). |
| `add-test-players.ts` | `npm run db:add-players -w @42-league/backend` | Ajoute **8 faux joueurs** (`test1`…`test8`, campus « Le Havre », ELO 1000) en **upsert** (idempotent). `db:add-players:prod` = même script sans `dotenv`. |
| `seed-test.ts` | `npm run db:seed-test -w @42-league/backend` | Jeu de données réduit pour essais. |
| `add-test-notif.ts` | `npm run db:add-notif -w @42-league/backend` | Crée des notifications de test pour la cloche in-app. |

> Note : on peut aussi créer / supprimer des faux comptes en prod via l'API SUPERADMIN
> (`POST`/`DELETE /admin/users` — voir [API.md](./API.md)), sans toucher à la DB directement.

---

## 5. Flux de données critiques

### Match ad-hoc : `PendingMatch` → `PlayedMatch`
```
POST /matches            → crée PendingMatch (scoreDeclarer/scoreOpponent)
                           emit match:pending → adversaire
POST /matches/:id/confirm (adversaire) :
   ├─ scores ≠ miroir → DELETE PendingMatch, 409 (à redéclarer)   ← commit AVANT le throw
   └─ scores = miroir →
        pairKey → ordre canonique (A,B)
        shouldCountForElo(priors, declaredAt) ?
           ├─ oui → calculateBabyfootElo → update elo + matchesPlayed des 2 joueurs
           └─ non → deltas = 0, countedForElo=false
        DELETE PendingMatch ; CREATE PlayedMatch
        si countedForElo → awardMatchEconomyTx :    ← ÉCONOMIE DE COINS
              grantCoins(+20 participation / +50 victoire, × coinFactor anti-farming)
              upsert WeeklyQuestProgress (matchesPlayed++, wins++, gamesPlayed ∪ {game})
        emit match:confirmed → 2 joueurs ; broadcast leaderboard:update
POST /matches/:id/reject (adversaire) → CREATE RejectedMatch ; DELETE PendingMatch
                           emit match:rejected → déclarant
```
> Les coins/quêtes ne sont **jamais** crédités sur un dodge, un match forcé ou un match non-classé.
> Un rematch dégressé (anti-farming) applique `coinFactor < 1` et ne fait **pas** avancer les quêtes.

### Défi → match
```
POST /challenges          status=pending      emit challenge:received → adversaire
POST /challenges/:id/accept (adversaire)  status=accepted   emit challenge:accepted → challenger
POST /challenges/:id/decline :
   ├─ par le challenger          status=cancelled, pénalité 0
   ├─ par l'adversaire (pending) status=declined,  pénalité 0
   └─ par l'adversaire (accepted) status=declined, pénalité -10 ELO + dodgeCount++  ← DODGE
POST /challenges/:id/record (participant, défi accepted)  status=recorded
                           CREATE PendingMatch → repart sur la confirmation bilatérale classique
```

### Tournoi
```
POST /tournaments         status=registration ; organisateur auto-inscrit
                          (privé → invitations TournamentInvite ; sinon inscription libre)
POST /tournaments/:id/join  ajoute TournamentEntry ; si plein → génère le bracket, status=in_progress
POST /tournaments/:id/start (organisateur, si plein)  → génère bracket (byes si capacité ≠ 2ⁿ),
                          status=in_progress
(option) pile-ou-face d'avant-duel → TournamentMatch.tossWinnerLogin/tossSide/advantagePick
record (1er score) → pose TournamentMatch.betsLockedAt (verrou de paris, jamais rouvert)
record → confirm (par l'AUTRE joueur) :
        settleMatchBetsTx(matchId, winner)              ← PARIS sur ce match de bracket
        winner avance dans la case (round+1, slot/2)
        à la finale → status=finished, winnerLogin renseigné, user.tournamentsWon++
                      settleTournamentBetsTx(tournamentId, winner)  ← PARIS « vainqueur du tournoi »
                      si prizeKind → versement de la récompense (coins / cosmétique) au vainqueur
DELETE / annulation d'un tournoi → refundBetsTx (rembourse toutes les mises ouvertes) AVANT le cascade
```
Paris : cote fixe ×2, mise débitée à la prise ; gagnant +2× la mise, perdant +0, annulé → remboursé.
La génération du bracket et l'avancement vivent dans `apps/backend/src/tournament.ts`.

### Ops (vantardise)
```
POST /ops  (1 ops actif max par owner ; durée 24 h puis cooldown 7j ; cibles non déjà engagées)
           CREATE Ops (expiresAt = now + 24 h) ; scheduleOpsTimers(expiry, cooldown)
           emit ops:update → [owner, target]
À l'expiration / fin de cooldown : timer setTimeout → emit ops:update (ré-armés au boot du serveur).
```

### Clôture d'une saison (`POST /seasons/close`, transaction)
```
saison active → pour chaque discipline (babyfoot/smash/chess/sf/flechettes) :
                  SeasonStanding {game, rank, elo, wins, losses}     ← snapshot figé PAR jeu
                  n°1 du classement → UserBadge 'season_champion' (game) (upsert)
                pour chaque joueur : elo ← seasonResetElo(elo)        ← plancher du GRADE courant
                                     compteurs de matchs remis à 0    (les Étains remontent au Bronze)
                Season { isActive: false, endedAt: now }
                notify(champions) ; broadcast data:update + leaderboard:update
```
L'historique des `PlayedMatch` est **conservé** (taggé `seasonId`). Le reset ne repart **pas** d'un plat
à 1000 : chaque ELO est ramené au plancher de son grade courant (récompense la progression de la saison).
Le solde `leagueCoins` n'est **pas** touché par la clôture (la monnaie traverse les saisons).

---

## 6. Patterns de conception

1. **Clé primaire métier** : `User.login` (pas d'id surrogate) — l'identité vient de l'intra.
2. **Ordre canonique des paires** : `PlayedMatch` (`A < B`) et `BabyfootTeam` (`player1 < player2`)
   → dédoublonnage + anti-farming simples ; un duo (A,B)/(B,A) tombe toujours sur la même ligne.
3. **Clés primaires composites** pour les tables d'association sans id propre : `TournamentEntry`
   `(tournamentId, login)`, `ShopInventory` `(userLogin, itemId)`, `WeeklyQuestProgress` `(login, weekKey)`,
   `MatchmakingQueue` `(login, game)`.
4. **Multi-jeu par colonnes** : un seul `User` porte les ELO/compteurs de toutes les disciplines
   (préfixe/suffixe par jeu) ; les modèles de match discriminent par un champ `game`.
5. **Cascade maîtrisée** : `Tournament` supprime ses entries/matches/invites/paris en cascade ; les FK
   joueur sont majoritairement en `Restrict` (jamais supprimer un user référencé) + `onUpdate: Cascade`
   (renommer un login propage → sert à l'anonymisation RGPD). Les tables annexes (notifications, badges,
   follows, inventaire, quêtes, paris, FFA) sont en `onDelete: Cascade` côté joueur.
6. **Soft-flags temporels** : `bannedAt`, `deletionScheduledAt`, `anonymizedAt` plutôt que suppression
   dure — la suppression RGPD est différée (période de grâce) puis matérialisée par anonymisation.
7. **Audit append-only** : aucune route ne modifie/supprime `AdminAuditLog` (sauf purge RGPD 24 mois).
8. **États en `String`** (pas d'enum DB) pour `status`/`kind`/`winner`/`game`/`category` : la validation
   se fait côté applicatif (Zod), ce qui évite une migration à chaque nouvel état ou nouvelle discipline.
9. **Verrous/grades non persistés** : les grades (`rank.ts`) et la définition des quêtes (`WEEKLY_QUESTS`)
   sont calculés au runtime ; seuls les compteurs bruts et les réclamations sont stockés.
