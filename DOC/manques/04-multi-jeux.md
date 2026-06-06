# Manques — Multi-disciplines

> Document d'audit des **manques, incomplétudes et asymétries** du domaine
> **multi-disciplines** de 42 League : le *game registry* partagé
> (`packages/shared/src/games.ts`), les cinq disciplines (babyfoot, smash, échecs,
> street fighter, fléchettes), leurs spécificités (ELO par jeu, FFA, 2v2, persos /
> stocks / best-of, 301/501), et la couche de normalisation des stats par jeu
> (`PlayerGameStat`, préparée mais non migrée).
>
> Périmètre **strictement** multi-jeu : ce qu'une discipline a et que les autres
> n'ont pas, les fonctionnalités partielles, les chemins de code asymétriques, les
> trous de tests / d'i18n par jeu, et la procédure d'ajout d'un nouveau jeu.
>
> Les manques transverses (économie, tournois génériques, RGPD…) ne sont traités
> ici **que** sous l'angle de leur asymétrie entre disciplines.

---

## Table des matières

- [Vue d'ensemble — la matrice des asymétries](#vue-densemble--la-matrice-des-asymétries)
- [1. Registry partagé (`games.ts`)](#1-registry-partagé-gamests)
  - [1.1 `elo()` du registry inutilisé / trompeur pour FFA, darts, SF](#11-elo-du-registry-inutilisé--trompeur-pour-ffa-darts-sf)
  - [1.2 `advantage` du registry : code mort depuis la simplification du toss](#12-advantage-du-registry--code-mort-depuis-la-simplification-du-toss)
  - [1.3 Le registry ne décrit pas les capacités d'une discipline (FFA / 2v2 / tournoi)](#13-le-registry-ne-décrit-pas-les-capacités-dune-discipline-ffa--2v2--tournoi)
  - [1.4 `parseGameId` / `GameSchema` : liste de disciplines dupliquée 5+ fois](#14-parsegameid--gameschema--liste-de-disciplines-dupliquée-5-fois)
  - [1.5 `validateTournamentScore` : fléchettes renvoie une erreur au lieu d'être filtré en amont](#15-validatetournamentscore--fléchettes-renvoie-une-erreur-au-lieu-dêtre-filtré-en-amont)
- [2. Normalisation — `PlayerGameStat` non migré](#2-normalisation--playergamestat-non-migré)
- [3. Babyfoot](#3-babyfoot)
- [4. Smash](#4-smash)
- [5. Street Fighter](#5-street-fighter)
- [6. Échecs (chess)](#6-échecs-chess)
- [7. Fléchettes (darts/flechettes)](#7-fléchettes-dartsflechettes)
- [8. Transverse : équilibrage ELO inter-jeux](#8-transverse--équilibrage-elo-inter-jeux)
- [9. Transverse : historique, stats & trophées par jeu](#9-transverse--historique-stats--trophées-par-jeu)
- [10. Transverse : tests par discipline](#10-transverse--tests-par-discipline)
- [11. Transverse : i18n par discipline](#11-transverse--i18n-par-discipline)
- [12. Transverse : procédure d'ajout d'un nouveau jeu](#12-transverse--procédure-dajout-dun-nouveau-jeu)

---

## Vue d'ensemble — la matrice des asymétries

Tableau récapitulatif des fonctionnalités **présentes (✅) / absentes (❌) / partielles (◐)**
par discipline. C'est la cartographie de référence des trous documentés en détail plus bas.

| Capacité | babyfoot | smash | streetfighter | chess | flechettes |
|---|:--:|:--:|:--:|:--:|:--:|
| Match 1v1 classé | ✅ | ✅ | ✅ | ✅ | ❌ (multijoueur only) |
| Match 2v2 (équipes) | ✅ | ❌ | ❌ | ❌ | ❌ |
| FFA / multijoueur N>2 | ❌ | ✅ (FFA) | ❌ | ❌ | ✅ (301/501) |
| Tournoi 1v1 | ✅ | ✅ | ✅ | ✅ | ❌ |
| Tournoi 2v2 | ✅ | ❌ | ❌ | ❌ | ❌ |
| Défi planifié (challenge) | ✅ (+2v2) | ✅ | ✅ | ✅ | ◐ (pas de challenge darts) |
| Matchmaking aléatoire | ✅ | ✅ | ✅ | ✅ | ◐ |
| Personnages / roster | ❌ | ✅ | ✅ | ❌ | ❌ |
| Favoris (« mains ») | ❌ | ✅ `favSmash` | ✅ `favSf` | ❌ | ❌ |
| Best-of / stocks | ❌ | ✅ | ✅ | ❌ | ❌ |
| Match nul | ❌ | ❌ | ❌ | ◐ (saisie OK, `formatScore` "futur") | ❌ |
| Colonnes ELO/compteurs dédiées | ✅ | ✅ | ✅ | ✅ | ✅ |
| Grade ELO + Grand Master positionnel | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tests ELO unitaires | ✅ | ✅ | (= smash) | ✅ | ❌ (`calculateDartsElo` non testé) |
| OPS (la chasse) | ✅ | ◐ | ◐ | ◐ | ❌ (1v1 only, ignoré 2v2) |

> Lecture rapide des **trois grands déséquilibres** :
> 1. **babyfoot** est la seule discipline « riche » : 2v2, tournois 2v2, défis 2v2.
> 2. **smash/SF** sont les seules à porter des **persos** ; SF est un clone de Smash sans rien de propre côté logique.
> 3. **fléchettes** est une discipline de seconde zone : multijoueur uniquement, **pas de tournoi**, pas de tests ELO, et plusieurs chemins de code la traitent par exception plutôt que par capacité déclarée.

---

## 1. Registry partagé (`games.ts`)

### 1.1 `elo()` du registry inutilisé / trompeur pour FFA, darts, SF

- **État actuel** (`packages/shared/src/games.ts:99-100`, `135-136`, `148-160`)
  - `smash.elo` et `streetfighter.elo` pointent **tous deux** sur `calculateSmashElo`
    (pas d'abstraction : duplication littérale de la lambda).
  - `flechettes.elo` est un **repli binaire** sur `calculateChessElo` explicitement
    documenté comme *« inutilisé »* (commentaire ligne 145-147) : le vrai ELO darts
    passe par `calculateDartsElo` sur le chemin `/matches/darts` du backend.
  - Le registry n'expose **aucune** entrée pour le calcul FFA (`calculateFfaElo`) :
    `applyGameElo` ne sait faire que du 2-joueurs.
- **Ce qui manque / problème**
  - Le `elo()` du registry est censé être *« le point d'entrée unique, toutes
    disciplines »* (`applyGameElo`, `games.ts:200-208`), mais il est **faux pour 2
    des 5 disciplines** : darts a un `elo()` factice et le multijoueur (FFA/darts)
    contourne complètement le registry. On a deux sources de vérité ELO : le registry
    (1v1) et des fonctions libres appelées en direct dans `index.ts`.
  - Un futur contributeur qui appellera `applyGameElo('flechettes', …)` ou
    `applyGameElo('smash', …)` pour un FFA obtiendra un résultat **silencieusement
    erroné** (binaire au lieu de marge multijoueur). Aucun garde-fou type ne l'empêche.
- **Fichiers concernés**
  - `packages/shared/src/games.ts` (def `elo`, `applyGameElo`)
  - `packages/shared/src/elo.ts` (`calculateFfaElo`, `calculateDartsElo` hors registry)
  - `apps/backend/src/index.ts` (settlement FFA ~`2813`, darts ~`3125`)
- **Piste d'implémentation**
  - Étendre `GameDef` avec un descripteur de mode : `scoreShape: '1v1' | 'ffa'`, et
    un `eloMulti?(ratings, extras): number[]` pour les disciplines multijoueur. Router
    le settlement FFA/darts via le registry au lieu d'appels directs.
  - À défaut, au minimum : faire que `flechettes.elo` **jette** (`throw`) plutôt que de
    retourner un faux résultat binaire, pour transformer le bug silencieux en erreur visible.
- **Effort** M · **Priorité** Moyenne

### 1.2 `advantage` du registry : code mort depuis la simplification du toss

- **État actuel**
  - `GameDef.advantage` (`games.ts:62-72`) décrit, **par jeu**, le choix d'avantage du
    gagnant du pile-ou-face (balle/terrain, couleur, stage, commencer) + `getGameAdvantage`
    (`games.ts:186-194`).
  - Côté backend : route `POST /tournaments/:id/matches/:matchId/advantage`
    (`index.ts:5256-5291`) qui valide `advantagePick` contre les options du jeu.
  - Côté front : composant `components/tournois/AdvantagePicker.tsx`.
  - **MAIS** `DOC/DOMAIN.md §6` (lignes 196-203) acte que le toss a été **simplifié** :
    *« il n'y a plus de choix d'avantage dans l'appli — l'avantage … est réglé dans la
    vraie vie »*. Le toss ne fait plus que désigner le gagnant du tirage (`tossSide`).
- **Ce qui manque / problème**
  - **Désynchronisation doc/code** : soit la doc ment, soit le code porte une
    fonctionnalité morte (`advantage` par jeu, route `/advantage`, `AdvantagePicker`,
    colonne `TournamentMatch.advantagePick`). Dans les deux cas, c'est un piège.
  - L'asymétrie « par jeu » de `advantage` (complementary vs unique, options propres)
    n'a plus de consommateur si la doc dit vrai → effort de maintenance par discipline
    pour rien (chaque nouveau jeu doit définir un `advantage` jamais affiché).
- **Fichiers concernés**
  - `packages/shared/src/games.ts` (`advantage`, `getGameAdvantage`)
  - `apps/backend/src/index.ts:5256-5291` (route `/advantage`)
  - `apps/web/src/components/tournois/AdvantagePicker.tsx`
  - `apps/backend/prisma/schema.prisma:352` (`advantagePick`)
- **Piste d'implémentation**
  - Trancher : (a) **réactiver** le choix d'avantage in-app (rendre `AdvantagePicker`
    + route, et corriger DOMAIN.md), ou (b) **supprimer** `advantage`/`getGameAdvantage`,
    la route `/advantage`, le composant et la colonne, et garder uniquement le toss
    coin-flip. Une grep d'usage de `AdvantagePicker` montre qu'il est encore importé
    mais qu'il n'est pas clair qu'il soit monté.
- **Effort** S (suppression) / M (réactivation) · **Priorité** Moyenne (dette / piège doc)

### 1.3 Le registry ne décrit pas les capacités d'une discipline (FFA / 2v2 / tournoi)

- **État actuel**
  - `GameDef` décrit le **scoring** et l'**ELO** d'un jeu, mais **pas** ses capacités
    structurelles : peut-il faire du 2v2 ? du FFA ? un tournoi ? un challenge planifié ?
  - Ces capacités sont éparpillées en règles ad hoc :
    - 2v2 réservé au babyfoot → `refine` Zod (`schemas.ts:261-265`).
    - FFA réservé au smash → `z.literal('smash')` (`schemas.ts:419`) + filtre
      `where: { game: 'smash' }` côté FFA, `game: 'flechettes'` côté darts.
    - Tournoi fléchettes interdit → message en dur dans `validateTournamentScore`
      (`games.ts:235-237`) + commentaire `schema.prisma:254` *« game: 'babyfoot' | 'smash' »*.
- **Ce qui manque / problème**
  - Pas de **source unique** déclarant « babyfoot supporte le 2v2 », « smash supporte le
    FFA », « fléchettes n'a pas de tournoi ». Le savoir est dispersé entre Zod, le registry,
    des littéraux et des commentaires Prisma → ajouter une 6ᵉ discipline oblige à retrouver
    tous ces points (cf. §12).
  - Les commentaires de `schema.prisma` (`Tournament.game`, `Challenge.game`) listent
    encore *« babyfoot | smash »* alors que 4 disciplines ont des tournois → **doc inline
    obsolète**.
- **Fichiers concernés**
  - `packages/shared/src/games.ts`, `schemas.ts`
  - `apps/backend/prisma/schema.prisma:254`, `:369` (commentaires obsolètes)
- **Piste d'implémentation**
  - Ajouter au `GameDef` un bloc `capabilities: { team2v2: boolean; ffa: boolean;
    tournament: boolean; challenge: boolean }`. Faire dériver les `refine` Zod, les
    filtres de routes et le front de ce bloc. Mettre à jour les commentaires Prisma.
- **Effort** M · **Priorité** Moyenne

### 1.4 `parseGameId` / `GameSchema` : liste de disciplines dupliquée 5+ fois

- **État actuel** — la liste littérale des disciplines est **réécrite à la main** à
  plusieurs endroits :
  - `parseGameId` (`games.ts:171-178`) : `value === 'smash' || … || 'flechettes'`.
  - `GameSchema` (`schemas.ts:15`) : `z.enum([...])`.
  - Backend onboarding (`index.ts:1129`) : `g === 'babyfoot' || g === 'smash' || …`.
  - Front `gameMode.ts:6,13` : type `Game` + `readInitial` réécrivent la liste.
  - `AnalyticsEvent.game`, `Notification.game` : commentaires listant les valeurs.
- **Ce qui manque / problème**
  - `GAME_IDS` existe (dérivé de `GAMES`) **mais** n'est pas utilisé comme source pour
    ces validations : `parseGameId` n'itère pas sur `GAMES`, il code la liste en dur.
    Ajouter un jeu = modifier 5+ listes manuelles, dont une oubliée = bug silencieux
    (le jeu existe dans `GAMES` mais `parseGameId` le rabat sur babyfoot).
  - Le type `Game` côté front (`gameMode.ts`) est **dupliqué** au lieu d'être importé du
    shared — risque de dérive front/back.
- **Fichiers concernés**
  - `packages/shared/src/games.ts`, `schemas.ts`
  - `apps/backend/src/index.ts:1129`
  - `apps/web/src/lib/gameMode.ts`
- **Piste d'implémentation**
  - `parseGameId` : `return (GAME_IDS as string[]).includes(value as string) ? value : DEFAULT_GAME`.
  - `GameSchema` : construire l'enum depuis `GAME_IDS` (`z.enum(GAME_IDS as [GameId, …])`).
  - Front : importer `Game`/`GAME_IDS` du shared au lieu de redéclarer.
- **Effort** S · **Priorité** Moyenne (anti-régression à l'ajout de jeu)

### 1.5 `validateTournamentScore` : fléchettes renvoie une erreur au lieu d'être filtré en amont

- **État actuel** (`games.ts:235-237`) — `case 'darts'` retourne le message
  *« les fléchettes ne se jouent pas en tournoi »*. C'est une garde **a posteriori** :
  on n'aurait jamais dû créer un `TournamentMatch` fléchettes.
- **Ce qui manque / problème**
  - La validation de score sert de **filet de capacité** (cf. §1.3) : la vraie règle
    « pas de tournoi fléchettes » n'est pas vérifiée à la **création** du tournoi
    (`CreateTournamentSchema` accepte `game: 'flechettes'` — aucun `refine` ne l'exclut).
    On peut donc créer un tournoi fléchettes ; il ne se cassera qu'au premier score saisi.
  - Incohérence avec le 2v2 qui, lui, est bien bloqué à la création
    (`schemas.ts:262 refine mode !== '2v2' || game === 'babyfoot'`).
- **Fichiers concernés**
  - `packages/shared/src/schemas.ts` (`CreateTournamentSchema`)
  - `packages/shared/src/games.ts` (`validateTournamentScore`)
- **Piste d'implémentation**
  - Ajouter un `refine` à `CreateTournamentSchema` : `game !== 'flechettes'` (ou, mieux,
    dériver de `capabilities.tournament`, cf. §1.3). Garder le `case 'darts'` comme
    double sécurité.
- **Effort** S · **Priorité** Moyenne (bug de cohérence exploitable)

---

## 2. Normalisation — `PlayerGameStat` non migré

- **État actuel**
  - Les stats par discipline sont stockées **en colonnes plates** sur `User` :
    `elo`/`matchesPlayed`/`tournamentsWon` (babyfoot) + 4 triplets suffixés
    `*Smash`, `*Chess`, `*Sf`, `*Flechettes` (`schema.prisma:28-47`).
  - Le « pont Prisma » `apps/backend/src/games.ts` (`COLUMNS`, `readElo`,
    `ratingUpdate`, `eloOrderBy`, `projectStats`, `tournamentsWonDelta`) isole déjà ce
    mapping : *« le SEUL endroit du backend qui connaît les noms eloSmash, eloChess… »*
    (`games.ts:16-22`).
  - `DOC/pending.md:19` : *« Normalisation des colonnes par-jeu en table
    `PlayerGameStat` (préparée par le game registry, pas encore migrée). »*
  - `DOC/DATABASE.md` (point 4, ligne ~847) acte le choix actuel *« multi-jeu par colonnes »*.
- **Ce qui manque / problème**
  - **Coût O(N) par discipline à chaque ajout de jeu** : aujourd'hui ajouter une
    discipline = 3 colonnes Prisma + 1 migration + 1 entrée `COLUMNS` + maj du type
    `RatingColumns` + maj du front `gameStats.ts` (`pickRating`, `RatingSource`). Avec
    `PlayerGameStat (login, game, elo, matchesPlayed, tournamentsWon)`, un nouveau jeu
    n'ajouterait **aucune colonne**.
  - Le front `pickRating` (`apps/web/src/lib/gameStats.ts:25-60`) **réimplémente** le
    mapping colonnes→discipline en `if/else` côté client (duplication du `COLUMNS`
    backend) — chaque jeu ajouté oblige à toucher ce fichier aussi.
  - `RatingSource` rend tous les champs par-jeu **optionnels** (`eloSmash?`, …) avec
    fallback `?? 1000`/`?? 0` : un trou de données passe inaperçu.
  - `eloOrderBy` produit un `orderBy` dynamique (`{ [col]: 'desc' }`) qui empêche
    un **index composite** propre par discipline ; avec une table dédiée on aurait
    `@@index([game, elo])` et des classements plus efficaces.
  - Tant que ce n'est pas migré, **toute** la promesse du registry (« ajouter un jeu =
    une entrée ») est fausse : il faut encore migrer le schéma.
- **Fichiers concernés**
  - `apps/backend/prisma/schema.prisma` (modèle `User`, colonnes par-jeu ; futur `PlayerGameStat`)
  - `apps/backend/src/games.ts` (`COLUMNS` et tout le pont)
  - `apps/web/src/lib/gameStats.ts` (`pickRating`, `RatingSource`)
  - `apps/backend/src/index.ts` (reset de saison `1832-1840`, leaderboard, settlement, `toPublicUser` `1919-1974`)
  - `DOC/DATABASE.md` §migration, `DOC/pending.md:19`
- **Piste d'implémentation**
  - Créer `model PlayerGameStat { login, game, elo @default(1000), matchesPlayed,
    tournamentsWon, @@id([login, game]), @@index([game, elo]) }`.
  - Migration de données : projeter les 5 triplets de `User` en 5 lignes par joueur
    (skip les disciplines à 1000/0/0 si on veut un mode *lazy create*).
  - Réécrire `apps/backend/src/games.ts` pour lire/écrire `PlayerGameStat` ; **les
    appelants restent stables** (c'est l'intérêt du pont). Adapter `eloOrderBy` →
    requête sur `PlayerGameStat`. Conserver `User.elo` (babyfoot) un temps en lecture
    pour la compat, ou tout basculer d'un coup.
  - Front : remplacer `pickRating` par une lecture d'un tableau `gameStats[]` renvoyé
    par l'API (supprime le `if/else` dupliqué).
  - **Attention** : la migration touche le reset de saison, le leaderboard, le GOAT
    (reconstruction ELO all-time), les snapshots `SeasonStanding` → migration à fort
    rayon de blast, à tester intégralement.
- **Effort** L · **Priorité** Moyenne (dette structurante ; bloquante avant 6ᵉ/7ᵉ discipline)

---

## 3. Babyfoot

> Discipline de référence et **seule** à avoir reçu les fonctionnalités « riches »
> (2v2, équipes, tournois 2v2). Ses manques sont surtout des **trop-pleins** que les
> autres disciplines n'ont pas — donc des asymétries.

### 3.1 Le 2v2 est exclusif au babyfoot et non généralisable

- **État actuel**
  - Tout le 2v2 est verrouillé sur babyfoot : `Declare2v2MatchSchema`,
    `CreateChallenge2v2Schema`, `model BabyfootTeam`, colonnes `mode:'2v2'`,
    `partner*`/`playerA2`/`teamA` sur `PendingMatch`/`PlayedMatch`, ELO d'équipe
    pondéré 65/35 (`packages/shared/src/elo2v2.ts` via `initTeamElo`), refine Zod
    `mode !== '2v2' || game === 'babyfoot'` (`schemas.ts:261-265`).
  - Le commentaire de `CreateTournamentSchema:262` justifie : *« 2v2 réservé au
    babyfoot (seule discipline avec un système d'équipes) »*.
- **Ce qui manque / problème**
  - Le modèle s'appelle `BabyfootTeam` (et non `Team`/`GameTeam`) → **non réutilisable**
    pour un éventuel 2v2 smash/SF (qui existe pourtant compétitivement : Smash doubles,
    SF n'a pas de doubles mais d'autres jeux oui). Le nommage fige la discipline.
  - Le 2v2 ne porte **aucune** des spécificités smash (persos, stocks, best-of) : il est
    structurellement babyfoot-only, même si on voulait l'ouvrir.
- **Fichiers concernés**
  - `apps/backend/prisma/schema.prisma` (`BabyfootTeam`, colonnes 2v2)
  - `packages/shared/src/elo2v2.ts`, `apps/backend/src/babyfoot2v2.ts`
  - `packages/shared/src/schemas.ts` (schémas 2v2)
- **Piste d'implémentation** — si le 2v2 multi-jeu est voulu : renommer `BabyfootTeam`
  → `Team` + colonne `game`, généraliser l'ELO d'équipe, dériver l'autorisation de
  `capabilities.team2v2` (§1.3). Sinon : documenter explicitement que c'est un choix
  produit définitif.
- **Effort** L · **Priorité** Basse (sauf demande produit)

### 3.2 OPS (la chasse) ignore le 2v2 et n'est pas décliné par discipline

- **État actuel** — l'OPS est *« strictement 1v1 → ignorée pour les matchs 2v2 »*
  (`index.ts:2636`). L'OPS lit l'ELO **babyfoot** implicitement (`estimatedEloLoss`
  sur l'elo global) pour calculer la pénalité de refus.
- **Ce qui manque / problème** — l'OPS n'a **aucune notion de discipline** : un
  traqueur force des matchs… dans quel jeu ? La pénalité de refus
  (`OPS_REFUSE_MULTIPLIER × estimatedEloLoss`) s'applique sur l'ELO babyfoot quel que
  soit le mode où l'on traque. Sur smash/échecs/SF/fléchettes, l'OPS est donc soit
  inapplicable, soit incohérent. (Détaillé aussi dans le doc OPS, listé ici pour l'asymétrie.)
- **Fichiers concernés** — `apps/backend/src/index.ts` (logique OPS), `packages/shared/src/elo.ts` (constantes OPS).
- **Piste d'implémentation** — porter un `game` sur l'OPS, ou documenter que l'OPS est babyfoot-only.
- **Effort** M · **Priorité** Basse

---

## 4. Smash

### 4.1 Persos saisis mais sous-exploités en stats / historique

- **État actuel**
  - `PlayedMatch.charA/charB` stockent le perso (`schema.prisma:439-440`), encodage
    par-manche possible (`mario>luigi>mario`, `MatchCharSchema` max 300, `schemas.ts:22`).
  - `stocksA/stocksB` stockent les vies du gagnant au game décisif (`schema.prisma:441-442`).
  - Favoris `favSmash` (`schema.prisma:55`).
- **Ce qui manque / problème**
  - Aucune **statistique agrégée par perso** : winrate par personnage, perso le plus
    joué, matchup chart — alors que la donnée est saisie à chaque match. Le perso est
    purement décoratif dans l'historique.
  - `winnerStocks` n'alimente l'ELO que via le multiplicateur `M` (`calculateSmashElo`,
    `elo.ts:111-150`), mais **pas** de trophée/stat « perfect 3-stock » côté agrégé
    (le front `trophies.ts:43` a `stockPerfect` mais c'est local à l'historique chargé).
- **Fichiers concernés** — `apps/backend/src/index.ts` (settlement smash ~`2434-2498`), `apps/web/src/lib/trophies.ts`, `gameStats.ts`.
- **Piste d'implémentation** — endpoint d'agrégat perso (`/users/:login/smash/chars`), ou vue front sur l'historique complet ; exposer un winrate par main.
- **Effort** M · **Priorité** Basse

### 4.2 FFA Smash : pas d'historique perso ni de persos en FFA

- **État actuel** — le FFA réutilise `PendingFfa`/`PlayedFfa` (`schema.prisma:466-541`),
  classement par position (`calculateFfaElo`, `elo.ts:172-187`). Aucun champ perso sur
  les participants FFA.
- **Ce qui manque / problème** — le 1v1 smash a des persos, le **FFA smash n'en a pas**
  (asymétrie interne à la même discipline). Pas de `stocks` non plus en FFA.
- **Fichiers concernés** — `schema.prisma` (`PlayedFfaParticipant`), `schemas.ts:418-445` (`DeclareFfaSchema`).
- **Piste d'implémentation** — ajouter `char?` optionnel sur `PendingFfaParticipant`/`PlayedFfaParticipant` si désiré.
- **Effort** M · **Priorité** Basse

### 4.3 `defaultBestOf` non typé / pas de Bo7

- **État actuel** — `SMASH_BEST_OF = [3, 5]` (`elo.ts:89`), `SmashBestOfSchema =
  union(3,5)` (`schemas.ts:17`), `defaultBestOf: 3` dans le registry.
- **Ce qui manque / problème** — pas de Bo7 (fréquent en finale de tournoi). Le best-of
  d'un **match de tournoi** est ignoré : `TournamentRecordSchema` ne stocke pas `bestOf`
  (`schemas.ts:293`, commentaire `games.ts:217-218` *« les tournois ne stockent pas
  bestOf/persos »*) → un set smash de tournoi est validé en « 1 à 3 games » sans contrôle
  du format réel.
- **Fichiers concernés** — `packages/shared/src/elo.ts`, `schemas.ts`, `games.ts` (`validateTournamentScore` case `sets`).
- **Piste d'implémentation** — porter `bestOf` sur `TournamentMatch` si on veut un vrai format de tournoi smash ; sinon documenter la limite.
- **Effort** M · **Priorité** Basse

---

## 5. Street Fighter

### 5.1 Clone intégral du Smash sans aucune spécificité mécanique

- **État actuel**
  - SF est *« mécaniquement identique au Smash »* : même `scoring: 'sets'`, même
    `calculateSmashElo` (`games.ts:127-144`), même refine Zod (`schemas.ts:78` :
    `m.game === 'smash' || m.game === 'streetfighter'`), seul le roster
    (`apps/web/src/lib/sf.ts`) et le branding diffèrent.
  - Colonnes dédiées `eloSf`/`matchesPlayedSf`/`tournamentsWonSf`, favoris `favSf`.
- **Ce qui manque / problème**
  - SF **réutilise le concept de `stocks`** de Smash (`winnerStocks`) alors que Street
    Fighter n'a **pas de stocks** (c'est un VS fighting à rounds/barre de vie). Le
    multiplicateur de domination ELO de SF est donc piloté par un signal **inexistant
    dans le jeu réel** (`calculateSmashElo` lit `winnerStocks ?? 1`, `elo.ts:118`). Pour
    SF, les « stocks » sont sémantiquement faux → soit toujours 1 (pas de bonus de
    domination), soit saisis à tort comme des vies.
  - Pas de notion propre à SF (rounds gagnés, perfect round, vie restante %) : la
    discipline est un Smash repeint.
- **Fichiers concernés**
  - `packages/shared/src/games.ts:127-144`, `elo.ts` (`calculateSmashElo` partagée)
  - `packages/shared/src/schemas.ts` (refine commun smash/SF, `SmashStockSchema` appliqué à SF)
  - `apps/web/src/lib/sf.ts`
- **Piste d'implémentation** — donner à SF un signal de domination propre (ex. rounds
  ou % de vie restante) et une `calculateSfElo` dédiée ; ou assumer que `stocks` SF =
  « rounds restants » et renommer le concept. Au minimum documenter que `stocks` est
  réinterprété pour SF.
- **Effort** M · **Priorité** Basse

### 5.2 Favoris SF stockés dans une colonne distincte (pas de généralisation)

- **État actuel** — `favSmash` ET `favSf` (`schema.prisma:55-56`), `FavoritesUpdateSchema`
  ne connaît que `smash` et `streetfighter` (`schemas.ts:28-33`).
- **Ce qui manque / problème** — deux colonnes plates pour deux jeux de combat ; tout
  futur jeu à roster (Tekken, MK…) ajouterait une colonne `favXxx`. Même travers que
  §2 (colonnes par-jeu non normalisées), mais pour les favoris.
- **Fichiers concernés** — `schema.prisma` (`favSmash`/`favSf`), `schemas.ts` (`FavoritesUpdateSchema`), `apps/web/src/components/FavoriteCharsEditor.tsx`.
- **Piste d'implémentation** — table `PlayerGameFavorite (login, game, charIds[])` alignée sur `PlayerGameStat`.
- **Effort** M · **Priorité** Basse

---

## 6. Échecs (chess)

### 6.1 Match nul : saisie acceptée mais rendu/agrégats « futur »

- **État actuel**
  - `chess.hasDraw = true` (`games.ts:113`), ELO de nulle implémenté
    (`calculateChessElo` branche `winner === 'draw'`, `elo.ts:253-259`), schéma de
    saisie accepte 0-0 (`schemas.ts:70-76`).
  - **MAIS** `formatScore` commente *« la nulle (futur) se rend "½-½" »* (`games.ts:115`)
    et `DOC/DOMAIN.md:446` : *« Les nulles (échecs) sont exclues du palmarès »* / GOAT.
- **Ce qui manque / problème**
  - La nulle est **partiellement** intégrée : l'ELO sait la traiter, mais le mot
    « futur » et l'exclusion GOAT/palmarès suggèrent un support incomplet. Statut
    ambigu : le draw est-il vraiment jouable bout-en-bout (saisie → confirmation
    bilatérale → settlement → affichage → stats) ?
  - La **confirmation bilatérale** d'une nulle : le miroir de score (`DOMAIN.md §4`)
    fonctionne-t-il quand les deux saisissent 0-0 ? À vérifier (le settlement lit
    `scoreA === scoreB && hasDraw ? 'draw'`, `index.ts:2431`).
  - Trophées chess : `trophies.ts` a des cas chess (« Le Stratège ») mais l'impact des
    nulles sur winrate/séries n'est pas spécifié.
- **Fichiers concernés**
  - `packages/shared/src/games.ts` (`formatScore`), `elo.ts:253-259`
  - `apps/backend/src/index.ts:2428-2431` (détection draw au settlement)
  - `apps/web/src/lib/goat.ts`, `trophies.ts`
- **Piste d'implémentation** — auditer le chemin draw de bout en bout, lever le « futur »
  ou le documenter comme limite ; décider de l'inclusion des nulles dans GOAT/palmarès/winrate.
- **Effort** M · **Priorité** Moyenne

### 6.2 Pas de couleurs (blancs/noirs) enregistrées par partie

- **État actuel** — l'`advantage` chess propose « Les Blancs / Les Noirs »
  (`games.ts:118-125`) **mais** (cf. §1.2) le toss ne pose plus d'avantage in-app, et
  aucun champ ne stocke la couleur jouée par chaque joueur dans `PlayedMatch`.
- **Ce qui manque / problème** — impossible de calculer un winrate blancs/noirs, alors
  que c'est une stat d'échecs canonique. Asymétrie avec smash/SF qui, eux, stockent
  bien le « perso » joué (`charA/charB`).
- **Fichiers concernés** — `schema.prisma` (`PlayedMatch`), `schemas.ts` (pas de champ couleur).
- **Piste d'implémentation** — réutiliser `charA/charB` comme « white/black » pour chess, ou ajouter un champ dédié.
- **Effort** S · **Priorité** Basse

### 6.3 Tournoi échecs : `activeMatchId` sans objet (parties en parallèle)

- **État actuel** — `DOMAIN.md §6` & `schema.prisma:262-264` notent que `activeMatchId`
  (écran VERSUS « match en cours ») est *« sans objet pour les échecs (matchs joués en
  parallèle) »*.
- **Ce qui manque / problème** — l'asymétrie est documentée mais **non implémentée** :
  rien n'empêche un organisateur d'échecs de poser `activeMatchId` ; l'UI VERSUS
  s'affichera quand même. Pas de garde par discipline.
- **Fichiers concernés** — `apps/backend/src/index.ts` (route `/announce`), `apps/web` (écran VERSUS).
- **Piste d'implémentation** — désactiver `/announce` pour chess (dériver de `capabilities`, §1.3) ou assumer.
- **Effort** S · **Priorité** Basse

---

## 7. Fléchettes (darts/flechettes)

> La discipline la **plus incomplète** : multijoueur uniquement, pas de tournoi, pas
> de tests ELO, traitée par exception dans plusieurs chemins.

### 7.1 Pas de tournoi fléchettes (multijoueur incompatible bracket binaire)

- **État actuel**
  - `DOC/pending.md:18` : *« Tournoi fléchettes : non supporté (multijoueur incompatible
    bracket binaire) — à concevoir s'il est voulu. »*
  - `validateTournamentScore` case `darts` → erreur (`games.ts:235-237`).
  - **Mais** la création n'est **pas** bloquée en amont (cf. §1.5) → tournoi fantôme possible.
- **Ce qui manque / problème** — fléchettes est la **seule** discipline sans tournoi.
  Soit on l'interdit proprement (refine création), soit on conçoit un format adapté
  (poules de 4-8, classement par points, finale). Le bracket binaire actuel
  (`generateBracket`) est inadapté.
- **Fichiers concernés** — `schemas.ts` (`CreateTournamentSchema`), `apps/backend/src/tournament.ts`, `games.ts`.
- **Piste d'implémentation** — court terme : refine `game !== 'flechettes'` à la création
  (§1.5). Long terme : format « ligue/poules » multijoueur réutilisant `PlayedFfa`.
- **Effort** S (interdire) / L (concevoir) · **Priorité** Moyenne (interdiction) / Basse (format)

### 7.2 `calculateDartsElo` non couvert par les tests

- **État actuel** — couverture ELO unitaire (`packages/shared/src/`) :
  `elo.test.ts` teste `calculateBabyfootElo` (30 occ.), `calculateChessElo` (9),
  `calculateSmashElo` (9) ; `elo.ffa.test.ts` teste `calculateFfaElo` (13).
  **`calculateDartsElo` : 0 test.**
- **Ce qui manque / problème** — la fonction la plus subtile (pondération par marge
  `scored_i / (scored_i + scored_j)`, plafonnement, moyenne N-1, `elo.ts:213-237`) est
  **la seule non testée**. Les propriétés annoncées dans le commentaire (moitié haute
  gagne, milieu ~0, 2ᵉ proche du 1er perd peu, borne ±400, N=2) ne sont **vérifiées par
  rien**. Régression silencieuse possible.
- **Fichiers concernés** — `packages/shared/src/elo.ts:213-237` ; à créer : `elo.darts.test.ts`.
- **Piste d'implémentation** — calquer `elo.ffa.test.ts` : tester N=2/3/8, scores
  équilibrés vs écrasement, somme des deltas, milieu neutre, bornes, alignement des index.
- **Effort** S · **Priorité** Moyenne

### 7.3 FFA/darts partagent les tables mais sont séparés par filtre `game` fragile

- **État actuel** — `PendingFfa`/`PlayedFfa` portent `game` + `startScore`/`remaining`
  (nullable, fléchettes-only). Séparation par `where: { game: 'smash' }` (FFA) vs
  `{ game: 'flechettes' }` (darts) dans les routes (`index.ts:2858-3100` vs `3172-3412`).
- **Ce qui manque / problème**
  - Routes **dupliquées** quasi à l'identique (`/matches/ffa*` et `/matches/darts*`) :
    deux déclarations, deux confirmations, deux contestations, deux annulations — toute
    correction de bug doit être faite deux fois. Risque de divergence (ex. un fix de
    concurrence sur `FOR UPDATE` appliqué à un seul des deux).
  - Les colonnes `startScore`/`remaining` sont **nullable et hors-sujet** pour le smash
    FFA (toujours null) → schéma pollué par la cohabitation.
  - Le filtre `game` est en **dur** dans chaque route plutôt que dérivé du registry.
- **Fichiers concernés** — `apps/backend/src/index.ts` (blocs FFA `~2796-3100` et darts `~3103-3412`), `schema.prisma:466-541`.
- **Piste d'implémentation** — factoriser un handler FFA générique paramétré par
  `(game, scoringKind, eloFn)` ; le smash et les fléchettes deviennent deux
  configurations du même chemin.
- **Effort** M · **Priorité** Moyenne

### 7.4 Pas de défi planifié ni de cohérence matchmaking pour les fléchettes

- **État actuel** — les défis (`Challenge`) et le 2v2 sont 1v1/duo ; les fléchettes
  étant multijoueur (2-8), il n'y a **pas de challenge fléchettes** planifiable (le
  flux darts est une déclaration immédiate type FFA). Le matchmaking (`MatchmakingQueue`,
  `(login, game)`) accepte pourtant `game='flechettes'` (clé composite générique).
- **Ce qui manque / problème** — incohérence : un joueur peut rejoindre la file
  matchmaking fléchettes (pairing **1v1**) alors que la discipline est multijoueur et
  n'a pas de flux 1v1. À vérifier : que se passe-t-il à un pairing darts ?
- **Fichiers concernés** — `apps/backend/src/index.ts` (matchmaking `~1670-1764`), `schema.prisma` (`MatchmakingQueue`).
- **Piste d'implémentation** — exclure fléchettes (et tout jeu FFA-only) du matchmaking 1v1, ou concevoir un « lobby » multijoueur.
- **Effort** M · **Priorité** Basse

---

## 8. Transverse : équilibrage ELO inter-jeux

### 8.1 Mêmes constantes ELO pour toutes les disciplines, sans calibrage

- **État actuel** — `K = 32`, `DEFAULT_ELO = 1000`, `UPSET_GAP_COEFF = 0.04`,
  `WINNER_BONUS_CAP = 50`, `MAX_DELTA_PER_MATCH = 400` sont **globales** (`elo.ts:1-16`),
  partagées par babyfoot, smash, SF, chess, darts (et FFA via `calculateChessElo`).
- **Ce qui manque / problème**
  - Le multiplicateur de marge diffère par jeu (babyfoot `M∈[1.1,3]`, smash `M∈[1,2]`,
    chess `M=1`), mais le **K** et le **bonus d'upset** sont identiques → les amplitudes
    de variation ne sont pas calibrées par discipline (un sport à variance élevée
    comme le babyfoot 10-0 bouge plus qu'un échecs binaire, ce qui peut être voulu… ou
    pas). Aucune analyse documentée ne justifie un K commun.
  - Les volumes de matchs diffèrent énormément par discipline (babyfoot >> fléchettes) :
    un même K signifie convergence ELO très inégale entre classements peu et très joués.
- **Fichiers concernés** — `packages/shared/src/elo.ts`.
- **Piste d'implémentation** — autoriser un `K`/`config` ELO **par discipline** dans le
  registry (`GameDef.eloConfig`), même si on garde les mêmes valeurs au départ — au
  moins le levier existe.
- **Effort** M · **Priorité** Basse

### 8.2 Grade Grand Master positionnel : top 5 quel que soit le volume de la discipline

- **État actuel** — `rankTierForRank(elo, rank)` attribue Grand Master au **top 5 +
  Diamant** de **chaque** discipline (`rank.ts:60-94`, `GRANDMASTER_TOP_N = 5`).
- **Ce qui manque / problème**
  - Top 5 **absolu** indépendant de la population : sur une discipline à 6 joueurs
    (fléchettes naissantes), 5 des 6 sont Grand Master → grade dévalué. Pas de seuil de
    population minimale ni de top **%**.
  - La condition « déjà Diamant » (≥1400) atténue mais ne résout pas : si 5 joueurs
    fléchettes dépassent 1400, ils sont tous GM.
  - Le calcul du rang pour GM (`index.ts:1767-1789`) trie par discipline et marque les
    GM au reset de saison — mais l'attribution « live » (hors reset) du GM dépend du
    `rank` passé par chaque appelant, source d'incohérence si un appelant oublie de le
    fournir (`rankTierForRank` retombe alors sur le palier ELO seul).
- **Fichiers concernés** — `packages/shared/src/rank.ts`, `apps/backend/src/index.ts:1767-1840`.
- **Piste d'implémentation** — exiger un **nombre minimal de joueurs classés** par
  discipline pour activer le GM, ou passer à un top-%.
- **Effort** S · **Priorité** Basse

---

## 9. Transverse : historique, stats & trophées par jeu

### 9.1 `pickRating` front duplique le mapping colonnes→discipline

- **État actuel** — `apps/web/src/lib/gameStats.ts` (`pickRating`, `RatingSource`)
  réimplémente côté client le `COLUMNS` du backend en `if (game === 'smash') … else if
  (game === 'chess') …` (lignes 25-60).
- **Ce qui manque / problème** — double source de vérité front/back (cf. §2) ; chaque
  jeu ajouté = éditer ce fichier en plus du backend. Fallbacks `?? 1000`/`?? 0` masquent
  les trous de données.
- **Fichiers concernés** — `apps/web/src/lib/gameStats.ts`.
- **Piste d'implémentation** — API renvoie un tableau `gameStats[{game, elo, …}]` ; front itère sur `GAME_IDS`.
- **Effort** S · **Priorité** Basse (résolu par §2)

### 9.2 Trophées spécifiques inégaux entre disciplines

- **État actuel** — `apps/web/src/lib/trophies.ts` calcule des trophées **par jeu**
  (sweeps/stockPerfect pour smash/SF, « Sniper »/« Le Stratège » pour babyfoot/chess…),
  filtrés par `game` (ligne 56-59).
- **Ce qui manque / problème**
  - Couverture inégale : smash/SF ont des trophées de domination (sweep, 3-stock) ;
    **fléchettes** n'a quasiment pas de trophée dédié (pas de « 9-darter », « checkout
    élevé » — données pourtant dérivables du `remaining`/`scored`). Échecs a peu de
    trophées propres (pas de « mat en N coups », pas de « série d'invaincus »).
  - Les trophées sont calculés **côté front** sur l'historique chargé (limité) → pas de
    trophée all-time côté serveur, asymétrie de fiabilité entre joueurs très actifs et autres.
- **Fichiers concernés** — `apps/web/src/lib/trophies.ts`, `gameStats.ts`.
- **Piste d'implémentation** — étoffer le catalogue de trophées fléchettes/échecs ; envisager un calcul serveur all-time.
- **Effort** M · **Priorité** Basse

### 9.3 Pas de vue « historique multijoueur » unifiée (FFA + darts)

- **État actuel** — l'historique 1v1 (`PlayedMatch`) et l'historique multijoueur
  (`PlayedFfa`) sont des modèles distincts ; le front les agrège par jeu mais les pages
  defis/historique sont surtout pensées 1v1.
- **Ce qui manque / problème** — l'historique FFA/darts d'un joueur (sa place, son
  delta, ses adversaires) est moins riche que l'historique 1v1 (pas d'écart de score
  type goal-average, pas de H2H multijoueur).
- **Fichiers concernés** — `apps/web/src/pages/historique/*`, `H2HPage.tsx` (1v1 only).
- **Piste d'implémentation** — vue dédiée « manches multijoueur » par discipline.
- **Effort** M · **Priorité** Basse

---

## 10. Transverse : tests par discipline

### 10.1 Couverture ELO unitaire incomplète (darts, FFA partiel, SF implicite)

- **État actuel**
  - `elo.test.ts` : babyfoot, chess, smash. `elo.ffa.test.ts` : FFA.
  - **`calculateDartsElo` : aucun test** (cf. §7.2).
  - **SF** : aucun test propre — couvert *implicitement* par les tests smash (même
    fonction), mais le jour où SF aura sa logique (§5.1) il n'y aura pas de filet.
  - 2v2 (`elo2v2.ts`, `babyfoot2v2.ts`) : à confirmer (non trouvé dans les fichiers de test shared).
- **Ce qui manque / problème** — trous de couverture sur les calculs ELO les moins
  triviaux (darts) et les chemins dérivés (SF, 2v2).
- **Fichiers concernés** — `packages/shared/src/elo.ts`, `elo2v2.ts` ; tests à créer.
- **Piste d'implémentation** — `elo.darts.test.ts`, `elo.2v2.test.ts`.
- **Effort** S/M · **Priorité** Moyenne

### 10.2 Tests d'intégration HTTP centrés babyfoot 1v1

- **État actuel** — `apps/backend/test/` : `matches.itest.ts`, `challenges.itest.ts`,
  `consent.itest.ts`, `auth-coverage.itest.ts`, `smoke.itest.ts` (cf. `DOC/pending.md:11`,
  *« déclaration, confirmation, anti-farming »*).
- **Ce qui manque / problème** — pas d'itest dédié aux chemins **FFA smash**, **darts**,
  **2v2 babyfoot** (confirmations progressives à 3, contestation qui annule la manche,
  pairing matchmaking par jeu). `schemas.test.ts` ne couvre que babyfoot/chess/smash
  (grep : aucun `streetfighter`/`flechettes` testé).
- **Fichiers concernés** — `apps/backend/test/*`, `packages/shared/src/schemas.test.ts`.
- **Piste d'implémentation** — itests `ffa.itest.ts`, `darts.itest.ts`, `match2v2.itest.ts` ; étendre `schemas.test.ts` à SF/fléchettes.
- **Effort** M · **Priorité** Moyenne

---

## 11. Transverse : i18n par discipline

### 11.1 Libellés de discipline dispersés et non internationalisés uniformément

- **État actuel**
  - Labels jeu dans **plusieurs** sources : `GAMES[*].label` (shared, FR en dur :
    « Babyfoot », « Échecs »…), `GAME_META[*].label/shortLabel` (front `gameMeta.tsx`,
    FR en dur), `RANK_TIERS[*].label` (FR en dur), messages d'erreur Zod (FR/EN mixés).
  - Le front a un i18n (`apps/web/src/lib/i18n.tsx`, `lib/locales/*`).
- **Ce qui manque / problème**
  - Les libellés de discipline ne passent **pas** par l'i18n : ils sont codés en dur
    (en français) dans le shared et `gameMeta`. Une bascule de langue ne traduirait pas
    « Échecs »/« Fléchettes ». Double définition `label` (shared) vs `GAME_META.label`
    (front) → risque de divergence.
  - Messages de validation **mixtes** : Zod en anglais (`'one side must reach 10 goals'`,
    `'both characters are required'`, `schemas.ts`) vs registry en français
    (`'un camp doit atteindre 10 buts'`, `games.ts:227`). Incohérence par discipline et
    par couche.
- **Fichiers concernés** — `packages/shared/src/games.ts` (`label`, messages), `schemas.ts` (messages EN), `apps/web/src/lib/gameMeta.tsx`, `i18n.tsx`, `lib/locales/*`.
- **Piste d'implémentation** — clés i18n par discipline (`game.babyfoot.label`…) résolues
  côté front ; harmoniser la langue des messages de validation.
- **Effort** M · **Priorité** Basse

---

## 12. Transverse : procédure d'ajout d'un nouveau jeu

### 12.1 La promesse « ajouter un jeu = une entrée » est fausse en l'état

- **État actuel** — le registry promet (`games.ts:18-19`) : *« Ajouter un jeu = ajouter
  UNE entrée à GAMES (+ sa fonction d'Elo). Le cœur de l'application n'a pas à être
  touché. »* `DOMAIN.md §12` et `DATABASE.md` le répètent.
- **Ce qui manque / problème** — la réalité, mesurée sur le code, est **bien plus
  lourde**. Checklist réelle pour ajouter une discipline aujourd'hui :
  1. Entrée dans `GAMES` + `GameId`/`GameSchema` (`games.ts`, `schemas.ts`).
  2. Fonction ELO dédiée dans `elo.ts`.
  3. **3 colonnes** `User` (`elo*`/`matchesPlayed*`/`tournamentsWon*`) + **migration
     Prisma** (`schema.prisma`).
  4. Entrée `COLUMNS` + type `RatingColumns` (`apps/backend/src/games.ts`).
  5. Reset de saison (`index.ts:1832-1840`, `resetEloFor` par colonne nommée).
  6. `toPublicUser` select (`index.ts:1919-1974`, chaque `elo*` listé).
  7. Front : type `Game` (`gameMode.ts`), `GAME_META` (`gameMeta.tsx`), `pickRating`/
     `RatingSource` (`gameStats.ts`), trophées (`trophies.ts`), visuels (`gameVisuals.ts`),
     éventuel roster (`smash.ts`/`sf.ts`).
  8. `parseGameId` (liste en dur), onboarding (`index.ts:1129`, liste en dur).
  9. Commentaires Prisma à mettre à jour (`Tournament.game`, `Challenge.game`,
     `Notification.game`, `AnalyticsEvent.game`).
  10. Décider capacités (2v2 ? FFA ? tournoi ?) et toucher chaque `refine`/filtre concerné.
  11. Tests (ELO unitaire, schemas, itests) — souvent oubliés.
  - **Aucune doc ne liste cette checklist** : un contributeur la (re)découvre par
    grep, avec un risque élevé d'oubli silencieux (ex. §1.4 `parseGameId` qui rabat sur
    babyfoot, ou §2 `pickRating` qui renvoie 1000 par défaut).
- **Fichiers concernés** — tous ceux listés ci-dessus.
- **Piste d'implémentation**
  - Court terme : **écrire la checklist** « Ajouter une discipline » dans `DOC/` (ou un
    `CONTRIBUTING`), et corriger §1.4 (dériver `parseGameId`/`GameSchema` de `GAME_IDS`).
  - Moyen terme : §2 (`PlayerGameStat`) supprime les points 3-6 ; §1.3 (`capabilities`)
    supprime le point 10 ; §1.4 supprime le point 8. Après ces trois chantiers, la
    promesse « une entrée » devient **vraie**.
- **Effort** S (checklist) / L (rendre la promesse vraie) · **Priorité** Moyenne

### 12.2 Pas de test garantissant l'exhaustivité du registry

- **État actuel** — rien ne vérifie qu'un `GameId` ajouté à `GAMES` est bien câblé
  partout (colonnes, `COLUMNS`, `GAME_META`, `pickRating`…).
- **Ce qui manque / problème** — un jeu ajouté à `GAMES` mais oublié dans `COLUMNS`
  fait `crash` au runtime (accès `COLUMNS[game]` undefined) ; oublié dans `GAME_META`
  → undefined côté front. Aucun test de complétude.
- **Fichiers concernés** — `packages/shared/src/games.ts`, `apps/backend/src/games.ts`, `apps/web/src/lib/gameMeta.tsx`/`gameStats.ts`.
- **Piste d'implémentation** — test paramétré `for (const g of GAME_IDS)` asserttant la
  présence de `COLUMNS[g]`, `GAME_META[g]`, `GAMES[g].elo`, etc. (type `Record<GameId, …>`
  aide déjà côté TS, mais pas pour les structures front non typées `Record<GameId>`).
- **Effort** S · **Priorité** Moyenne

---

## Résumé

Le multi-disciplines de 42 League est piloté par un **game registry partagé** propre
sur le 1v1 mais **incomplet et asymétrique** dès qu'on sort du cadre : le `elo()` du
registry est faux/inutilisé pour fléchettes et ne gère pas le multijoueur (FFA/darts
contournent le registry), les **capacités par jeu** (2v2 babyfoot-only, FFA smash-only,
pas de tournoi fléchettes) sont éparpillées en `refine` et littéraux au lieu d'être
déclarées, et la liste des disciplines est **dupliquée 5+ fois** en dur. La
**normalisation `PlayerGameStat`** reste non migrée : les stats vivent en colonnes
plates × 5 jeux, dupliquées jusque côté front (`pickRating`), si bien que la promesse
« ajouter un jeu = une entrée » est aujourd'hui **fausse** (checklist réelle ~11 points,
non documentée). Les plus gros trous concrets : **`calculateDartsElo` non testé**,
**SF clone du Smash réutilisant des `stocks` inexistants**, **nulle échecs « futur »
ambiguë**, **tournoi fléchettes ni interdit proprement ni conçu**, et **routes FFA/darts
dupliquées**. Priorités recommandées : sécuriser `parseGameId`/`GameSchema` depuis
`GAME_IDS` (S), tester `calculateDartsElo` (S), interdire le tournoi fléchettes à la
création (S), puis engager `PlayerGameStat` + `capabilities` (L) qui rendent la promesse
du registry réelle.
