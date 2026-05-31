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
`REFRESH_IMAGES`, `RESET_DATABASE` (reset complet de la ligue par un SUPERADMIN).

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

Index : `(playerALogin, playerBLogin, playedAt)` — sert au calcul anti-farming (matchs antérieurs
de la paire dans la fenêtre).

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
Bracket à élimination directe.

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| `id` | String (uuid) | non | — | |
| `name` | String | non | — | 2–60 car. |
| `kind` | String | non | `friendly` | `friendly` \| `official` (officiel = réservé `isAdmin`). |
| `capacity` | Int | non | — | Validé à **2 ou 4** à la création (`CreateTournamentSchema`). Puissance de 2. |
| `status` | String | non | — | `registration` \| `in_progress` \| `finished` \| `cancelled` |
| `createdByLogin` | String | non | — | Organisateur. |
| `winnerLogin` | String | oui | — | FK `onDelete: SetNull`. |
| `createdAt` | DateTime | non | `now()` | |
| `startedAt` / `finishedAt` | DateTime | oui | — | |

Index : `(status)`. Relations : `entries` (→ `TournamentEntry`), `matches` (→ `TournamentMatch`).

> Note : la donnée de seed contient un ancien tournoi de capacité 8. Le champ DB est un `Int`
> non contraint ; c'est la validation applicative actuelle qui restreint les **nouveaux** tournois à 2 ou 4.

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
Une case du bracket.

| Champ | Type | Null | Notes |
|---|---|---|---|
| `id` | String (uuid) | non | |
| `tournamentId` | String | non | `onDelete: Cascade`. |
| `round` | Int | non | 1 = premier tour. |
| `slot` | Int | non | Position dans le tour (0-indexé). |
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
| `expiresAt` | DateTime | non | `declaredAt + 7 jours` |

Index : `(ownerLogin, expiresAt)`, `(targetLogin, expiresAt)`. Un ops est « actif » tant que
`expiresAt > now`. Après expiration, un **cooldown de 7 jours** empêche l'owner de redéclarer.

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
| 13 | `20260531000000_add_deletion_scheduled_at` | `User.deletionScheduledAt` (suppression RGPD différée). |
| 14 | `20260531010000_add_reset_database_action` | Valeur `RESET_DATABASE` dans l'enum `AdminAction`. |

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
| `add-test-notif.ts` | `npm run db:add-notif -w @42-league/backend` | Crée des situations déclenchant des notifications. |

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
