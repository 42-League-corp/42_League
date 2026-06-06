# Manques — Défis & Matchs

> Domaine **Défis 1v1, matchs, FFA, fléchettes, OPS, matchmaking** — **hors tournois**.
> Ce document recense **ce qui manque, est incomplet, fragile ou améliorable**. Il ne
> documente PAS l'existant (voir `DOC/DOMAIN.md` §1–7, §12, et `DOC/pending.md`).
> Chaque entrée suit le gabarit : État actuel → Manque → Fichiers → Piste → Effort/Priorité.
>
> Légende effort : **S** (< ½ j) · **M** (½–2 j) · **L** (> 2 j).

## Table des matières

1. [Cycle de vie & expiration des pending](#1-cycle-de-vie--expiration-des-pending)
   - 1.1 [Expiration des PendingMatch non confirmés](#11-expiration-des-pendingmatch-non-confirmés)
   - 1.2 [Expiration des PendingFfa / fléchettes](#12-expiration-des-pendingffa--fléchettes)
   - 1.3 [Expiration des défis (Challenge) jamais traités](#13-expiration-des-défis-challenge-jamais-traités)
   - 1.4 [Doublons de pending non bloqués](#14-doublons-de-pending-non-bloqués)
2. [Minimum hebdomadaire & malus d'inactivité](#2-minimum-hebdomadaire--malus-dinactivité)
3. [Anti-farming & dégressivité — trous](#3-anti-farming--dégressivité--trous)
4. [Ban / disponibilité — vérifications manquantes](#4-ban--disponibilité--vérifications-manquantes)
5. [Confirmation symétrique & contestation](#5-confirmation-symétrique--contestation)
6. [Dodge & pénalités](#6-dodge--pénalités)
7. [OPS (« la chasse »)](#7-ops--la-chasse-)
8. [Matchmaking (file d'attente)](#8-matchmaking-file-dattente)
9. [Smash FFA](#9-smash-ffa)
10. [Fléchettes 301/501](#10-fléchettes-301501)
11. [Litiges & RejectedMatch](#11-litiges--rejectedmatch)
12. [Observabilité, audit & métriques](#12-observabilité-audit--métriques)
13. [Tests manquants](#13-tests-manquants)
14. [i18n manquant / en dur](#14-i18n-manquant--en-dur)
15. [UX / a11y / divergences desktop-mobile](#15-ux--a11y--divergences-desktop-mobile)
16. [Dette technique & cohérence du modèle](#16-dette-technique--cohérence-du-modèle)

---

## 1. Cycle de vie & expiration des pending

### 1.1 Expiration des PendingMatch non confirmés
- **État actuel** : aucun mécanisme. Un `PendingMatch` ne disparaît que sur `confirm`
  (succès ou mismatch 409), `reject`, `cancel`, `force-confirm`/`force-cancel`
  (`apps/backend/src/index.ts:2524`, `:2702`, `:2764`, `:3420`, `:3459`). `pending.md:17`
  liste explicitement « Expiration des matchs pending non confirmés » comme **non fait**.
- **Ce qui manque / problème** :
  - Un score déclaré mais jamais confirmé reste **indéfiniment** dans `pending_matches`.
    L'adversaire peut volontairement « geler » un score gênant en ne confirmant jamais.
  - Effet de bord **anti-farming** : un pending zombie ne consomme pas le quota (il n'est
    pas un `PlayedMatch`), mais pollue la liste « score à valider » et les notifications
    cloche (`refId` jamais soldé → `markNotifsReadByRef` jamais appelé pour ce pending).
  - `GET /matches/pending` (`:2165`) renvoie **tous** les pendings sans filtre d'âge ni
    de joueur, donc la dette s'accumule visiblement.
- **Fichiers concernés** : `apps/backend/src/index.ts` (handlers ci-dessus + un sweeper),
  `apps/backend/prisma/schema.prisma:390` (`PendingMatch`, ajouter éventuellement un index
  sur `declaredAt`), `DOC/pending.md:17`, `DOC/DOMAIN.md` §4.
- **Piste d'implémentation** :
  - Définir `PENDING_TTL_MS` (ex. 7 j) dans `@42-league/shared`.
  - Sweeper périodique (`setInterval` au boot, sur le modèle de `rescheduleOpsTimers`
    `:5597` et du balayage anonymisation `:8248`) qui supprime les pendings `declaredAt <
    now - TTL`, émet `match:expired` (l'event existe déjà, émis seulement par force-cancel
    `:3482`) et solde les notifs (`markNotifsReadByRef`).
  - Alternative passive : filtrer les pendings expirés à la lecture **et** au moment de la
    confirmation (rejeter une confirmation tardive avec 410 Gone).
  - Décider du sort des `Challenge` `recorded` dont le pending expire (cf. 1.3).
- **Effort** M · **Priorité** moyenne.

### 1.2 Expiration des PendingFfa / fléchettes
- **État actuel** : un `PendingFfa` (Smash FFA `:2882` et fléchettes `:3196`) n'est réglé
  que lorsque **tous** les participants ont confirmé leur position/reste. Aucune purge si
  un seul participant ne confirme jamais.
- **Ce qui manque / problème** :
  - **Un seul participant non-confirmant bloque tout le FFA indéfiniment.** Plus le FFA est
    large (jusqu'à 8 en fléchettes), plus la probabilité qu'une manche reste « coincée »
    est élevée. Aucun délai, aucun rappel, aucune purge.
  - Pas de confirmation partielle exploitable : on ne peut pas régler un FFA à N-1
    confirmés (choix de design défendable, mais alors il faut une expiration).
- **Fichiers concernés** : `apps/backend/src/index.ts:2940` (ffa confirm), `:3257` (darts
  confirm), `prisma/schema.prisma:474` (`PendingFfa`), `:489` (`PendingFfaParticipant`).
- **Piste d'implémentation** : même sweeper que 1.1, étendu à `pending_ffas` ; émettre
  `ffa:cancelled` / `darts:cancelled` (events déjà gérés côté front) avec `reason:'expired'`.
- **Effort** M · **Priorité** moyenne.

### 1.3 Expiration des défis (Challenge) jamais traités
- **État actuel** : `GET /challenges` (`:3755`) filtre `status ∈ {pending, accepted}`. Un
  défi `pending` non accepté/refusé, ou `accepted` jamais joué (`record`), reste éternel.
  `scheduledAt` est dans le futur à la création (`CreateChallengeSchema`, tolérance 60 s),
  mais **rien n'expire un défi dont la date est passée**.
- **Ce qui manque / problème** :
  - Un `accepted` jamais enregistré laisse un « duel à jouer » fantôme dans la liste des
    deux joueurs ; le matchmaking en crée un à chaque appariement (`:1628`) → accumulation.
  - Le statut `expired` est cité dans le commentaire d'`/accept` (`:3892` : « refusé/annulé/
    expiré ») mais **aucun code ne pose jamais `expired`**.
  - Côté front, aucun tri/masquage des défis dont `scheduledAt` est largement dépassé.
- **Fichiers concernés** : `apps/backend/src/index.ts:3755`, `:3857`, `prisma/schema.prisma:364`
  (commentaire `status` mentionne `'declined' | 'recorded' | 'cancelled'` mais pas `expired`).
- **Piste d'implémentation** : sweeper qui passe à `expired` les `pending`/`accepted` dont
  `scheduledAt < now - GRACE` ; ajouter `expired` au commentaire de statut ; émettre
  `challenge:expired`. Côté front, badge « expiré » + bouton « relancer ».
- **Effort** M · **Priorité** basse.

### 1.4 Doublons de pending non bloqués
- **État actuel** : `POST /matches` (`:2170`) crée systématiquement un nouveau `PendingMatch`
  sans vérifier qu'un pending **identique** (même paire, même jeu) existe déjà. Idem `/matches/2v2`,
  `/matches/ffa`, `/matches/darts`.
- **Ce qui manque / problème** :
  - Un joueur peut déclarer **N fois** le même match (double-tap, impatience, mauvaise
    connexion) → N pendings, N notifications, N lignes « score à valider » pour l'adversaire,
    qui doit toutes les confirmer/rejeter une par une.
  - Pas de contrainte d'unicité en base (`PendingMatch` n'a pas d'`@@unique` sur la paire).
  - Un défi `accepted` peut être `record` plusieurs fois ? Non — `record` passe le défi à
    `recorded` (`:4123`) donc un 2e `record` renvoie 409. Mais `/matches` direct n'a pas ce
    garde-fou.
- **Fichiers concernés** : `apps/backend/src/index.ts:2170`, `:2226`, `:2882`, `:3196`.
- **Piste d'implémentation** : avant `create`, rechercher un pending récent (< quelques
  minutes) entre les mêmes participants/jeu et soit le renvoyer (idempotence), soit lever un
  409 « tu as déjà une déclaration en attente avec ce joueur ». Débounce côté front aussi.
- **Effort** S · **Priorité** moyenne.

---

## 2. Minimum hebdomadaire & malus d'inactivité
- **État actuel** : **non implémenté.** `pending.md:16` le confirme : « X matchs/semaine
  sinon malus / dégradation ELO… pas de malus d'inactivité ». Les quêtes hebdo
  (`WEEKLY_QUESTS`, `DOMAIN.md` §13) **récompensent** l'activité mais ne **pénalisent** jamais
  l'inactivité. Le seul levier de baisse passive d'ELO est le reset de saison
  (`seasonResetElo`).
- **Ce qui manque / problème** :
  - Aucune dégressivité d'ELO pour un joueur qui ne joue plus → les classements se figent,
    un joueur peut « camper » son rang en haut du leaderboard sans jouer.
  - Pas de notion de « semaine ISO sans match » côté `User` (pas de `lastPlayedAt` lisible ;
    il faudrait dériver de `PlayedMatch`).
  - Interaction avec le Grand Master positionnel (`rank.ts`) : un GM inactif garde son rang.
  - Risque d'injustice : pénaliser un joueur absent (vacances, congé) sans opt-out / gel.
- **Fichiers concernés** : nouveau module `@42-league/shared` (barème de décroissance),
  `apps/backend/src/index.ts` (job hebdo), `prisma/schema.prisma` (`User` : éventuellement
  `lastActiveWeek`, `inactivityPenalty`), `DOC/DOMAIN.md` §3/§13.
- **Piste d'implémentation** :
  - Job hebdomadaire (cron ou `setInterval` 24 h vérifiant le passage de semaine ISO via
    `isoWeekKey`) : pour chaque joueur n'ayant pas atteint `MIN_MATCHES_PER_WEEK`, appliquer
    `-X ELO` (borné, jamais sous le plancher de grade), par discipline ou global.
  - Décrémenter via une fonction partagée testée, avec garde-fous (pas sous le plancher,
    pas sur compte banni/anonymisé, exemption configurable).
  - Notifier (cloche + follower `notify*`) à l'approche de la fin de semaine.
- **Effort** L · **Priorité** moyenne (mécanique annoncée, structurante pour l'engagement).

---

## 3. Anti-farming & dégressivité — trous

### 3.1 FFA & fléchettes exemptés d'anti-farming
- **État actuel** : `settleFfaAsPlayed` (`:2807`) et `settleDartsAsPlayed` (`:3118`) posent
  **toujours** `countedForElo: true` et n'appellent **jamais** `shouldCountForElo` ni
  `farmingDecayFactor`. Le commentaire l'assume (« Un FFA compte toujours pour l'Elo »).
- **Ce qui manque / problème** :
  - Trois complices peuvent farmer de l'ELO Smash / fléchettes **en boucle** sans plafond,
    contrairement au 1v1 (max 2 comptés/paire/7 j) et au 2v2 (anti-farming par paire de teams).
  - Idem pour les **coins** : `awardMatchEconomyTx` est appelé sans `coinFactor`/`countForQuests`
    dégressé (`:2849`, `:3163`) → farming de coins illimité en FFA.
- **Fichiers concernés** : `apps/backend/src/index.ts:2807`, `:3118`, `packages/shared/src/anti-farming.ts`.
- **Piste d'implémentation** : généraliser l'anti-farming aux ensembles de joueurs
  (clé = ensemble trié des participants + jeu) ; appliquer la dégressivité du jour aux coins.
  Au minimum, dégresser les coins FFA comme en 1v1.
- **Effort** M · **Priorité** haute (faille d'intégrité économie/ELO).

### 3.2 force-result n'utilise pas le settlement partagé
- **État actuel** : `/admin/matches/force-result` (`:3672`) **réimplémente** le calcul d'ELO
  (`calculateBabyfootElo` en dur) au lieu de passer par `settlePendingAsPlayed`. Il est
  **figé sur le babyfoot 1v1** : pas de multi-jeu, pas de 2v2, `seasonId` non posé, pas de
  coins/quêtes, pas de propagation OPS.
- **Ce qui manque / problème** :
  - Incohérence : un match forcé babyfoot ne tague pas `seasonId` (`:3718` n'inclut pas
    `seasonId`) → exclu du palmarès de saison et du GOAT scopé.
  - Pas d'ELO smash/échecs/SF/fléchettes par cette route (seul `force-confirm` d'un pending
    existant `:3420` les couvre, via settlement partagé).
  - Divergence avec la propagation OPS : un match forcé n'incrémente pas `forcedUsed`.
- **Fichiers concernés** : `apps/backend/src/index.ts:3672`.
- **Piste d'implémentation** : créer un `PendingMatch` éphémère puis appeler
  `settlePendingAsPlayed`, ou factoriser un `applyResult(game, …)` partagé. Au minimum,
  poser `seasonId` et le `game`.
- **Effort** M · **Priorité** moyenne.

### 3.3 Dégressivité du jour : fenêtre « même jour » vs fuseau
- **État actuel** : `sameDayPriorCount` (utilisé `:2364`, `:2452`, `:3705`) compte les
  matchs du « même jour ». La notion de « jour » dépend de l'implémentation (UTC ?
  fuseau serveur ?) — non documentée dans `DOMAIN.md`.
- **Ce qui manque / problème** : un rematch à cheval sur minuit (UTC vs Europe/Paris) peut
  rouvrir le quota de dégressivité de façon inattendue ; comportement non testé ni documenté.
- **Fichiers concernés** : `packages/shared/src/anti-farming.ts` (def `sameDayPriorCount` /
  `farmingDecayFactor`), `DOC/DOMAIN.md` §3.
- **Piste d'implémentation** : fixer explicitement le fuseau (Europe/Paris), documenter,
  ajouter un test de bordure minuit.
- **Effort** S · **Priorité** basse.

### 3.4 Coins crédités même si anti-farming ELO ne compte pas, en 2v2 ? (à vérifier)
- **État actuel** : en 1v1 (`:2508`) et 2v2 (`:2402`), `awardMatchEconomyTx` n'est appelé
  que `if (countsForElo)`. Cohérent. Mais en FFA/darts il l'est inconditionnellement (cf. 3.1).
- **Ce qui manque / problème** : asymétrie de règle entre disciplines, source de confusion
  pour les joueurs et de dette pour le mainteneur.
- **Fichiers concernés** : `apps/backend/src/index.ts:2402`, `:2508`, `:2849`, `:3163`.
- **Piste d'implémentation** : unifier la politique (cf. 3.1) et la documenter en un seul
  endroit (`DOMAIN.md` §13, « jamais sur dodge/forcé/non-classé »).
- **Effort** S · **Priorité** basse.

---

## 4. Ban / disponibilité — vérifications manquantes

### 4.1 `assertNotBanned` absent sur confirm/reject/cancel/record/accept/decline
- **État actuel** : `assertNotBanned` n'est appelé **qu'à la déclaration** (`/matches` `:2184`,
  `/matches/2v2` `:2237`, `/matches/ffa` `:2893`, `/matches/darts` `:3208`, `/queue/join`
  `:1582`). Il **n'est PAS** appelé sur :
  - `/matches/:id/confirm` (`:2524`) — un joueur **banni après déclaration** peut confirmer
    un match et faire bouger l'ELO.
  - `/matches/:id/reject`, `/cancel` (`:2702`, `:2764`).
  - `/challenges/:id/accept`, `/decline`, `/record` (`:3857`, `:3937`, `:4057`).
  - FFA/darts confirm/contest/cancel.
- **Ce qui manque / problème** : un compte `bannedAt` non nul reste capable de **clôturer**
  des matchs en cours (l'interdiction ne couvre que l'**ouverture**). Le filet « unavailable »
  au settlement FFA (`:2979`, `:3298`) ne couvre **que banni/anonymisé/supprimé au moment du
  dernier confirm**, et **uniquement** pour FFA — pas pour le 1v1/2v2.
- **Fichiers concernés** : `apps/backend/src/index.ts` (tous les handlers cités).
- **Piste d'implémentation** : ajouter `await assertNotBanned(me)` en tête de
  confirm/reject/cancel/accept/decline/record (1v1 + FFA + darts), ou un filtre « les deux
  joueurs disponibles » dans `settlePendingAsPlayed`.
- **Effort** S · **Priorité** haute (contournement de ban).

### 4.2 Disponibilité de l'adversaire non revalidée à la confirmation 1v1/2v2
- **État actuel** : la déclaration vérifie que l'adversaire existe, a un `ftId`, n'est pas
  banni/anonymisé/supprimé (`:2187`–`:2190`). Mais entre déclaration et confirmation,
  l'adversaire peut être banni/anonymisé : `settlePendingAsPlayed` (`:2419`) ne revérifie pas
  (contrairement au FFA `:2979`).
- **Ce qui manque / problème** : un match 1v1/2v2 peut être réglé avec un participant devenu
  indisponible (incohérence avec la règle FFA).
- **Fichiers concernés** : `apps/backend/src/index.ts:2419`, `:2322`.
- **Piste d'implémentation** : revérifier la disponibilité des deux (quatre) joueurs au début
  de `settlePendingAsPlayed` / `settle2v2PendingAsPlayed`, comme le FFA.
- **Effort** S · **Priorité** moyenne.

### 4.3 OPS : pas de re-check de disponibilité à l'expiration / au règlement des paris
- **État actuel** : `opsDuelWinner` (`:7770`) compte les matchs ; ne filtre pas un joueur
  devenu indisponible. `assertTargetable` n'est vérifié qu'à `/ops` (`:5657`).
- **Ce qui manque / problème** : un OPS dont la cible est bannie pendant les 24 h continue à
  « tourner » (timers, paris à régler) sans gestion explicite.
- **Fichiers concernés** : `apps/backend/src/index.ts:5645`, `:7770`, `:7801`.
- **Piste d'implémentation** : à l'offboarding (`purgeUserFromTournaments`-like), annuler les
  OPS actifs du joueur et rembourser les paris (déjà partiellement fait pour les faux comptes
  `:3553`, mais pas pour un ban réel d'un vrai compte).
- **Effort** M · **Priorité** basse.

---

## 5. Confirmation symétrique & contestation

### 5.1 Le mismatch de score supprime le pending (perte de l'historique du litige)
- **État actuel** : sur scores non miroir, `confirm` (`:2619`) **supprime** le pending et
  lève un 409, **sans** créer de `RejectedMatch`. Seul le `reject` explicite trace un litige.
- **Ce qui manque / problème** :
  - Un désaccord de bonne foi (faute de frappe) est indistinguable d'un litige : aucune
    trace, aucune statistique de « matchs annulés pour mismatch ».
  - Pas de garde anti-boucle : deux joueurs de mauvaise foi peuvent re-déclarer / re-mismatcher
    à l'infini sans qu'aucun compteur ne s'incrémente (contrairement au dodge).
- **Fichiers concernés** : `apps/backend/src/index.ts:2619`–`:2632`, `prisma/schema.prisma:206`
  (`RejectedMatch`).
- **Piste d'implémentation** : tracer le mismatch (RejectedMatch `reason:'score_mismatch'` ou
  table dédiée) ; compteur `scoreDisputeCount` ; suggérer une re-déclaration pré-remplie côté
  front au lieu de « repartir de zéro ».
- **Effort** M · **Priorité** moyenne.

### 5.2 Pas de re-saisie symétrique en 2v2 ni en FFA
- **État actuel** : en 2v2, la confirmation est une simple **présence** (`partner1Confirmed`
  etc., `:2538`) — **aucune re-saisie du score** par l'équipe adverse. En FFA/darts, chacun
  ne reconfirme que **sa** position/reste (`:2940`, `:3257`), pas le classement complet.
- **Ce qui manque / problème** : la défense anti-spoofing « validation bilatérale » du 1v1
  (`DOMAIN.md` §4) **ne s'applique pas** au 2v2 : le déclarant fixe le score, les adversaires
  ne font qu'« accepter d'avoir joué ». Un déclarant malhonnête saisit un faux score 10-0 ;
  l'équipe adverse ne peut que **rejeter** en bloc (pas corriger).
- **Fichiers concernés** : `apps/backend/src/index.ts:2533`–`:2598` (branche 2v2),
  `prisma/schema.prisma:390` (pas de champ « score confirmé par l'adversaire » en 2v2).
- **Piste d'implémentation** : pour le 2v2, faire ressaisir le score par l'un des adversaires
  (miroir) à la dernière confirmation, comme en 1v1. Pour le FFA, c'est par construction
  (chacun confirme sa place) ; documenter la différence de modèle de confiance.
- **Effort** M · **Priorité** moyenne.

### 5.3 Le contestMessage est obligatoire (10–500 car.) — friction
- **État actuel** : `RejectMatchSchema` (`schemas.ts:120`) impose `contestMessage` 10–500
  caractères. Un joueur qui veut juste dire « jamais joué » doit écrire ≥ 10 caractères.
- **Ce qui manque / problème** : friction UX, surtout sur mobile ; pas de message
  pré-rempli selon `contestReason` (`never_played` / `wrong_score`).
- **Fichiers concernés** : `packages/shared/src/schemas.ts:120`, front sheets de contestation.
- **Piste d'implémentation** : rendre le message optionnel quand `reason='never_played'`, ou
  fournir des messages pré-remplis.
- **Effort** S · **Priorité** basse.

### 5.4 Confirmation : pas de garde sur l'identité du jeu / des persos
- **État actuel** : `confirm` (`:2606`) ne vérifie que `scoreSelf/scoreOpponent` miroir, pas
  le `game`, ni `bestOf`, ni `charSelf/charOpponent`, ni `stocks` re-saisis par l'adversaire.
- **Ce qui manque / problème** : l'adversaire valide implicitement les méta-données Smash
  (persos, bestOf, stocks) telles que **le déclarant** les a saisies — pas de contre-validation.
  Possibilité de fausses stats de personnages.
- **Fichiers concernés** : `apps/backend/src/index.ts:2600`–`:2634`, `schemas.ts:114`.
- **Piste d'implémentation** : faire ressaisir bestOf/stocks/persos miroir, ou au moins
  afficher clairement à l'adversaire ce qu'il valide.
- **Effort** M · **Priorité** basse.

---

## 6. Dodge & pénalités

### 6.1 Pénalité de dodge en dur, hors `@42-league/shared`
- **État actuel** : `const DODGE_ELO_PENALTY = 10;` est défini **dans `index.ts`** (`:3935`),
  pas dans `packages/shared/src/elo.ts` (contrairement aux constantes OPS). `DOMAIN.md` §5
  documente « −10 ELO ».
- **Ce qui manque / problème** : constante métier non partagée → le front ne peut pas
  l'afficher de façon fiable (« tu vas perdre 10 ELO ») sans la dupliquer.
- **Fichiers concernés** : `apps/backend/src/index.ts:3935`, `packages/shared/src/elo.ts`.
- **Piste d'implémentation** : déplacer `DODGE_ELO_PENALTY` dans `elo.ts` et l'importer.
- **Effort** S · **Priorité** basse.

### 6.2 Dodge : ELO peut descendre sous le plancher de grade / sous 0
- **État actuel** : le décrément dodge (`:4007`–`:4014`) et la pénalité OPS (`:3997`–`:4005`)
  font `elo: { decrement: penalty }` **sans borne basse**. La pénalité OPS = `3 ×
  estimatedEloLoss` peut être élevée.
- **Ce qui manque / problème** : un joueur peut tomber **sous 0** d'ELO via dodges/refus OPS
  répétés (aucune borne, contrairement aux coins bornés à 0 par `grantCoinsTx`).
- **Fichiers concernés** : `apps/backend/src/index.ts:3996`–`:4015`.
- **Piste d'implémentation** : borner l'ELO à un minimum (0 ou plancher Étain) après
  décrément ; le décider explicitement et documenter (`DOMAIN.md` §5).
- **Effort** S · **Priorité** moyenne.

### 6.3 Dodge non décliné par discipline / par jeu
- **État actuel** : la pénalité de dodge décrémente toujours `elo` (le rating **babyfoot**,
  `:4010`), même si le défi esquivé est en Smash/échecs/SF/fléchettes (le défi porte un `game`,
  `:4020`). La pénalité OPS aussi (`target.elo` / `hunter.elo`, `:3988`).
- **Ce qui manque / problème** : esquiver un défi d'échecs ampute l'ELO **babyfoot** — incohérent
  avec le cloisonnement par discipline (`DOMAIN.md` §12). Le `dodgeCount` est global aussi.
- **Fichiers concernés** : `apps/backend/src/index.ts:3996`–`:4015`, `:3984`–`:3988`.
- **Piste d'implémentation** : décrémenter le rating **de la discipline du défi** (via
  `ratingUpdate(game, …)` / `readElo`) ; envisager un `dodgeCount` par jeu.
- **Effort** M · **Priorité** moyenne.

### 6.4 Pas de pénalité de dodge pour un match `accepted` jamais joué (expiration)
- **État actuel** : le dodge n'est appliqué que sur `decline` explicite d'un `accepted`
  (`:3958`, `:4006`). Un joueur qui accepte puis **disparaît** (ne refuse ni ne joue) n'est
  jamais pénalisé.
- **Ce qui manque / problème** : esquive « passive » non couverte (lié à 1.3 : pas
  d'expiration de défi). Incite à ne jamais cliquer « refuser ».
- **Fichiers concernés** : `apps/backend/src/index.ts:3937`, lié à 1.3.
- **Piste d'implémentation** : à l'expiration d'un défi `accepted` non joué, appliquer le
  dodge à la (aux) personne(s) qui n'ont pas enregistré ? (Délicat : qui est fautif ?)
  Au minimum, marquer `expired` sans pénalité et clarifier la règle.
- **Effort** M · **Priorité** basse.

---

## 7. OPS (« la chasse »)

### 7.1 Timers OPS volatils (perdus au crash entre deux reschedule)
- **État actuel** : les transitions OPS (expiration, fin de cooldown) sont des `setTimeout`
  serveur (`scheduleOpsTimers` `:5576`), ré-armés au boot (`rescheduleOpsTimers` `:5597`).
  Le commentaire (`:5570`–`:5575`) reconnaît que « les setTimeout sont perdus à chaque
  redémarrage ».
- **Ce qui manque / problème** :
  - Les **lectures** filtrent `expiresAt > now` donc l'état est correct ; mais l'**event
    temps réel** `ops:update` (révélation cinématique de fin, MAJ UI) n'est **pas émis** si
    le process redémarre **après** l'expiration mais **avant** le reschedule (la fenêtre
    expirée n'est plus reschedulée → aucun event). Les clients restent sur un état périmé
    jusqu'au prochain refetch.
  - Pas de persistance « event émis oui/non » → risque de double émission ou d'omission.
- **Fichiers concernés** : `apps/backend/src/index.ts:5576`–`:5602`.
- **Piste d'implémentation** : remplacer par un balayage périodique (poll 30–60 s) qui émet
  les transitions au passage du seuil, idempotent (flag `expiredNotifiedAt`), plus robuste
  que les timers en mémoire ; ou un sweeper unique partagé avec 1.1.
- **Effort** M · **Priorité** moyenne.

### 7.2 `forcedUsed` incrémenté de façon ambiguë (forcé vs non-forcé)
- **État actuel** : `forcedUsed` est incrémenté quand **n'importe quel** match 1v1 entre
  hunter et cible est confirmé pendant l'OPS (`:2637`–`:2655`), et quand la cible refuse un
  défi du hunter (`:3989`). Il n'y a **aucune distinction** entre un match « réellement forcé »
  (imposé) et un match volontaire.
- **Ce qui manque / problème** :
  - Si hunter et cible jouent **3 matchs amicaux** classiques pendant l'OPS, le quota forcé
    est épuisé **sans qu'aucun forçage n'ait été imposé** — l'OPS « n'impose plus rien »
    (`DOMAIN.md` §7) alors que l'esprit était d'obliger la cible à **3 affrontements**.
    C'est peut-être voulu (3 affrontements quelconques) mais ce n'est **pas documenté
    clairement** et contre-intuitif vis-à-vis du libellé « matchs forcés ».
  - Un même `PlayedMatch` peut incrémenter `forcedUsed` même s'il provient d'un défi
    **non lié** à l'OPS.
- **Fichiers concernés** : `apps/backend/src/index.ts:2637`–`:2655`, `:3975`–`:3993`,
  `DOC/DOMAIN.md` §7.
- **Piste d'implémentation** : clarifier la sémantique (3 affrontements vs 3 forçages
  effectifs) ; documenter ; éventuellement marquer le match comme « forcé » (champ sur
  `PlayedMatch`) pour traçabilité et exclusion économie (cf. « jamais sur match forcé »
  `DOMAIN.md` §13 — or rien ne marque un match comme forcé aujourd'hui !).
- **Effort** M · **Priorité** moyenne.

### 7.3 « Jamais de coins sur match forcé » : règle documentée mais non implémentée
- **État actuel** : `DOMAIN.md` §13 affirme « jamais sur dodge / **match forcé** /
  non-classé ». Or `settlePendingAsPlayed` (`:2419`) crédite les coins dès que
  `countsForElo`, **sans savoir** si le match est un match OPS forcé (l'OPS n'est détecté
  qu'**après** le settlement, `:2637`). Un match OPS forcé gagné **crédite donc 50 coins**.
- **Ce qui manque / problème** : divergence doc/code ; le farming via OPS forcé n'est pas
  neutralisé côté coins.
- **Fichiers concernés** : `apps/backend/src/index.ts:2419`–`:2520`, `:2637`, `DOC/DOMAIN.md` §13.
- **Piste d'implémentation** : détecter l'OPS forcé **avant** le settlement et passer
  `countForCoins=false` à `awardMatchEconomyTx`, ou corriger la doc si le comportement
  actuel est voulu.
- **Effort** M · **Priorité** moyenne (intégrité économie + cohérence doc).

### 7.4 OPS strictement 1v1 babyfoot ? Disciplines non précisées
- **État actuel** : l'OPS forcé se déclenche sur tout `PlayedMatch` 1v1 entre les deux
  (`:2637`), **toutes disciplines confondues** (le filtre est sur les logins, pas le `game`).
  Le refus OPS pénalise `target.elo`/`hunter.elo` = **babyfoot uniquement** (`:3988`).
- **Ce qui manque / problème** : incohérence — un match Smash compte pour épuiser le quota
  forcé, mais la pénalité de refus est calculée sur l'ELO babyfoot. Quel jeu « compte » pour
  l'OPS n'est pas défini.
- **Fichiers concernés** : `apps/backend/src/index.ts:2637`, `:3988`, `:7774`, `DOC/DOMAIN.md` §7.
- **Piste d'implémentation** : décider si l'OPS est multi-disciplines ou babyfoot-only, et
  rendre le code cohérent (filtre `game` ou ELO de la bonne discipline).
- **Effort** M · **Priorité** moyenne.

### 7.5 `bets/ops` & duel d'ops : peu documenté dans le périmètre Défis
- **État actuel** : un marché de paris existe sur le **duel d'OPS** (`/bets/ops` `:8096`,
  `opsDuelWinner` `:7770`, `settleOpsDuelBetsTx` `:7801`, sweep `:7831`). Mentionné en passant
  dans `i18n` (`shop.earn.bets.desc`) mais **absent de `DOMAIN.md` §7** (qui ne parle que de
  matchs forcés, pas de paris OPS).
- **Ce qui manque / problème** : trou de documentation ; règle « vainqueur = plus de matchs
  classés 1v1 pendant la fenêtre, égalité → remboursement » non décrite dans le domaine.
- **Fichiers concernés** : `apps/backend/src/index.ts:7755`–`:7831`, `:8096`, `DOC/DOMAIN.md` §7/§14.
- **Piste d'implémentation** : compléter `DOMAIN.md` §7/§14 ; documenter le mode de
  désignation du vainqueur et le remboursement en cas d'égalité/0 match.
- **Effort** S · **Priorité** basse.

### 7.6 OPS : pas de garantie qu'un match a lieu (cible peut « attendre l'expiration »)
- **État actuel** : la cible doit affronter le hunter, mais **rien ne l'oblige à initier** un
  défi. Elle peut simplement **ne rien faire** pendant 24 h. Le forçage ne s'applique qu'au
  **refus** d'un défi du hunter (`:3975`) ou au jeu d'un match (`:2637`).
- **Ce qui manque / problème** : si le hunter ne crée pas de défi, la cible n'a aucune
  pénalité d'inaction — l'OPS s'éteint sans effet. Le « tu dois affronter » n'est pas exécuté.
- **Fichiers concernés** : `apps/backend/src/index.ts:5645` (déclaration), pas de relance.
- **Piste d'implémentation** : pénalité d'inaction si aucun des 3 forcés n'est consommé à
  l'expiration, ou rappels automatiques (notif) au hunter pour qu'il défie.
- **Effort** M · **Priorité** basse.

---

## 8. Matchmaking (file d'attente)

### 8.1 Polling court (2,5 s) + fenêtre de notif 90 s → appariements ratés possibles
- **État actuel** : appariement par notification `matchmaking` lue dans une fenêtre
  `MATCH_NOTIF_WINDOW_MS = 90 000` (`:1559`, `:1688`). Le front poll toutes les
  `POLL_INTERVAL_MS = 2500` (`useMatchmaking.tsx:18`).
- **Ce qui manque / problème** :
  - Si le joueur **passive** (`/queue/status`) n'appelle pas dans les 90 s suivant
    l'appariement (onglet en arrière-plan, mobile en veille, perte réseau), la notif n'est
    jamais consommée comme « match » → l'overlay VERSUS ne s'affiche **jamais** côté joueur
    apparié à distance, alors que le `Challenge accepted` a bien été créé. État incohérent
    (duel à jouer existe, mais pas d'animation/notification).
  - Pas de push temps réel de l'appariement vers le joueur **apparié à distance** : `emit`
    `:1658` envoie seulement un `challenge:received` générique, pas l'overlay versus.
- **Fichiers concernés** : `apps/backend/src/index.ts:1559`, `:1678`–`:1706`, `:1644`–`:1658`,
  `apps/web/src/hooks/useMatchmaking.tsx`.
- **Piste d'implémentation** : pousser un event SSE dédié `matchmaking:matched` au moment de
  l'appariement (les deux logins), traité par le provider matchmaking, indépendant de la
  fenêtre 90 s. Garder le polling comme repli.
- **Effort** M · **Priorité** moyenne.

### 8.2 Pas de timeout / abandon de file
- **État actuel** : `/queue/join` (`:1577`) (re)pose l'entrée avec `joinedAt = now` ; aucune
  expiration des entrées de file. Le départ se fait par `/queue/leave` ou cleanup au logout
  (`:152` du hook).
- **Ce qui manque / problème** :
  - Une entrée de file d'un joueur qui ferme l'onglet **brutalement** (kill, crash mobile)
    sans déclencher le cleanup reste dans `matchmaking_queue` → il peut être apparié à un
    adversaire **absent**, qui ne verra jamais l'overlay.
  - Aucun « heartbeat » / TTL d'entrée de file.
- **Fichiers concernés** : `apps/backend/src/index.ts:1577`, `prisma/schema.prisma:687`
  (`MatchmakingQueue`).
- **Piste d'implémentation** : TTL d'entrée (purger `joinedAt < now - N min`) au moment du
  pairing et via sweeper ; heartbeat périodique côté front pendant la recherche.
- **Effort** M · **Priorité** moyenne.

### 8.3 Pas de critère de matchmaking (ELO, campus) — purement FIFO
- **État actuel** : le pairing prend le **plus ancien** autre joueur de la même discipline
  (`orderBy joinedAt asc`, `:1596`). Aucune prise en compte de l'écart d'ELO ni du campus.
- **Ce qui manque / problème** : un débutant peut tomber sur un top player ; pas de
  « fairness ». L'overlay VERSUS et l'ELO asymétrique atténuent, mais l'expérience reste rude.
- **Fichiers concernés** : `apps/backend/src/index.ts:1594`–`:1614`.
- **Piste d'implémentation** : fenêtre d'ELO élargie avec le temps d'attente (bracket
  glissant), filtrage par campus optionnel.
- **Effort** L · **Priorité** basse.

### 8.4 Pas d'exclusion anti-farming / anti-récidive dans le matchmaking
- **État actuel** : le matchmaking peut apparier **deux fois de suite** les mêmes joueurs
  (rien n'empêche de retomber sur le même adversaire récent).
- **Ce qui manque / problème** : deux complices peuvent farmer via la file (même si l'ELO est
  dégressé après 2 matchs comptés, ils gagnent des coins/quêtes selon la politique FFA, et
  pourrissent l'expérience).
- **Fichiers concernés** : `apps/backend/src/index.ts:1594`.
- **Piste d'implémentation** : éviter de réapparier une paire ayant déjà 2 matchs comptés
  dans la fenêtre 7 j (réutiliser `shouldCountForElo`).
- **Effort** M · **Priorité** basse.

### 8.5 Matchmaking 2v2 / multijoueur absent
- **État actuel** : `/queue/join` ne gère que le **1v1** (crée un `Challenge` 1v1 `:1628`).
  Pas de file 2v2, pas de file FFA/fléchettes.
- **Ce qui manque / problème** : matchmaking limité à une fraction des modes.
- **Fichiers concernés** : `apps/backend/src/index.ts:1577`.
- **Piste d'implémentation** : files par taille d'équipe ; appariement par lots (4 joueurs en
  2v2, N en FFA).
- **Effort** L · **Priorité** basse.

---

## 9. Smash FFA

### 9.1 FFA codé en dur sur `game='smash'`
- **État actuel** : `/matches/ffa*` filtre et crée **toujours** `game:'smash'` (`:2862`,
  `:2909`, `settleFfaAsPlayed` `:2828`). Le FFA est conceptuellement multi-disciplines (les
  fléchettes réutilisent les mêmes tables avec `game='flechettes'`) mais l'endpoint FFA est
  figé Smash.
- **Ce qui manque / problème** : impossible de faire un FFA d'une autre discipline « à scoring
  par rang » sans dupliquer les routes (comme les fléchettes l'ont fait).
- **Fichiers concernés** : `apps/backend/src/index.ts:2858`–`:3025`.
- **Piste d'implémentation** : paramétrer le `game` du FFA (avec un Elo par rang générique).
- **Effort** M · **Priorité** basse.

### 9.2 Pas de borne supérieure explicite au nombre de participants FFA
- **État actuel** : `DeclareFfaSchema` (`schemas.ts:418`) borne le ranking, mais à vérifier
  qu'une borne max raisonnable existe (les fléchettes ont `DARTS_MAX_PLAYERS=8`). Le FFA Smash
  pourrait accepter beaucoup de joueurs → `calculateFfaElo` en round-robin O(N²).
- **Ce qui manque / problème** : DoS léger / coût ELO si N grand ; UX de confirmation lourde
  (chacun doit confirmer).
- **Fichiers concernés** : `packages/shared/src/schemas.ts:418`, `packages/shared/src/elo.ts`
  (`calculateFfaElo`).
- **Piste d'implémentation** : aligner une borne max (ex. 8) et la tester.
- **Effort** S · **Priorité** basse.

### 9.3 Contestation FFA = annulation totale, sans trace ni anti-abus
- **État actuel** : une contestation de **sa** position annule **toute** la manche
  (`:3028`–`:3073`) sans `RejectedMatch`-équivalent, sans compteur.
- **Ce qui manque / problème** : un joueur de mauvaise foi peut **annuler systématiquement**
  tous les FFA où il perd, sans coût ni trace. Aucune statistique de litiges FFA.
- **Fichiers concernés** : `apps/backend/src/index.ts:3028`.
- **Piste d'implémentation** : tracer la contestation (table / compteur), éventuel coût social
  pour contestations abusives répétées.
- **Effort** M · **Priorité** basse.

---

## 10. Fléchettes 301/501

### 10.1 Validation du `remaining` au moment de la confirmation, pas de « checkout » réel
- **État actuel** : le déclarant saisit le reste de chacun ; chacun reconfirme **son** reste
  (`:3257`). Le vainqueur a reste 0 (`DeclareDartsSchema`). Pas de vérification de cohérence
  fléchettes réelle (double-out, score atteignable, etc.).
- **Ce qui manque / problème** : aucune règle métier des fléchettes (un reste comme 1 est
  injouable à finir en double-out ; un reste > 180 non décrémentable en une volée…). Le modèle
  est purement « score restant déclaré », sans logique de fléchettes.
- **Fichiers concernés** : `packages/shared/src/schemas.ts:468`, `apps/backend/src/index.ts:3118`.
- **Piste d'implémentation** : c'est sans doute volontairement simplifié — à **documenter**
  comme tel (« reste déclaratif, pas de simulation de volées »).
- **Effort** S · **Priorité** basse.

### 10.2 Garde `startScore` validée deux fois (schéma 501 + check runtime 301/501)
- **État actuel** : `ConfirmDartsSchema`/`ContestDartsSchema` bornent `remaining` à 0–501
  (`schemas.ts:494`, `:501`), puis le handler revérifie contre le vrai `startScore`
  (`:3279`, `:3363`). Double validation, message d'erreur potentiellement contradictoire
  pour une manche 301 (le schéma accepte 400, le handler le rejette).
- **Ce qui manque / problème** : incohérence de bornes ; le schéma ne connaît pas le
  `startScore` de la manche → validation imprécise côté front.
- **Fichiers concernés** : `packages/shared/src/schemas.ts:494`, `apps/backend/src/index.ts:3279`.
- **Piste d'implémentation** : passer le `startScore` au schéma (refine dynamique) ou
  documenter la double-borne.
- **Effort** S · **Priorité** basse.

### 10.3 Fléchettes : pas de tournoi (connu) mais aussi pas d'OPS / matchmaking
- **État actuel** : `pending.md:18` note l'absence de tournoi fléchettes. À noter aussi :
  pas de matchmaking fléchettes, pas d'OPS fléchettes (OPS = 1v1).
- **Ce qui manque / problème** : discipline « de seconde classe » (multijoueur uniquement,
  déclaratif). Cohérent mais à documenter comme limitation assumée.
- **Fichiers concernés** : transversal.
- **Piste d'implémentation** : documenter les limitations dans `DOMAIN.md` §12.
- **Effort** S · **Priorité** basse.

---

## 11. Litiges & RejectedMatch

### 11.1 RejectedMatch sans suite : pas de résolution, pas d'ELO retiré
- **État actuel** : un `reject` crée un `RejectedMatch` (`:2731`) et supprime le pending.
  Le modèle (`schema.prisma:206`) ne porte **pas** de discipline (`game`), pas de `seasonId`,
  pas de statut de résolution. La gestion admin se limite à lister/supprimer
  (`/admin/rejected-matches` `:6102`, `:6112`).
- **Ce qui manque / problème** :
  - Aucun workflow de **résolution** d'un litige (re-déclaration assistée, arbitrage admin
    posant le score d'autorité).
  - `RejectedMatch` perd le `game` → impossible de filtrer les litiges par discipline.
  - Pas de compteur de litiges par joueur (détection de joueurs « toxiques »).
- **Fichiers concernés** : `prisma/schema.prisma:206`, `apps/backend/src/index.ts:2731`,
  `:6102`–`:6126`.
- **Piste d'implémentation** : ajouter `game`, `status` (`open`/`resolved`/`dismissed`),
  `resolvedByLogin` ; bouton admin « rejouer / trancher » ; compteur de litiges.
- **Effort** M · **Priorité** moyenne.

### 11.2 Pas de notification au déclarant que son match a été **annulé** (cancel)
- **État actuel** : `/matches/:id/cancel` (`:2764`) émet `match:cancelled` à l'adversaire
  mais **ne crée pas de notif cloche** (contrairement à reject `:2749`).
- **Ce qui manque / problème** : si l'adversaire n'est pas en ligne au moment du cancel, il
  ne saura pas que le « score à valider » a disparu (sauf re-fetch). Notif manquante.
- **Fichiers concernés** : `apps/backend/src/index.ts:2764`–`:2787`.
- **Piste d'implémentation** : ajouter une notif `match_cancelled` + `markNotifsReadByRef`.
- **Effort** S · **Priorité** basse.

---

## 12. Observabilité, audit & métriques

### 12.1 Aucune métrique sur les défis/matchs (taux d'annulation, latence de confirmation)
- **État actuel** : pas d'instrumentation (compteurs Prometheus, logs structurés) sur le
  cycle déclaration → confirmation, le taux de mismatch, le taux de dodge, la taille des files.
- **Ce qui manque / problème** : impossible de mesurer la santé du domaine (combien de
  pendings traînent, délai médian de confirmation, % de litiges).
- **Fichiers concernés** : transversal `apps/backend/src/index.ts`.
- **Piste d'implémentation** : compteurs sur declare/confirm/reject/cancel/dodge ; jauge
  « pendings ouverts » et « entrées de file ».
- **Effort** M · **Priorité** basse.

### 12.2 Actions joueur (dodge, mismatch) non auditées
- **État actuel** : `logAdminAction` ne couvre que les actions **admin** (force-confirm
  `:3431`, force-cancel `:3468`, force-result `:3734`). Un dodge, un refus OPS coûteux, un
  mismatch ne laissent **aucune trace d'audit** (seuls `dodgeCount` et `RejectedMatch` existent).
- **Ce qui manque / problème** : pas de journal pour enquêter sur un litige (« qui a déclaré
  quoi, quand, qui a refusé »).
- **Fichiers concernés** : `apps/backend/src/index.ts:3937` (decline), `:2619` (mismatch).
- **Piste d'implémentation** : journal d'événements de match léger (table append-only) ou
  extension de `RejectedMatch`.
- **Effort** M · **Priorité** basse.

### 12.3 `GET /matches` et `/matches/pending` non paginés / non filtrés
- **État actuel** : `/matches` renvoie les `MAX_PUBLIC_LIST = 1000` derniers
  (`:2161`) ; `/matches/pending` renvoie **tout** sans limite ni filtre par joueur (`:2167`).
- **Ce qui manque / problème** : `/matches/pending` peut grossir sans borne (cf. 1.1) et
  expose les pendings de **tous** les joueurs ; pas de pagination/curseur sur l'historique.
- **Fichiers concernés** : `apps/backend/src/index.ts:2158`, `:2165`.
- **Piste d'implémentation** : pagination par curseur ; filtre `?mine=true` ; `take` sur
  pending.
- **Effort** S · **Priorité** basse.

---

## 13. Tests manquants

### 13.1 Aucun test d'intégration FFA / fléchettes / OPS / matchmaking
- **État actuel** : `apps/backend/test/` couvre `matches.itest.ts` (déclaration, confirmation,
  mismatch, reject, cancel, anti-farming) et `challenges.itest.ts` (create/accept/decline/
  dodge/record). **Aucun** test pour FFA (`/matches/ffa*`), fléchettes (`/matches/darts*`),
  OPS (`/ops*`, forçage, refus), ni matchmaking (`/queue/*`), ni 2v2.
- **Ce qui manque / problème** : les mécaniques les plus subtiles (confirmation N-aire,
  forçage OPS, dégressivité, pairing concurrent) sont **non testées**.
- **Fichiers concernés** : `apps/backend/test/` (ajouter `ffa.itest.ts`, `darts.itest.ts`,
  `ops.itest.ts`, `matchmaking.itest.ts`, `matches-2v2.itest.ts`).
- **Piste d'implémentation** : étendre les itests HTTP existants (helpers `test/helpers.ts`).
  Couvrir : confirmation partielle FFA, abort sur joueur indisponible, forçage OPS (joué +
  refusé), pénalité ×3, cooldown 7 j, pairing concurrent (deux joins simultanés), mismatch
  darts/ffa.
- **Effort** L · **Priorité** haute (couverture critique manquante).

### 13.2 Pas de test sur la course de confirmation 2v2 (3 confirmants concurrents)
- **État actuel** : la branche 2v2 sérialise via transaction mais sans verrou `FOR UPDATE`
  explicite (contrairement au FFA `:2953`, `:3268`). Le `findUnique` puis `update` dans la
  transaction (`:2540`–`:2555`) peut subir une **lost update** si deux confirmations
  arrivent en parallèle (lecture du même état, écriture partielle).
- **Ce qui manque / problème** : risque qu'un settlement parte avec un compteur faux, ou que
  deux settlements concurrents tentent de supprimer le même pending.
- **Fichiers concernés** : `apps/backend/src/index.ts:2538`–`:2581`.
- **Piste d'implémentation** : `SELECT … FOR UPDATE` sur `pending_matches` en tête de la
  branche 2v2 (comme FFA) ; test de concurrence.
- **Effort** S · **Priorité** moyenne.

### 13.3 Pas de test de bordure pour la dégressivité (minuit, fuseau) ni pour les bornes ELO négatives
- **État actuel** : cf. 3.3 et 6.2 — comportements non testés.
- **Fichiers concernés** : `packages/shared/src/anti-farming.test.ts` (à étendre),
  `apps/backend/test/`.
- **Effort** S · **Priorité** basse.

---

## 14. i18n manquant / en dur

### 14.1 Messages d'erreur backend en français en dur, non localisés
- **État actuel** : tous les `HTTPException` messages sont en **français en dur** (« tu as
  déjà un ops actif », « le classement a changé », « solde insuffisant »…) côté backend
  (ex. `:2188`, `:2965`, `:5670`). Le front a un dictionnaire FR/EN (`i18n.tsx`, 574 clés)
  mais les erreurs serveur le contournent.
- **Ce qui manque / problème** : un utilisateur en anglais voit des erreurs en français ;
  pas de table d'erreurs codifiée (code + i18n côté front).
- **Fichiers concernés** : `apps/backend/src/index.ts` (tous les handlers), `apps/web/src/lib/i18n.tsx`.
- **Piste d'implémentation** : renvoyer des **codes** d'erreur stables + i18n côté front, ou
  un en-tête `Accept-Language`.
- **Effort** L · **Priorité** basse.

### 14.2 Libellés OPS / FFA / fléchettes / dodge incomplets dans i18n
- **État actuel** : `i18n.tsx` couvre `defis.*`, `nav.defis`, `profil.dodges`/`Fuites`, mais
  beaucoup de chaînes spécifiques (OPS « la chasse », forçage, FFA, fléchettes, matchmaking
  « adversaire trouvé ») vivent en partie côté composants ou notifications backend en dur.
- **Ce qui manque / problème** : couverture i18n partielle ; risque de chaînes FR en dur dans
  les sheets/overlays (à auditer composant par composant dans `pages/defis/`).
- **Fichiers concernés** : `apps/web/src/lib/i18n.tsx`, `apps/web/src/lib/locales/defis.ts`,
  `apps/web/src/pages/defis/**`.
- **Piste d'implémentation** : audit des chaînes en dur dans `pages/defis/` ; compléter le
  dictionnaire ; lint anti-chaîne-en-dur.
- **Effort** M · **Priorité** basse.

---

## 15. UX / a11y / divergences desktop-mobile

### 15.1 Divergence desktop (1593 l.) / mobile (759 l.) — surface de bug
- **État actuel** : `DefisDesktop.tsx` (1593 lignes) et `DefisMobile.tsx` (759 lignes) sont
  deux implémentations distinctes, avec des sous-dossiers `mobile/` et `shared/`. La logique
  est partiellement factorisée (`shared/useDefisLogic.ts`) mais l'UI diverge fortement.
- **Ce qui manque / problème** : risque qu'une feature (ex. 2v2, OPS overlay, FFA) soit
  présente sur une plateforme et pas l'autre, ou se comporte différemment. À auditer
  feature-par-feature (parité desktop/mobile).
- **Fichiers concernés** : `apps/web/src/pages/defis/DefisDesktop.tsx`,
  `apps/web/src/pages/defis/DefisMobile.tsx`, `apps/web/src/pages/defis/{shared,mobile}/`.
- **Piste d'implémentation** : matrice de parité (tableau feature × plateforme) ; factoriser
  davantage la logique métier dans `useDefisLogic`.
- **Effort** L · **Priorité** moyenne.

### 15.2 Overlay VERSUS / matchmaking : pas de repli si l'adversaire ne se présente jamais
- **État actuel** : l'overlay VERSUS s'affiche à l'appariement (`MatchmakingOverlay` via
  `useMatchmaking`), puis `dismiss()` navigue vers `/challenges`. Si l'adversaire est absent
  (cf. 8.1/8.2), le joueur reste avec un « duel à jouer » qu'il ne peut pas honorer.
- **Ce qui manque / problème** : pas d'état « adversaire injoignable / a quitté » ; pas de
  bouton « annuler ce duel d'appariement ».
- **Fichiers concernés** : `apps/web/src/hooks/useMatchmaking.tsx`, composant overlay.
- **Piste d'implémentation** : permettre d'annuler le `Challenge accepted` issu d'un
  matchmaking sans pénalité (ce n'est pas un dodge social).
- **Effort** M · **Priorité** basse.

### 15.3 a11y : overlays/sheets (VERSUS, OpsReveal, sheets mobile) à auditer
- **État actuel** : nombreux overlays animés (OpsRevealOverlay, MatchmakingOverlay, sheets
  `pages/defis/mobile/*Sheet.tsx`). Aucune garantie de gestion focus-trap / `aria-modal` /
  `Escape` systématique (`useEscapeKey` existe mais usage à vérifier partout).
- **Ce qui manque / problème** : navigation clavier et lecteurs d'écran probablement
  incomplets sur les flux de déclaration/confirmation.
- **Fichiers concernés** : `apps/web/src/pages/defis/**`, `apps/web/src/hooks/useEscapeKey.ts`.
- **Piste d'implémentation** : audit a11y des modales (focus-trap, rôles ARIA, annonce des
  changements d'état de match en temps réel via `aria-live`).
- **Effort** M · **Priorité** basse.

### 15.4 Pas de feedback de chargement / double-soumission sur les actions de match
- **État actuel** : `accept` est idempotent côté serveur (`:3893`), mais `declare`/`confirm`/
  `record`/`reject` ne le sont pas (cf. 1.4). Sans verrou de bouton côté front, un double-tap
  crée des doublons.
- **Ce qui manque / problème** : doublons (1.4) + UX (pas de spinner garanti) ; risque
  particulièrement élevé sur mobile (latence).
- **Fichiers concernés** : `apps/web/src/pages/defis/**`, `apps/web/src/lib/api.ts`.
- **Piste d'implémentation** : désactiver les boutons pendant la requête ; idempotence
  serveur (cf. 1.4).
- **Effort** S · **Priorité** moyenne.

---

## 16. Dette technique & cohérence du modèle

### 16.1 PlayedFfa réutilisé pour 2 disciplines via `game` (couplage)
- **État actuel** : `PendingFfa`/`PlayedFfa` (`schema.prisma:474`, `:508`) servent à la fois
  Smash FFA et fléchettes, séparés par le champ `game` et par des routes distinctes
  (`DOMAIN.md` §12). `startScore` n'a de sens que pour les fléchettes ; `remaining` aussi.
- **Ce qui manque / problème** : champs non pertinents selon la discipline (couplage) ;
  toute évolution d'une discipline impacte l'autre table.
- **Fichiers concernés** : `prisma/schema.prisma:474`–`:551`.
- **Piste d'implémentation** : assumer et documenter le couplage (choix actuel), ou séparer si
  une 3e discipline multijoueur arrive.
- **Effort** M · **Priorité** basse.

### 16.2 `winner` stocké en `'A'|'B'|'draw'` sans enum DB
- **État actuel** : `PlayedMatch.winner` est un `String` libre (`schema.prisma:430`,
  commentaire « 'A' or 'B' » qui **oublie** `'draw'` introduit pour les échecs `:2430`).
- **Ce qui manque / problème** : commentaire schéma obsolète ; pas de contrainte DB → valeur
  invalide possible par bug.
- **Fichiers concernés** : `prisma/schema.prisma:430`.
- **Piste d'implémentation** : mettre à jour le commentaire ; envisager un enum / check.
- **Effort** S · **Priorité** basse.

### 16.3 `Challenge.game` commenté « babyfoot | smash » alors que 5 disciplines existent
- **État actuel** : `schema.prisma:369` commente `// 'babyfoot' | 'smash'` mais
  `CreateChallengeSchema` accepte `GameSchema` (5 jeux). Idem `PendingMatch.game` (`:398`),
  `Tournament.game` (`:254`).
- **Ce qui manque / problème** : commentaires de schéma **trompeurs/obsolètes** (dette de
  doc inline) — risque d'induire en erreur un nouveau contributeur.
- **Fichiers concernés** : `prisma/schema.prisma:254`, `:369`, `:398`.
- **Piste d'implémentation** : corriger les commentaires (`'babyfoot' | 'smash' | 'chess' |
  'streetfighter' | 'flechettes'`).
- **Effort** S · **Priorité** basse.

### 16.4 `match:expired` émis seulement par force-cancel (event sous-utilisé)
- **État actuel** : l'event `match:expired` n'est émis **que** par `/admin/matches/:id/force-cancel`
  (`:3482`). Le nom suggère une expiration automatique (cf. 1.1) qui n'existe pas.
- **Ce qui manque / problème** : nom d'event trompeur ; le front gère peut-être un cas
  « expiré » jamais déclenché naturellement.
- **Fichiers concernés** : `apps/backend/src/index.ts:3482`, handlers SSE front.
- **Piste d'implémentation** : réutiliser cet event pour la vraie expiration (1.1), ou le
  renommer `match:force_cancelled`.
- **Effort** S · **Priorité** basse.

### 16.5 `stocks` Smash : défaut silencieux à 1
- **État actuel** : `settlePendingAsPlayed` (`:2439`) pose `winnerStocks = p.stocks ?? 1`.
  Un Smash déclaré sans `stocks` enregistre silencieusement 1 vie restante.
- **Ce qui manque / problème** : donnée potentiellement fausse (stat de domination Smash)
  sans signal ; pas de validation que `stocks` est cohérent avec `SMASH_STOCKS`.
- **Fichiers concernés** : `apps/backend/src/index.ts:2439`–`:2441`, `packages/shared/src/elo.ts`
  (`SMASH_STOCKS`).
- **Piste d'implémentation** : valider/obligatoire `stocks` pour le Smash, borné à `SMASH_STOCKS`.
- **Effort** S · **Priorité** basse.

### 16.6 Notifs cloche : `refId` non soldé pour les pendings expirés / cancel
- **État actuel** : `markNotifsReadByRef` est appelé sur confirm/reject/record, mais **pas**
  sur `cancel` (`:2764`, cf. 11.2) ni sur une future expiration (1.1). Une notif « score à
  valider » peut rester non lue pour un pending qui n'existe plus.
- **Ce qui manque / problème** : notifications cloche fantômes (le clic mène à un pending
  introuvable).
- **Fichiers concernés** : `apps/backend/src/index.ts:2764`, futur sweeper.
- **Piste d'implémentation** : appeler `markNotifsReadByRef` partout où un pending disparaît.
- **Effort** S · **Priorité** basse.

---

### Récapitulatif des priorités hautes
- **3.1** Anti-farming absent en FFA/fléchettes (ELO **et** coins) — faille d'intégrité.
- **4.1** `assertNotBanned` absent sur confirm/accept/record — contournement de ban.
- **13.1** Aucun test FFA/fléchettes/OPS/matchmaking/2v2.

### Priorités moyennes notables
- **1.1/1.2** Expiration des pending (annoncée, jamais faite).
- **2** Minimum hebdo / malus d'inactivité (annoncé, jamais fait).
- **5.2** Pas de validation bilatérale de score en 2v2.
- **7.3** « Pas de coins sur match forcé » documenté mais non implémenté.
- **7.1** Timers OPS volatils au redémarrage.
- **8.1/8.2** Matchmaking : appariements ratés / entrées zombies.
