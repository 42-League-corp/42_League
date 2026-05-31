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

---

## 1. Enums

### `Role`
Niveau de permission d'un utilisateur.
| Valeur | Sens |
|---|---|
| `USER` | Défaut à la création. Joueur normal. |
| `ADMIN` | Accès au GOD panel + actions de modération. |
| `SUPERADMIN` | Tout `ADMIN` + gestion des rôles. **Hardcodé** côté serveur (`abidaux`, `throbert`), réimposé à chaque login, jamais attribuable par l'API. |

### `AdminAction`
Type d'action tracée dans l'audit log.
`SET_ROLE`, `BAN_USER`, `UNBAN_USER`, `EDIT_STATS`, `EDIT_TITLE`, `DELETE_MATCH`, `EDIT_MATCH`,
`REFRESH_IMAGES`, `RESET_DATABASE` (reset complet de la ligue par un SUPERADMIN), puis les actions
de modération de l'historique : `DELETE_CHALLENGE`, `DELETE_PENDING_MATCH`, `DELETE_REJECTED_MATCH`,
`DELETE_OPS`, `DELETE_TOURNAMENT` (suppressions ciblées depuis le GOD panel « All History »).

---

## 2. Modèles

### `User` → table `users`
Clé primaire : **`login`** (le login intra 42, pas un id numérique).

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| `login` | String | non | — | `@id`. Identité 42. |
| `ftId` | Int | oui | — | `@unique`. Id intra 42. |
| `campus` | String | oui | — | Campus 42. |
| `imageUrl` | String | oui | — | Avatar (récupéré en arrière-plan si absent). |
| `title` | String | oui | — | Titre cosmétique (ex. « 👑 Roi du Babyfoot »). |
| `role` | Role | non | `USER` | Permission. |
| `elo` | Int | non | `1000` | Classement ELO. |
| `matchesPlayed` | Int | non | `0` | Matchs comptés pour l'ELO. |
| `dodgeCount` | Int | non | `0` | Nombre de désistements sur défi accepté. |
| `tournamentsWon` | Int | non | `0` | Tournois gagnés. |
| `bannedAt` | DateTime | oui | — | Si renseigné → compte suspendu. |
| `deletionScheduledAt` | DateTime | oui | — | Suppression programmée (RGPD Art. 17). Posée par `DELETE /me/account` ; **se reconnecter avant l'échéance la remet à null** (annule la suppression). Un job quotidien anonymise les comptes échus après `ACCOUNT_GRACE_DAYS` (défaut **30 j**). |
| `anonymizedAt` | DateTime | oui | — | Si renseigné → compte déjà anonymisé (login → `anon_<hash>`, PII purgée). |
| `createdAt` | DateTime | non | `now()` | `@updatedAt`. |

> **Période de grâce.** Tant que `deletionScheduledAt` est posé mais l'échéance non atteinte, l'utilisateur
> est **exclu** des listings (`GET /users`, `/leaderboard`, profils) mais son compte et son ELO existent
> toujours. Le job quotidien `anonymizeAccount` ne le purge qu'après la fenêtre de grâce ; une
> reconnexion entre-temps le restaure intégralement.

**Relations** (toutes les FK joueur utilisent `onDelete: Restrict`, `onUpdate: Cascade` — on ne
supprime jamais un user référencé ; renommer un login propage en cascade, ce qui sert à
l'anonymisation) :
- `declaredPending` / `awaitingPending` → `PendingMatch` (déclarant / adversaire)
- `matchesAsA` / `matchesAsB` → `PlayedMatch`
- `challengesSent` / `challengesReceived` → `Challenge`
- `tournamentsCreated` / `tournamentsWonRel` / `tournamentEntries` / `tournamentMatchesA` / `tournamentMatchesB`
- `opsAsOwner` / `opsAsTarget` → `Ops`
- `featureRequests` → `FeatureRequest`
- `rejectedAsDeclarer` / `rejectedAsOpponent` → `RejectedMatch`
- `notifications` → `Notification` (centre de notifications in-app)
- `badges` → `UserBadge` (badges gagnés)
- `following` / `followers` → `Follow` (suivi de joueurs, avec préférences de notif)

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
| `scheduledAt` | DateTime | non | Date prévue du match. |
| `createdAt` | DateTime | non | `now()` |
| `decidedAt` | DateTime | oui | Horodatage accept/decline. |

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
| `capacity` | Int | non | — | Nombre de joueurs. Validé **≥ 6** (et ≤ 64) à la création (`CreateTournamentSchema`) ; n'a plus besoin d'être une puissance de 2 (les **byes** sont gérés). |
| `format` | String | non | `elimination` | `elimination` (bracket direct) \| `pools` (poules puis bracket des qualifiés ; exige **≥ 12** joueurs). |
| `status` | String | non | — | `registration` \| `in_progress` \| `finished` \| `cancelled` |
| `createdByLogin` | String | non | — | Organisateur. |
| `winnerLogin` | String | oui | — | FK `onDelete: SetNull`. |
| `createdAt` | DateTime | non | `now()` | |
| `startedAt` / `finishedAt` | DateTime | oui | — | |

Index : `(status)`. Relations : `entries` (→ `TournamentEntry`), `matches` (→ `TournamentMatch`).
Migrations : `add_tournament_private`, `add_tournament_image`, `add_tournament_format_pools`.

> Note : le champ `capacity` est un `Int` non contraint en DB ; c'est la validation applicative
> (`CreateTournamentSchema`) qui impose le minimum de 6 (et 12 pour le format `pools`).

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

Contrainte unique : `@@unique(tournamentId, round, slot)` — intégrité du bracket.
Index : `(tournamentId, round)`.

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

### `Notification` → table `notifications`
Centre de notifications in-app (cloche). Une notif ratée ne casse jamais l'action métier (best-effort).

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| `id` | String (uuid) | non | — | |
| `recipientLogin` | String | non | — | FK → `User.login`, `onDelete: Cascade`. |
| `type` | String | non | — | `challenge_received`, `match_result`, `tournament`, `ops_targeted`, `new_player`, `badge`, `follow_top3`, `follow_ops`, `follow_tournament`… |
| `title` | String | non | — | Texte affiché. |
| `body` | String | oui | — | Sous-texte optionnel. |
| `link` | String | oui | — | Route front contextuelle (ex. `/challenges`). |
| `read` | Boolean | non | `false` | |
| `createdAt` | DateTime | non | `now()` | |

Index : `(recipientLogin, read)`, `(recipientLogin, createdAt)`. Migration `add_notifications`.
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
| `awardedAt` | DateTime | non | `now()` | |

Clé unique : `(userLogin, code)` — pas de doublon. Index : `(userLogin)`. Migration `add_user_badges`
(qui octroie `beta_tester` à tous les inscrits non-SUPERADMIN). Catalogue : `apps/web/src/lib/badges.ts`.

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
| `login` | String | Joueur. |
| `rank` / `elo` / `wins` / `losses` | Int | Position et bilan figés à la clôture. |

Index : `(seasonId)`, `(login)`. Migration `add_seasons` : crée la « Saison Bêta » active et y
rattache l'historique. La clôture (`POST /seasons/close`) snapshot le classement, octroie le badge
`season_champion` au 1er, puis **remet tout le monde à 1000 ELO / 0 match** (l'historique des matchs
est conservé, taggé par saison). Voir [DOMAIN.md §11](./DOMAIN.md) et [API.md](./API.md).

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
| 17 | `20260601000000_add_tournament_private` | `Tournament.isPrivate`. |
| 18 | `20260601010000_add_tournament_image` | `Tournament.imageUrl`. |
| 19 | `20260602000000_add_notifications` | Modèle `Notification`. |
| 20 | `20260603000000_add_user_badges` | Modèle `UserBadge` (+ octroi `beta_tester`). |
| 21 | `20260604000000_add_follows` | Modèle `Follow`. |
| 22 | `20260605000000_add_seasons` | `Season`, `SeasonStanding`, `PlayedMatch.seasonId` (+ « Saison Bêta »). |
| 23 | `20260606000000_add_tournament_format_pools` | `Tournament.format`, `TournamentMatch.stage`/`poolIndex`. |
| 24 | `20260606010000_add_delete_tournament_action` | Valeur `DELETE_TOURNAMENT` dans `AdminAction`. |

En prod, les migrations sont appliquées par `prisma migrate deploy` au démarrage du conteneur backend.

---

## 4. Seed (`prisma/seed.ts`)

Initialise une base de démo réaliste :
- **9 utilisateurs** whitelistés (logins 42 réels du groupe) avec ELO 1240–1680, compteurs, titres ; avatars récupérés via l'API intra.
- **~30 matchs joués** historiques avec deltas ELO réalistes.
- **6 défis** dans des états variés (pending/accepted/recorded/cancelled).
- **2 matchs pending** en attente de confirmation.
- **3 tournois** : un `in_progress` (4 places, officiel), un en `registration` (8 places, friendly), un `finished` (4 places, officiel, vainqueur déterminé).
- **3 ops** actifs.

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
        emit match:confirmed → 2 joueurs ; broadcast leaderboard:update
POST /matches/:id/reject (adversaire) → CREATE RejectedMatch ; DELETE PendingMatch
                           emit match:rejected → déclarant
```

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
POST /tournaments/:id/join  ajoute TournamentEntry ; si plein → génère le bracket, status=in_progress
POST /tournaments/:id/start (organisateur, si plein)  → génère bracket, status=in_progress
record → confirm (par l'AUTRE joueur) :
        winner avance dans la case (round+1, slot/2) ; à la finale → status=finished,
        winnerLogin renseigné, user.tournamentsWon++
```
La génération du bracket et l'avancement vivent dans `apps/backend/src/tournament.ts`.

### Ops (vantardise)
```
POST /ops  (1 ops actif max par owner ; cooldown 7j ; cibles non déjà engagées)
           CREATE Ops (expiresAt = now + 7j) ; scheduleOpsTimers(expiry, cooldown)
           emit ops:update → [owner, target]
À l'expiration / fin de cooldown : timer setTimeout → emit ops:update (ré-armés au boot du serveur).
```

### Clôture d'une saison (`POST /seasons/close`, transaction)
```
saison active → pour chaque joueur visible : SeasonStanding {rank, elo, wins, losses}  (snapshot figé)
                1er du classement → UserBadge 'season_champion' (upsert)
                User.updateMany { elo: 1000, matchesPlayed: 0 }   ← reset ELO de toute la ligue
                Season { isActive: false, endedAt: now }
                notify(champion) ; broadcast data:update + leaderboard:update
```
L'historique des `PlayedMatch` est **conservé** (taggé `seasonId`) ; seules les notes ELO repartent à zéro.

---

## 6. Patterns de conception

1. **Clé primaire métier** : `User.login` (pas d'id surrogate) — l'identité vient de l'intra.
2. **Ordre canonique des paires** (`PlayedMatch`) → dédoublonnage + anti-farming simples.
3. **Cascade maîtrisée** : `Tournament` supprime ses entries/matches en cascade ; les FK joueur
   sont en `Restrict` (jamais supprimer un user référencé) + `onUpdate: Cascade` (renommer un login
   propage → sert à l'anonymisation RGPD).
4. **Soft-flags temporels** : `bannedAt`, `deletionScheduledAt`, `anonymizedAt` plutôt que suppression
   dure — la suppression RGPD est différée (période de grâce) puis matérialisée par anonymisation.
5. **Audit append-only** : aucune route ne modifie/supprime `AdminAuditLog` (sauf purge RGPD 24 mois).
6. **États en `String`** (pas d'enum DB) pour `status`/`kind`/`winner` : la validation se fait côté
   applicatif (Zod), ce qui évite une migration à chaque nouvel état.
