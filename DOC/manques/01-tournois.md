# Manques — Tournois

> Document des **MANQUES** du domaine Tournois de 42 League : ce qui est absent,
> incomplet, à moitié fait, fragile ou améliorable. Ce n'est PAS une description de
> l'existant — chaque entrée décrit un trou à combler. Rédigé en français.
>
> Sources lues : `apps/backend/src/tournament.ts`, sections tournois de
> `apps/backend/src/index.ts` (`/tournaments*`, `settleConfirmedTournamentMatch`,
> `generateBracket`/`generatePools`, `toss`, `advantage`, `force-result`,
> `reshuffle`, `announce`), `apps/backend/prisma/schema.prisma`
> (`Tournament`/`TournamentMatch`/`TournamentEntry`/`TournamentInvite`),
> `packages/shared/src/schemas.ts` (`CreateTournamentSchema`),
> `packages/shared/src/games.ts` (`advantage`, `validateTournamentScore`),
> `apps/web/src/pages/TournoiDetailPage.tsx`, `apps/web/src/pages/tournois/*`,
> `apps/web/src/components/tournois/*`, `apps/web/src/lib/locales/tournois.ts`,
> et les docs `DOC/DOMAIN.md`, `DOC/pending.md`, `DOC/API.md`.

## Table des matières

1. [Formats & structure du bracket](#1-formats--structure-du-bracket)
2. [Seeding & tirage](#2-seeding--tirage)
3. [Phase de poules](#3-phase-de-poules)
4. [Déroulé d'un match (toss / avantage / scores / confirmation)](#4-déroulé-dun-match-toss--avantage--scores--confirmation)
5. [Forfaits, abandons, no-show & deadlines](#5-forfaits-abandons-no-show--deadlines)
6. [Mode 2v2](#6-mode-2v2)
7. [Tournoi fléchettes & disciplines multijoueurs](#7-tournoi-fléchettes--disciplines-multijoueurs)
8. [Échecs : nulles & matchs parallèles](#8-échecs--nulles--matchs-parallèles)
9. [Paris sur tournoi](#9-paris-sur-tournoi)
10. [Récompenses & cash-prize](#10-récompenses--cash-prize)
11. [Reshuffle & édition du bracket](#11-reshuffle--édition-du-bracket)
12. [Invitations & inscription](#12-invitations--inscription)
13. [Cérémonie de lancement & match « suivant »](#13-cérémonie-de-lancement--match-suivant)
14. [Affichage bracket / poules (UX)](#14-affichage-bracket--poules-ux)
15. [Notifications & temps réel](#15-notifications--temps-réel)
16. [Administration & modération](#16-administration--modération)
17. [Validation, robustesse & cas limites](#17-validation-robustesse--cas-limites)
18. [Observabilité & intégrité des données](#18-observabilité--intégrité-des-données)
19. [Tests manquants](#19-tests-manquants)
20. [i18n & accessibilité](#20-i18n--accessibilité)
21. [Divergences desktop / mobile](#21-divergences-desktop--mobile)

---

## 1. Formats & structure du bracket

### Pas de petite finale (match pour la 3e place)
- **État actuel** : `generateBracket` (`apps/backend/src/tournament.ts:53-138`) ne crée
  qu'un bracket à élimination simple. `advanceWinner` (`tournament.ts:283-318`) renvoie
  `isFinal` au dernier round et la finale clôt le tournoi. Le perdant de chaque demi-finale
  est éliminé sans classement final.
- **Ce qui manque / problème** : aucun match pour la 3e place. Impossible de connaître
  officiellement le podium (2e, 3e, 4e), pourtant `tournamentsWon*` n'est crédité qu'au
  champion. Pas de notion de « finaliste » ni de récompense de 3e place. Pour un tournoi
  officiel avec cash-prize, les paliers du cash-prize sont dérivés du nombre de tours
  franchis (`payCashPrizeTx`), mais aucune distinction entre les deux demi-finalistes battus.
- **Fichiers concernés** : `apps/backend/src/tournament.ts`,
  `apps/backend/src/index.ts` (`settleConfirmedTournamentMatch`),
  `apps/web/src/components/tournois/BracketTree.tsx`.
- **Piste d'implémentation** : ajouter un flag `withThirdPlace` sur `Tournament` ; à la
  confirmation des deux demi-finales, générer un match `stage='bracket'` spécial
  (`round = rounds`, `slot = 1`, ou un `stage='thirdplace'`) opposant les deux perdants.
  `BracketTree` doit alors afficher cette branche. `qualifiersFromPools` / `advanceWinner`
  inchangés mais `totalRounds` du règlement doit ignorer ce match annexe.
- **Effort** : M. **Priorité** : moyenne.

### Pas de double élimination ni de format suisse
- **État actuel** : seuls `format='elimination'` et `format='pools'` existent
  (`schemas.ts:215`, `schema.prisma:253`).
- **Ce qui manque / problème** : un seul mauvais tirage / une seule défaite élimine. Pour
  des tournois compétitifs (smash, SF) la **double élimination** (winners + losers bracket)
  et le **format suisse** sont des standards attendus. Absents totalement (modèle,
  génération, propagation, affichage).
- **Fichiers concernés** : `tournament.ts`, `schema.prisma`, `schemas.ts`, `BracketTree.tsx`.
- **Piste d'implémentation** : nouveau `format` ; pour la double élim, un `stage='losers'`
  avec table de routage des perdants par (round, slot) ; grosse refonte de `advanceWinner`
  pour propager **deux** sorties par match (gagnant → winners, perdant → losers). Affichage
  à deux colonnes.
- **Effort** : L. **Priorité** : basse.

### Capacité limitée aux puissances de 2 alors que les byes sont gérés
- **État actuel** : `CreateTournamentSchema` exige `capacity` puissance de 2, 8–64
  (`schemas.ts:208,244-247`). Pourtant `generateBracket` gère parfaitement un nombre
  **quelconque** de joueurs ≥ 2 avec byes (`tournament.ts:53-138`).
- **Ce qui manque / problème** : incohérence — le moteur sait faire des byes mais le
  formulaire refuse les capacités non-puissances de 2 (ex. 6, 12, 24). On force donc soit à
  attendre 16 inscrits, soit à laisser des slots vides impossibles. La capacité 12 (poules)
  n'est même pas une puissance de 2 et n'est donc **pas saisissable** alors que le refine
  poules exige `capacity >= 12` (cf. ci-dessous, contradiction).
- **Fichiers concernés** : `packages/shared/src/schemas.ts`,
  `apps/web/src/pages/tournois/CreateTournamentPage.tsx`,
  `apps/web/src/pages/tournois/mobile/CreateTournamentSheet.tsx`.
- **Piste d'implémentation** : autoriser une capacité libre min 2 (ou min 3) ; ou un mode
  « nombre de joueurs cible » avec start manuel quand on veut, le bracket s'adaptant aux
  byes. Mettre à jour les libellés (« puissance de 2 (8, 16, 32, 64) ») et les `refine`.
- **Effort** : M. **Priorité** : moyenne.

### Contradiction capacité poules : refine `>= 12` mais capacité ∈ {8,16,32,64}
- **État actuel** : `schemas.ts:248-250` impose `capacity >= 12` pour les poules, alors que
  `schemas.ts:244` impose une puissance de 2. La plus petite puissance de 2 ≥ 12 est **16**.
  Le commentaire `schema.prisma:249` dit « Poules dès 12 » et `DOMAIN.md:275` note « pools ⇒
  capacity ≥ 12 (donc 16) ».
- **Ce qui manque / problème** : le seuil « 12 » est trompeur : 12 est rejeté par le refine
  puissance-de-2. La plus petite capacité poules réelle est 16, ce qui est élevé. Avec 16
  joueurs et `POOL_SIZE=4`, on a 4 poules de 4 → top 2 = 8 qualifiés → bracket à 8 : OK, mais
  le seuil affiché induit l'organisateur en erreur.
- **Fichiers concernés** : `packages/shared/src/schemas.ts`, libellés i18n.
- **Piste d'implémentation** : soit aligner le message sur 16, soit (si capacité libre
  adoptée) garder 12. Clarifier le libellé d'erreur `tournois.*`.
- **Effort** : S. **Priorité** : moyenne.

### Taille de poule figée à 4, non configurable, et dernière poule déséquilibrée
- **État actuel** : `POOL_SIZE = 4` constante (`tournament.ts:140`). Répartition en serpent
  `pools[i % numPools]` (`tournament.ts:150-153`).
- **Ce qui manque / problème** : impossible de choisir des poules de 3, 5 ou 6. Le
  `qualifyPerPool` est codé en dur à 2 (`qualifiersFromPools(matches, qualifyPerPool = 2)`,
  `tournament.ts:233`), jamais surchargé par l'appelant. Avec un nombre de joueurs non
  divisible par 4, les poules ont des tailles différentes (ex. 5 poules pour 18 joueurs =
  poules de 4,4,4,3,3) → **iniquité** : il est plus facile de finir top 2 d'une poule de 3.
  Aucun garde-fou ni avertissement.
- **Fichiers concernés** : `apps/backend/src/tournament.ts`, `schema.prisma`, `schemas.ts`.
- **Piste d'implémentation** : ajouter `poolSize` et `qualifyPerPool` sur `Tournament` ;
  exposer dans le formulaire ; valider que `numPools * qualifyPerPool` est une puissance de 2
  (sinon prévoir des byes dans le bracket des qualifiés — déjà géré par `generateBracket`).
- **Effort** : M. **Priorité** : moyenne.

### Pas de bracket des qualifiés alternatif (best-thirds, repêchage)
- **État actuel** : `qualifiersFromPools` ne prend que le top 2 de chaque poule
  (`tournament.ts:251-253`).
- **Ce qui manque / problème** : pas de qualification des « meilleurs 3es » (utile quand le
  nombre de poules ne donne pas une puissance de 2 de qualifiés), pas de repêchage.
- **Fichiers concernés** : `tournament.ts`.
- **Piste d'implémentation** : calculer un classement inter-poules des 3es (par diff de buts,
  buts pour) et compléter le bracket des qualifiés jusqu'à la puissance de 2.
- **Effort** : M. **Priorité** : basse.

---

## 2. Seeding & tirage

### Seeding toujours aléatoire — pas de tête de série basée sur l'ELO
- **État actuel** : `generateBracket` mélange aléatoirement les joueurs sauf si `preSeeded`
  (`tournament.ts:60`). `preSeeded` n'est utilisé que pour le bracket issu des poules
  (`index.ts` settle, `generateBracket(id, qualifiers, { preSeeded: true })`). Au lancement
  d'un tournoi à élimination directe, l'ordre est **toujours `shuffle`**.
- **Ce qui manque / problème** : le `seedOrder` canonique (`tournament.ts:31-44`) est calculé
  mais alimenté par un ordre aléatoire — donc les têtes de série n'ont aucun sens. Aucune
  option pour seeder par ELO de la discipline, par `tournamentsWon`, ou manuellement par
  l'organisateur (drag & drop). Les byes tombent donc sur des joueurs aléatoires plutôt que
  sur les mieux classés, ce qui est contre-intuitif (« la tête de série n°1 a un bye »).
- **Fichiers concernés** : `apps/backend/src/tournament.ts`,
  `apps/backend/src/index.ts` (`launchTournamentMatches`), formulaire de création,
  `TournoiDetailPage.tsx`.
- **Piste d'implémentation** : champ `seeding: 'random' | 'elo' | 'manual'` sur le tournoi.
  Pour `elo`, trier les entries par ELO de `tournament.game` avant `generateBracket(..., {
  preSeeded: true })`. Pour `manual`, persister l'ordre choisi par l'orga (UI de réordonnage
  pendant l'inscription).
- **Effort** : M. **Priorité** : moyenne.

### Byes attribués mais jamais affichés explicitement comme « exempt »
- **État actuel** : un bye est un match round 1 auto-confirmé avec `winnerLogin` rempli et
  `confirmedAt` posé (`tournament.ts:88-101`), propagé au round 2.
- **Ce qui manque / problème** : côté UI, rien n'indique « exempté (bye) » de façon claire ;
  l'utilisateur voit un match « déjà gagné » sans adversaire. Pas de libellé i18n « Exempt /
  Bye / Qualifié d'office ».
- **Fichiers concernés** : `apps/web/src/components/tournois/BracketTree.tsx`,
  `apps/web/src/lib/locales/tournois.ts`.
- **Piste d'implémentation** : détecter `playerB == null && winnerLogin != null` (ou
  inversement) et rendre un chip « Exempt » au lieu d'un score.
- **Effort** : S. **Priorité** : basse.

### Aucune reproductibilité / journal du tirage
- **État actuel** : le `shuffle` utilise `Math.random()` (`tournament.ts:16-24`) sans graine
  ni trace.
- **Ce qui manque / problème** : impossible de rejouer/auditer un tirage, de prouver
  l'équité, ou de l'animer côté front (le tirage est instantané, pas de « cérémonie de
  tirage » façon Ligue des Champions). Le reshuffle écrase sans historiser l'ancien bracket.
- **Fichiers concernés** : `tournament.ts`, `schema.prisma`.
- **Piste d'implémentation** : stocker une `drawSeed` (string) sur le tournoi et un PRNG
  seedé ; exposer un endpoint « simuler le tirage » pour animer la révélation des paires.
- **Effort** : M. **Priorité** : basse.

---

## 3. Phase de poules

### Départage des poules incomplet (pas de confrontation directe, tie-break partiel)
- **État actuel** : `poolStandings` trie par victoires, puis diff de buts, puis buts pour
  (`tournament.ts:210-211`).
- **Ce qui manque / problème** : pas de tie-break par **confrontation directe** (head-to-head)
  en cas d'égalité parfaite victoires/diff/buts → l'ordre devient celui d'insertion de la Map
  (non déterministe sémantiquement). Pas de tirage au sort explicite ni de match de barrage.
  Pour les échecs (score binaire 1-0), la « diff de buts » vaut toujours ±1 et « buts pour »
  vaut 0 ou 1 → le départage se réduit quasi exclusivement aux victoires, donc beaucoup
  d'égalités non tranchées.
- **Fichiers concernés** : `apps/backend/src/tournament.ts`.
- **Piste d'implémentation** : ajouter le head-to-head comme 3e critère (avant diff), puis un
  départage stable (par ELO ou par ordre de seed initial) pour garantir le déterminisme.
  Documenter la règle dans l'UI (`tournois.pools.tiebreak`).
- **Effort** : M. **Priorité** : moyenne.

### Pas de calendrier ni d'ordre de jeu des matchs de poule
- **État actuel** : tous les matchs de poule sont créés d'un coup, sans ordre imposé ni
  notion de « journée » (`generatePools`, `tournament.ts:146-173`).
- **Ce qui manque / problème** : aucun moyen de savoir « quel match jouer maintenant » dans
  une poule, pas de regroupement par journée, pas d'`announce` pour les poules (le « match
  suivant » ne s'applique qu'au bracket, cf. §13). Les joueurs doivent se coordonner hors
  système.
- **Fichiers concernés** : `tournament.ts`, `TournoiDetailPage.tsx`.
- **Piste d'implémentation** : numéroter les journées (round-robin scheduling de cercle) et
  permettre d'annoncer un match de poule comme actif.
- **Effort** : M. **Priorité** : basse.

### Poules sans toss/avantage (le pile-ou-face est réservé au bracket)
- **État actuel** : `/toss` refuse explicitement les matchs de poule
  (`index.ts`, « le pile-ou-face ne concerne que le bracket », `stage !== 'bracket'`).
- **Ce qui manque / problème** : en babyfoot/échecs, le choix balle/terrain/couleur est tout
  aussi pertinent en poule qu'en bracket. Asymétrie non justifiée fonctionnellement.
- **Fichiers concernés** : `index.ts` (route `/toss`), `TournoiDetailPage.tsx`.
- **Piste d'implémentation** : autoriser le toss en poule, ou rendre le toss optionnel et
  uniforme. Décision produit à trancher.
- **Effort** : S. **Priorité** : basse.

### Affichage des classements de poule : pas de live, pas de qualifiés mis en évidence
- **État actuel** : `poolStandings`/`qualifiersFromPools` existent côté backend, l'API
  `/tournaments/:id` renvoie les matchs.
- **Ce qui manque / problème** : à vérifier côté `TournoiDetailPage`/`BracketTree` —
  le classement live de chaque poule (V, diff, BP) et la mise en surbrillance des 2
  qualifiables ne sont pas clairement rendus pendant la phase de poules. Pas d'indicateur
  « X matchs restants avant le bracket ».
- **Fichiers concernés** : `apps/web/src/components/tournois/BracketTree.tsx`,
  `apps/web/src/pages/TournoiDetailPage.tsx`.
- **Piste d'implémentation** : composant `PoolStandingsTable` calculant le standing côté front
  (réutiliser la logique de `poolStandings` exportée depuis `@shared`), surligner top 2.
- **Effort** : M. **Priorité** : moyenne.

---

## 4. Déroulé d'un match (toss / avantage / scores / confirmation)

### Toss non réinitialisable / pas d'annulation
- **État actuel** : `/toss` refuse un second tirage (`m.tossWinnerLogin` → « tirage déjà
  effectué »). `/advantage` refuse un second choix (« avantage déjà choisi »).
- **Ce qui manque / problème** : aucune voie de correction si le toss a été lancé par erreur
  (mauvais match annoncé) ou si l'avantage a été mal cliqué. Pas de « refaire le toss » même
  pour un admin/officiant. Le reshuffle est bloqué dès qu'un `tossAt` existe
  (`index.ts` reshuffle, condition `tossAt: { not: null }`), donc un toss accidentel
  **gèle** définitivement le bracket avant le premier vrai score.
- **Fichiers concernés** : `index.ts` (`/toss`, `/advantage`, `/reshuffle`).
- **Piste d'implémentation** : route admin `/matches/:id/reset-toss` remettant
  `tossWinnerLogin/tossSide/advantagePick/tossAt` à null ; assouplir la condition de reshuffle
  pour ignorer un toss sans score confirmé.
- **Effort** : S. **Priorité** : moyenne.

### Le toss n'impose rien — l'avantage est purement déclaratif
- **État actuel** : `advantagePick` est stocké mais n'a aucun effet mécanique
  (`schema.prisma:352`). Pour `complementary: true` (babyfoot/échecs), l'option non choisie
  « revient à l'adversaire » mais ce n'est qu'un commentaire (`games.ts:65`) — rien n'est
  persisté côté adversaire.
- **Ce qui manque / problème** : l'avantage est informatif, jamais vérifié contre le score.
  Acceptable pour du présentiel, mais aucune trace de « qui a eu quoi » côté adversaire, et
  pas d'affichage récapitulatif de l'avantage dans l'historique du match.
- **Fichiers concernés** : `games.ts`, `index.ts`, `TournoiDetailPage.tsx`.
- **Piste d'implémentation** : stocker explicitement l'option de l'adversaire pour
  `complementary`, ou au minimum afficher « A : balle / B : terrain » dans le récap.
- **Effort** : S. **Priorité** : basse.

### Confirmation : mismatch de score reset complet, pas de négociation
- **État actuel** : si le confirmeur saisit un score différent, tout est remis à null et il
  faut **tout ressaisir** (`index.ts` confirm, `scoreA: null …` + message « Score reset »).
- **Ce qui manque / problème** : un simple écart force un cycle complet de re-saisie/re-confirmation.
  Pas d'historique des tentatives, pas de « contestation » distincte d'une erreur de frappe,
  pas de limite au nombre d'allers-retours (boucle de désaccord infinie possible →
  blocage du tournoi sans intervention admin).
- **Fichiers concernés** : `apps/backend/src/index.ts` (`/confirm`),
  `apps/web/src/pages/TournoiDetailPage.tsx`.
- **Piste d'implémentation** : compteur de désaccords ; au-delà d'un seuil, escalade
  automatique vers l'organisateur/admin (force-result). Notifier l'orga d'un litige.
- **Effort** : M. **Priorité** : moyenne.

### Pas de timer / d'expiration d'une saisie en attente
- **État actuel** : `recordedAt` posé, mais aucune logique d'expiration.
- **Ce qui manque / problème** : un score saisi mais jamais confirmé bloque le match
  indéfiniment. Aucun rappel automatique, aucun délai au bout duquel l'orga est sollicité.
- **Fichiers concernés** : `index.ts`, job/cron éventuel.
- **Piste d'implémentation** : notification de relance après X heures ; badge « en attente de
  confirmation depuis … » dans l'UI.
- **Effort** : M. **Priorité** : basse.

### `reject` réservé aux 1v1 (n'utilise pas la map des coéquipiers)
- **État actuel** : `/reject` vérifie `m.playerALogin !== me && m.playerBLogin !== me`
  (`index.ts` reject), contrairement à `/record` et `/confirm` qui utilisent
  `tournamentPartnerMap` + `teamMembersOf`.
- **Ce qui manque / problème** : en 2v2, le **coéquipier** du capitaine (qui n'est pas
  `playerALogin`/`playerBLogin`) ne peut **pas** rejeter un score erroné — seul le capitaine
  le peut. Incohérence avec record/confirm qui acceptent tout membre d'équipe.
- **Fichiers concernés** : `apps/backend/src/index.ts` (route `/reject`).
- **Piste d'implémentation** : aligner sur `teamMembersOf` comme record/confirm.
- **Effort** : S. **Priorité** : haute.

### Pas de re-saisie possible après confirmation (sauf force-result admin)
- **État actuel** : tout endpoint refuse `m.confirmedAt` non nul.
- **Ce qui manque / problème** : une erreur confirmée (mauvais vainqueur) ne peut être
  corrigée que par un admin via `force-result` — mais `force-result` refuse aussi
  `m.confirmedAt` (« match already confirmed »). **Donc un match confirmé par erreur est
  irrécupérable** sans manipulation directe en base, et il a déjà propagé le gagnant /
  crédité les paris / versé le cash-prize.
- **Fichiers concernés** : `index.ts` (`force-result`, `settleConfirmedTournamentMatch`).
- **Piste d'implémentation** : endpoint admin de **rollback** d'un match confirmé (annuler la
  propagation au tour suivant, ré-ouvrir le match, rembourser/annuler les paris déjà réglés).
  Complexe à cause des effets de bord (paris, cash-prize, titre). À cadrer.
- **Effort** : L. **Priorité** : moyenne.

---

## 5. Forfaits, abandons, no-show & deadlines

### Aucune notion de forfait / abandon
- **État actuel** : un match ne peut se conclure que par un score valide
  (`validateTournamentScore`) saisi + confirmé, ou un force-result admin.
- **Ce qui manque / problème** : si un joueur ne se présente pas ou abandonne, il n'existe
  **aucun** mécanisme propre (« W.O. / forfait »). L'orga doit inventer un score (force-result)
  ce qui pollue les stats. Pas de statut `forfeit`, pas d'attribution automatique de la
  victoire à l'adversaire, pas de notification de no-show.
- **Fichiers concernés** : `schema.prisma` (`TournamentMatch`), `index.ts`, `games.ts`.
- **Piste d'implémentation** : ajouter `outcome: 'played' | 'forfeit' | 'doubleForfeit'` ou un
  bool `forfeit` + `forfeitedBy`. Route `/matches/:id/forfeit` (participant ou orga) →
  `winnerLogin` = adversaire, `confirmedAt` posé, score conventionnel non comptabilisé en
  stats. Gérer le double forfait (les deux éliminés → bye au tour suivant).
- **Effort** : M. **Priorité** : haute.

### Pas de gestion du désistement d'un joueur en cours de tournoi
- **État actuel** : `purgeUserFromTournaments` (`index.ts:289`) ne libère une entrée que si
  `status='registration'`. La suppression de compte met `playerALogin/B` à null sur les
  matchs (`index.ts:3569-3571`) mais sans relancer la propagation.
- **Ce qui manque / problème** : si un joueur quitte (ban, départ, suppression de compte) en
  plein tournoi `in_progress`, ses futurs matchs se retrouvent avec un slot `null` et le
  bracket se **bloque** (le toss et le record exigent deux joueurs). Aucune logique
  d'avancement automatique de l'adversaire restant.
- **Fichiers concernés** : `index.ts` (purge, suppression de compte).
- **Piste d'implémentation** : sur retrait d'un joueur d'un tournoi en cours, traiter ses
  matchs non joués comme des forfaits et propager l'adversaire ; ou marquer le tournoi
  « à arbitrer ».
- **Effort** : M. **Priorité** : haute.

### Pas de date / deadline ni de planning
- **État actuel** : `Tournament` n'a que `createdAt/startedAt/finishedAt` (`schema.prisma:258-260`).
  Pas de `scheduledAt`, pas de date limite d'inscription, pas d'horaires de matchs.
- **Ce qui manque / problème** : impossible de programmer un tournoi à l'avance, d'afficher un
  compte à rebours, de fermer automatiquement les inscriptions à une date, ou d'auto-démarrer
  à une heure donnée. Les Challenges classiques ont un `scheduledAt` (`schema.prisma:370`),
  pas les tournois.
- **Fichiers concernés** : `schema.prisma`, `schemas.ts`, formulaire, UI.
- **Piste d'implémentation** : `registrationDeadline` + `startsAt` ; cron de fermeture/start ;
  affichage du planning.
- **Effort** : M. **Priorité** : moyenne.

---

## 6. Mode 2v2

### 2v2 limité au babyfoot par règle, pas par capacité technique
- **État actuel** : refine `mode !== '2v2' || game === 'babyfoot'` (`schemas.ts:262`),
  message « le mode 2v2 est réservé au babyfoot ».
- **Ce qui manque / problème** : le moteur de bracket 2v2 (capitaine + `partnerLogin`) est
  générique et ne dépend pas du babyfoot ; smash 2v2 / SF 2v2 seraient envisageables. La
  restriction est un choix produit non remis en question, à documenter explicitement comme
  « dette » si l'on veut l'ouvrir.
- **Fichiers concernés** : `schemas.ts`, `games.ts` (notion d'équipe par discipline).
- **Piste d'implémentation** : flag `supportsTeams` par discipline dans `games.ts` ; ELO 2v2
  existe déjà (`packages/shared/src/elo2v2.ts`) mais n'est pas appliqué aux tournois (cf.
  ci-dessous).
- **Effort** : M. **Priorité** : basse.

### Pas de changement / remplacement de coéquipier
- **État actuel** : la paire est fixée à l'inscription (`partnerLogin` sur l'entry,
  `schema.prisma:320`). Aucun endpoint pour changer de coéquipier.
- **Ce qui manque / problème** : si un coéquipier devient indisponible avant le start, il faut
  retirer toute l'équipe et la réinscrire. Pas de gestion de remplacement ni en cours de
  tournoi.
- **Fichiers concernés** : `index.ts`, `TournoiDetailPage.tsx`.
- **Piste d'implémentation** : route `/entries/:login/partner` (phase registration) pour
  remplacer le `partnerLogin` après validation (joueur libre, distinct).
- **Effort** : S. **Priorité** : basse.

### Le coéquipier ne consent jamais explicitement (pas d'invitation 2v2)
- **État actuel** : le capitaine engage son coéquipier directement (`tournaments` create /
  join / add-player). Les invitations sont **interdites en 2v2**
  (`index.ts` invite : « tournoi 2v2 : pas d'invitations »).
- **Ce qui manque / problème** : un joueur peut être inscrit comme coéquipier **sans son
  accord** (juste par disponibilité). Aucune confirmation côté coéquipier. C'est validé par
  `ensureRealAvailablePlayer` mais pas par le consentement de l'intéressé.
- **Fichiers concernés** : `index.ts` (création/join/add-player 2v2).
- **Piste d'implémentation** : flux d'invitation de paire (le coéquipier accepte avant
  inscription effective), ou notification « tu as été engagé dans le tournoi X » avec
  possibilité de se retirer.
- **Effort** : M. **Priorité** : moyenne.

### L'ELO 2v2 n'est pas impacté par les tournois (cohérent mais non documenté côté UI)
- **État actuel** : les tournois n'impactent aucun ELO (« sans impact ELO »,
  `tournois.ts` locale:27). `elo2v2.ts` existe pour les matchs/défis 2v2 hors tournoi.
- **Ce qui manque / problème** : si l'on souhaitait un jour des tournois « classés », rien
  n'est branché. À noter comme angle mort, pas un bug.
- **Fichiers concernés** : `index.ts` (settle), `elo2v2.ts`.
- **Piste d'implémentation** : hors périmètre actuel ; flag `ranked` futur.
- **Effort** : L. **Priorité** : basse.

### Affichage des paires dans le bracket : capitaine seul mis en avant
- **État actuel** : le bracket représente une équipe par le login capitaine ; `entriesOut`
  résout le coéquipier pour l'affichage (`index.ts` `/tournaments/:id`, mode 2v2).
- **Ce qui manque / problème** : à vérifier dans `BracketTree` — le coéquipier est-il
  visible dans chaque cellule du bracket (et pas seulement dans la liste d'entrées) ? Risque
  d'afficher uniquement le capitaine dans l'arbre, perdant l'identité de l'équipe.
- **Fichiers concernés** : `apps/web/src/components/tournois/BracketTree.tsx`,
  `apps/web/src/pages/TournoiDetailPage.tsx`.
- **Piste d'implémentation** : propager la map capitaine→paire jusqu'aux cellules du bracket.
- **Effort** : S. **Priorité** : moyenne.

---

## 7. Tournoi fléchettes & disciplines multijoueurs

### Tournoi fléchettes non supporté (rejet explicite)
- **État actuel** : `validateTournamentScore` retourne pour `darts` « les fléchettes ne se
  jouent pas en tournoi » (`games.ts`), commentaire `games.ts:145-147`. `pending.md:18`
  acte : « Tournoi fléchettes : non supporté (multijoueur incompatible bracket binaire) ».
- **Ce qui manque / problème** : `GameSchema` inclut `flechettes` (`schemas.ts:15`) et le
  formulaire de création n'empêche peut-être pas de sélectionner fléchettes → un tournoi
  fléchettes pourrait être **créé** puis **bloqué au premier score** (UX en cul-de-sac).
  À vérifier : le sélecteur de discipline du `CreateTournamentPage` exclut-il fléchettes ?
  Le moteur de bracket est binaire (2 joueurs/match) alors que les fléchettes sont 2–8 joueurs.
- **Fichiers concernés** : `packages/shared/src/games.ts`, `schemas.ts`,
  `apps/web/src/pages/tournois/CreateTournamentPage.tsx`,
  `apps/web/src/pages/tournois/mobile/CreateTournamentSheet.tsx`, `BracketTree.tsx`.
- **Piste d'implémentation** : court terme — **interdire fléchettes** dans
  `CreateTournamentSchema` (refine) et masquer la discipline dans les sélecteurs, avec message
  clair. Long terme — concevoir un format fléchettes (poules de 4 multijoueurs → bracket de
  duels 1v1 301, ou tournoi à manches multijoueurs avec classement par leg).
- **Effort** : S (interdiction) / L (support réel). **Priorité** : haute (interdiction).

### Le composant de saisie de score ne gère pas les fléchettes
- **État actuel** : le `ScoreEntry` de `TournoiDetailPage` branche `chess` (binaire),
  `smash`/`streetfighter` (sets), et **retombe sur babyfoot** (abaque du perdant) pour tout
  le reste (`TournoiDetailPage.tsx:1268-1335`).
- **Ce qui manque / problème** : un tournoi fléchettes (s'il était créable) afficherait
  l'abaque babyfoot (score 0–9 du perdant), totalement inadapté. Pas de garde-fou UI.
- **Fichiers concernés** : `apps/web/src/pages/TournoiDetailPage.tsx`.
- **Piste d'implémentation** : lié au point précédent ; tant que fléchettes n'est pas
  supporté, empêcher en amont ; sinon, brancher une saisie 301/501 dédiée.
- **Effort** : S. **Priorité** : haute.

---

## 8. Échecs : nulles & matchs parallèles

### Les nulles d'échecs sont impossibles en tournoi
- **État actuel** : `GAMES.chess.hasDraw = true` et `formatScore` rend `½-½`
  (`games.ts:113-116`), mais `validateTournamentScore` **refuse l'égalité** : « il faut un
  vainqueur (pas de match nul en tournoi) » (`games.ts`). Côté UI, le `ScoreEntry` échecs
  force un clic binaire `1-0`/`0-1` sans bouton nulle (`TournoiDetailPage.tsx:1243-1262`).
- **Ce qui manque / problème** : contradiction interne — la discipline supporte la nulle
  partout sauf en tournoi, sans mécanisme de départage (mort subite, Armageddon, blitz de
  départage). Une vraie nulle d'échecs bloque donc le joueur (aucun moyen de la déclarer).
- **Fichiers concernés** : `packages/shared/src/games.ts`, `apps/web/src/pages/TournoiDetailPage.tsx`.
- **Piste d'implémentation** : soit assumer « pas de nulle, rejouez/Armageddon » et le
  documenter dans l'UI ; soit autoriser la nulle en poule (1 point chacun) et un départage
  obligatoire en bracket. Si nulle en poule : adapter `poolStandings` (système de points,
  pas seulement victoires).
- **Effort** : M. **Priorité** : moyenne.

### Pas de gestion de matchs en parallèle (« sans tour imposé »)
- **État actuel** : les commentaires indiquent que les échecs se jouent « en parallèle, pas de
  tour imposé » (`schema.prisma:263`, `index.ts` announce) et que l'`announce`/écran VERSUS
  est « sans objet aux échecs ».
- **Ce qui manque / problème** : pour les échecs (et idéalement toute discipline), aucun
  affichage clair « plusieurs matchs jouables simultanément ». Le concept de « match suivant »
  unique (`activeMatchId`) ne convient pas. Pas de vue « tous les matchs prêts » multi-actifs.
- **Fichiers concernés** : `TournoiDetailPage.tsx`, `BracketTree.tsx`, `index.ts`.
- **Piste d'implémentation** : pour `game === 'chess'`, masquer l'announce/VERSUS et lister
  tous les matchs jouables (`isChess` est déjà détecté `TournoiDetailPage.tsx:768`) — vérifier
  que la liste multi-active est réellement rendue.
- **Effort** : S. **Priorité** : basse.

---

## 9. Paris sur tournoi

### Pari uniquement sur le vainqueur final — pas de paris par match
- **État actuel** : un seul pari par tournoi, sur le **vainqueur** (`DOMAIN.md:407` :
  « les paris match par match ont été [retirés] »). Cote interpolée des paliers via
  `settleTournamentBetsForPick` / `tournament-economy.ts`.
- **Ce qui manque / problème** : pas de pari sur un match individuel, ni sur « qui atteint la
  finale », ni de cote dynamique. Marché unique et figé.
- **Fichiers concernés** : `index.ts` (paris), `packages/shared/src/tournament-economy.ts`,
  `apps/web/src/components/tournois/TournamentBets.tsx`.
- **Piste d'implémentation** : modèle de pari par match (réutiliser `Bet` avec un `matchId`) ;
  à cadrer avec l'anti-farming.
- **Effort** : L. **Priorité** : basse.

### Fenêtre de paris très étroite (avant le 1er score) et verrou irréversible
- **État actuel** : marché ouvert seulement quand `status='in_progress'` et avant le premier
  `betsLockedAt` (posé au tout premier score saisi, jamais remis à null — `schema.prisma:345-348`).
- **Ce qui manque / problème** : si l'orga annonce/joue très vite le 1er match, la fenêtre de
  paris peut durer quelques secondes seulement. Pas de phase « paris ouverts » dédiée avant le
  premier match. Le verrou est global au tournoi (pas par match), donc un toss sur le 1er match
  ne ferme pas mais le 1er score oui.
- **Fichiers concernés** : `index.ts`, `TournamentBets.tsx`.
- **Piste d'implémentation** : ouvrir le marché dès `registration` (ou une phase « avant
  coup d'envoi ») et le fermer au démarrage effectif du premier duel annoncé, avec un délai
  d'affichage explicite.
- **Effort** : M. **Priorité** : moyenne.

### Cotes / paliers peu lisibles côté UI
- **État actuel** : `betFinalMult` 2–10 (officiels), interpolation linéaire des paliers
  (`schema.prisma:274-277`).
- **Ce qui manque / problème** : l'utilisateur ne voit probablement pas clairement « si mon
  poulain atteint les demis, je touche ×N » (table des paliers). À vérifier dans
  `TournamentBets.tsx`. Pas de simulateur de gain.
- **Fichiers concernés** : `apps/web/src/components/tournois/TournamentBets.tsx`.
- **Piste d'implémentation** : table « tour atteint → multiplicateur → gain estimé » calculée
  depuis `tournament-economy.ts` (logique partagée).
- **Effort** : S. **Priorité** : basse.

---

## 10. Récompenses & cash-prize

### Cash-prize débité de personne (création monétaire)
- **État actuel** : `cashPrizeBase` et `prizeCoins` sont **versés** au champion à la finale
  (`settleConfirmedTournamentMatch`, `grantCoinsTx`/`payCashPrizeTx`) mais ne sont **jamais
  prélevés** à l'organisateur ni à un pot commun. Réservé aux officiels (admins).
- **Ce qui manque / problème** : le cash-prize crée des coins ex nihilo (inflation). Pas de
  « cagnotte » alimentée par des frais d'inscription, pas de séquestre (escrow) au moment de
  la création. Risque d'incohérence économique si l'on ouvre les officiels plus largement.
- **Fichiers concernés** : `index.ts` (create + settle), `tournament-economy.ts`.
- **Piste d'implémentation** : séquestrer `cashPrizeBase` sur le solde du créateur à la
  création (débit), rembourser à l'annulation ; ou des frais d'inscription des participants
  formant le pot. À cadrer avec la spec économie.
- **Effort** : M. **Priorité** : moyenne.

### Cosmétique de récompense : pas de déséquipement ni de gestion de doublon
- **État actuel** : récompense cosmétique versée en inventaire sans auto-équipement
  (`index.ts:4359-4361`, `grantItemTx(tx, w, prizeItemId, false)`).
- **Ce qui manque / problème** : si le gagnant possède **déjà** l'item, comportement à
  vérifier (doublon silencieux ? pas de coins de compensation ?). Pas de « prix de
  consolation » pour les autres. Cosmétique créée inline en `active:false` (masquée boutique)
  → si le tournoi est annulé, `cleanupOrphanPrizeTx` est appelé (cancel) mais la cohérence
  d'un item orphelin déjà attribué n'est pas évidente.
- **Fichiers concernés** : `index.ts` (settle, cancel, `cleanupOrphanPrizeTx`).
- **Piste d'implémentation** : compensation en coins si l'item est déjà possédé ; tests sur le
  cycle de vie de l'item-récompense.
- **Effort** : M. **Priorité** : basse.

### Récompense versée une seule fois, pas de podium (2e/3e récompensés)
- **État actuel** : seul le champion reçoit `prizeCoins`/`prizeItemId`. Le cash-prize a des
  paliers (par tours franchis) mais la récompense cosmétique/coins est binaire (champion only).
- **Ce qui manque / problème** : pas de dotation au finaliste ni au podium. Pas d'affichage du
  palmarès complet du tournoi terminé.
- **Fichiers concernés** : `index.ts` (settle), schema.
- **Piste d'implémentation** : table de dotation par rang ; lié à la petite finale (§1).
- **Effort** : M. **Priorité** : basse.

### Pas de badge / trophée persistant « vainqueur du tournoi X »
- **État actuel** : seul le compteur `tournamentsWon*` est incrémenté (`index.ts:4348-4352`).
- **Ce qui manque / problème** : pas de trace nominative du tournoi gagné (nom, date) dans le
  profil ; pas de badge dédié. L'historique d'un joueur ne liste pas « gagné : Coupe d'été ».
- **Fichiers concernés** : profil utilisateur, `schema.prisma`.
- **Piste d'implémentation** : exposer la liste des `Tournament` `winnerLogin = me` dans le
  profil (déjà requêtable) ; éventuel badge `titles.ts`.
- **Effort** : S. **Priorité** : basse.

---

## 11. Reshuffle & édition du bracket

### Reshuffle hors transaction → fenêtre d'incohérence
- **État actuel** : `/reshuffle` fait `deleteMany` puis `launchTournamentMatches` **hors
  transaction** (commentaire `index.ts:4990-4991` : « generateBracket écrit via le client
  global »).
- **Ce qui manque / problème** : entre la suppression et la régénération, le tournoi est
  momentanément sans matchs ; un lecteur concurrent (ou un autre reshuffle simultané) peut
  voir un état vide ou doublonner. Pas de verrou. `generateBracket`/`generatePools` utilisent
  `prisma` global et **ne peuvent pas** s'exécuter dans une `$transaction` (dette
  architecturale : ils devraient accepter un `tx`).
- **Fichiers concernés** : `apps/backend/src/tournament.ts` (signatures),
  `apps/backend/src/index.ts` (`/reshuffle`, `/start`, settle bracket-des-poules).
- **Piste d'implémentation** : passer un `Prisma.TransactionClient` en paramètre à
  `generateBracket`/`generatePools` pour pouvoir tout exécuter dans une transaction unique
  (delete + recreate atomiques). Verrou applicatif sur le tournoi.
- **Effort** : M. **Priorité** : haute.

### Reshuffle ne notifie pas les joueurs
- **État actuel** : `/start` notifie tous les inscrits ; `/reshuffle` ne notifie personne (il
  s'appuie seulement sur le broadcast `tournament:update`).
- **Ce qui manque / problème** : un joueur qui avait repéré son adversaire ne sait pas que le
  bracket a changé. Pas de notif « le tirage a été refait ».
- **Fichiers concernés** : `index.ts` (`/reshuffle`).
- **Piste d'implémentation** : `notifyMany` aux entries après reshuffle.
- **Effort** : S. **Priorité** : basse.

### Pas d'édition manuelle du bracket par l'admin (swap de joueurs)
- **État actuel** : seules options = reshuffle complet (avant 1er match) ou force-result.
- **Ce qui manque / problème** : impossible d'**échanger** deux joueurs de place, de corriger
  un placement, ou d'insérer un remplaçant sans tout retirer/relancer.
- **Fichiers concernés** : `index.ts`, panneau admin.
- **Piste d'implémentation** : endpoint admin de swap (round 1, avant tout score) modifiant
  `playerALogin/B` de deux slots.
- **Effort** : M. **Priorité** : basse.

---

## 12. Invitations & inscription

### Invitations non expirables et sans relance
- **État actuel** : `TournamentInvite` a `status pending/accepted/declined` + `decidedAt`
  (`schema.prisma:295-312`), pas d'expiration.
- **Ce qui manque / problème** : une invitation en attente le reste indéfiniment ; pas de
  relance, pas d'expiration au démarrage du tournoi (un invité non décidé après le start est
  dans un état mort). Pas de limite du nombre d'invitations en attente vs places restantes
  (sur-invitation possible au-delà de la capacité).
- **Fichiers concernés** : `schema.prisma`, `index.ts` (invite/accept).
- **Piste d'implémentation** : `expiresAt` ; purge des `pending` au start ; contrôle
  `pending + entries <= capacity` au moment d'inviter.
- **Effort** : M. **Priorité** : moyenne.

### Accept d'invitation : course possible sur la dernière place
- **État actuel** : `/invites/:id/accept` vérifie « tournoi complet » dans une transaction
  (`index.ts` accept) — à confirmer que le `count` d'entries est bien fait dans la même
  transaction sérialisée.
- **Ce qui manque / problème** : sans isolation suffisante, deux accepts simultanés sur la
  dernière place peuvent dépasser la capacité (la contrainte `@@id([tournamentId, login])`
  empêche les doublons mais pas le dépassement de `capacity`).
- **Fichiers concernés** : `index.ts` (accept / join / add-player).
- **Piste d'implémentation** : verrou applicatif ou `SELECT … FOR UPDATE` sur le tournoi ;
  re-vérifier la capacité juste avant insert.
- **Effort** : M. **Priorité** : moyenne.

### Pas de liste d'attente
- **État actuel** : au-delà de la capacité, join/invite renvoie « tournament is full ».
- **Ce qui manque / problème** : aucune file d'attente ; si un inscrit se retire, la place ne
  se réattribue pas automatiquement.
- **Fichiers concernés** : `schema.prisma`, `index.ts`.
- **Piste d'implémentation** : table `TournamentWaitlist` + promotion automatique au retrait.
- **Effort** : M. **Priorité** : basse.

### Inscription : pas de check-in avant le start
- **État actuel** : start exige exactement `entries.length === capacity`
  (`index.ts:4934`).
- **Ce qui manque / problème** : pas de phase de confirmation de présence (« check-in »)
  avant le lancement → des inscrits absents bloquent le démarrage (il faut les retirer un par
  un). Pas de start « partiel » avec byes pour les manquants.
- **Fichiers concernés** : `index.ts` (`/start`).
- **Piste d'implémentation** : check-in optionnel ; autoriser le start dès `entries >= 2` avec
  byes (cohérent avec le moteur qui gère les byes).
- **Effort** : M. **Priorité** : moyenne.

---

## 13. Cérémonie de lancement & match « suivant »

### `activeMatchId` : un seul match actif, pas de file ni de concurrence
- **État actuel** : `announce` pose `activeMatchId` sur le tournoi (`schema.prisma:264`,
  `index.ts` announce), effacé à la confirmation. Sans objet aux échecs.
- **Ce qui manque / problème** : un seul match peut être « en cours » à la fois pour tout le
  tournoi. Sur un tournoi à 16 joueurs avec 8 matchs de round 1, impossible de désigner
  plusieurs duels simultanés (table multiple). Goulot d'étranglement organisationnel.
- **Fichiers concernés** : `schema.prisma`, `index.ts` (`announce`), `TournoiDetailPage.tsx`.
- **Piste d'implémentation** : passer d'un `activeMatchId` unique à un flag `isActive` /
  `activeAt` par `TournamentMatch` (multi-actifs) ; adapter l'écran VERSUS pour gérer
  plusieurs duels.
- **Effort** : M. **Priorité** : moyenne.

### Cérémonie de lancement : couverture des cas et accessibilité
- **État actuel** : `TournamentLaunchCeremony.tsx` (16k) + `VersusOverlay.tsx` +
  `CoinFlip.tsx`/`CoinFlipOverlay.tsx` animent le lancement, le VERSUS et le pile-ou-face.
- **Ce qui manque / problème** : à auditer — respect de `prefers-reduced-motion` (animations
  lourdes), possibilité de **skip** la cérémonie, comportement si l'utilisateur arrive en cours
  d'animation (état partagé via WS), gestion d'un VERSUS déclenché alors qu'on est sur une
  autre page. Pas de garantie que tous les spectateurs voient la même chose au même moment
  (désynchronisation possible selon la latence WS).
- **Fichiers concernés** : `apps/web/src/components/tournois/TournamentLaunchCeremony.tsx`,
  `VersusOverlay.tsx`, `CoinFlip.tsx`, `CoinFlipOverlay.tsx`.
- **Piste d'implémentation** : guard `prefers-reduced-motion`, bouton « passer », horodatage
  serveur du déclenchement pour resynchroniser.
- **Effort** : M. **Priorité** : moyenne.

### Le toss/coin-flip n'est pas rejouable ni partagé de façon garantie
- **État actuel** : le résultat du toss est figé en base et l'animation `CoinFlip` lit
  `tossSide` (`schema.prisma:351`).
- **Ce qui manque / problème** : un joueur qui rate l'animation (rechargement) voit juste le
  résultat sans l'effet ; pas de « rejouer l'animation ». Acceptable mais à noter.
- **Fichiers concernés** : `CoinFlipOverlay.tsx`.
- **Piste d'implémentation** : bouton replay local.
- **Effort** : S. **Priorité** : basse.

---

## 14. Affichage bracket / poules (UX)

### Scalabilité du `BracketTree` pour 32/64 joueurs
- **État actuel** : `BracketTree.tsx` (15k) rend l'arbre complet.
- **Ce qui manque / problème** : à vérifier — pour 64 joueurs (6 rounds, 32 matchs au 1er
  tour), lisibilité, scroll horizontal/vertical, mini-map, zoom. Sur mobile (`TournoisMobile`,
  détail partagé), un bracket large est probablement difficile à parcourir. Pas de vue
  « parcours d'un joueur » (suivre uniquement sa branche).
- **Fichiers concernés** : `apps/web/src/components/tournois/BracketTree.tsx`,
  `apps/web/src/pages/TournoiDetailPage.tsx`.
- **Piste d'implémentation** : zoom/scroll virtualisé, vue compacte mobile, filtre « ma
  branche ».
- **Effort** : M. **Priorité** : moyenne.

### Détail tournoi : page unique sans split desktop/mobile dédié
- **État actuel** : la **liste** des tournois a un split `TournoisDesktop`/`TournoisMobile`
  (`apps/web/src/pages/tournois/`), mais le **détail** est une page unique
  `TournoiDetailPage.tsx` (1336 lignes) avec quelques classes responsives
  (`sm:`/`lg:`, lignes 542, 806).
- **Ce qui manque / problème** : un seul composant monolithique gère desktop et mobile via
  utilitaires Tailwind, contrairement au pattern Desktop/Mobile adopté ailleurs. Risque de
  divergence d'UX et de page très lourde. Pas de version mobile optimisée du bracket/poules.
- **Fichiers concernés** : `apps/web/src/pages/TournoiDetailPage.tsx`.
- **Piste d'implémentation** : extraire des sous-composants (en-tête, bracket, panneau
  d'actions, bets) ; éventuellement un `TournoiDetailMobile` aligné sur le reste du domaine.
- **Effort** : L. **Priorité** : basse.

### Pas de partage / lien public d'un bracket
- **État actuel** : `/tournaments/:id` est public sauf tournois privés (`index.ts:4450-4459`).
- **Ce qui manque / problème** : pas d'image/OG partageable du bracket, pas de mode « écran
  géant / spectateur » plein écran pour projeter le tournoi.
- **Fichiers concernés** : front.
- **Piste d'implémentation** : route spectateur plein écran, export PNG du bracket.
- **Effort** : M. **Priorité** : basse.

### Pas d'historique / récap d'un match dans l'arbre
- **État actuel** : un match confirmé affiche le score final.
- **Ce qui manque / problème** : pas de détail (qui a saisi, qui a confirmé, avantage choisi,
  heure) au clic sur un match. `recordedByLogin`/`tossSide`/`advantagePick` sont en base mais
  pas forcément exposés à l'UI.
- **Fichiers concernés** : `TournoiDetailPage.tsx`, `BracketTree.tsx`.
- **Piste d'implémentation** : popover de détail de match.
- **Effort** : S. **Priorité** : basse.

---

## 15. Notifications & temps réel

### Notifications partielles selon les événements
- **État actuel** : notifs au start (`index.ts:4944`), à la fin des poules
  (`index.ts:5158`/`6374`). Le broadcast `tournament:update` couvre les mutations
  (`index.ts:877-879`).
- **Ce qui manque / problème** : pas de notif « c'est ton tour de jouer » (quand un match
  devient jouable / annoncé), pas de notif au gagnant/perdant de match, pas de notif
  « le tournoi est terminé, voici le podium » à tous les participants (seulement
  panel:update au champion). Pas de notif aux invités quand le tournoi démarre sans eux.
- **Fichiers concernés** : `index.ts` (announce, settle, finale).
- **Piste d'implémentation** : `notifyMany` ciblé sur les deux joueurs d'un match annoncé ;
  notif de fin à tous les participants.
- **Effort** : M. **Priorité** : moyenne.

### Préférence `notifyTournament` : granularité unique
- **État actuel** : un seul flag `notifyTournament` (`schema/index.ts:2090`).
- **Ce qui manque / problème** : pas de réglage fin (start vs mon tour vs résultats vs paris).
- **Fichiers concernés** : préférences de suivi.
- **Piste d'implémentation** : sous-préférences.
- **Effort** : S. **Priorité** : basse.

### Broadcast global `tournament:update` (payload vide) → sur-rafraîchissement
- **État actuel** : toute mutation `/tournaments*` émet `{ type:'tournament:update', payload:{} }`
  à **tout le monde** (`index.ts:877-879`).
- **Ce qui manque / problème** : pas de payload ciblé (id du tournoi/match) → tous les clients
  re-fetchent la liste/détail même si ça ne les concerne pas. Coût réseau et re-render inutile
  à grande échelle.
- **Fichiers concernés** : `index.ts` (middleware broadcast), clients WS.
- **Piste d'implémentation** : inclure `tournamentId` dans le payload ; le front ne rafraîchit
  que s'il regarde ce tournoi (ou la liste).
- **Effort** : M. **Priorité** : basse.

---

## 16. Administration & modération

### Force-result limité aux matchs non confirmés (cf. §4)
- **État actuel** : `force-result` refuse `confirmedAt` non nul.
- **Ce qui manque / problème** : pas de correction d'un résultat **déjà** confirmé/propagé
  (voir §4 « rollback »). C'est la lacune admin la plus impactante.
- **Fichiers concernés** : `index.ts` (`force-result`).
- **Piste d'implémentation** : voir §4.
- **Effort** : L. **Priorité** : moyenne.

### Pas d'édition admin des paramètres économiques après création
- **État actuel** : `PATCH /admin/tournaments/:id` existe (`index.ts:6601`) mais portée à
  vérifier (nom/image ?). `betFinalMult`/`cashPrizeBase`/`prize` sont posés à la création.
- **Ce qui manque / problème** : impossible d'ajuster une dotation après coup, ou de
  transformer un amical en officiel. À confirmer ce que `PATCH` autorise réellement.
- **Fichiers concernés** : `index.ts` (`PATCH /admin/tournaments/:id`).
- **Piste d'implémentation** : étendre le PATCH aux champs économie (avec garde-fous : pas
  après le 1er score / pas après l'ouverture des paris).
- **Effort** : M. **Priorité** : basse.

### `force-result` côté organisateur amical : pas de garde-fou de stage
- **État actuel** : l'officiant (créateur d'un tournoi amical) peut forcer n'importe quel
  match non confirmé (`index.ts:6305-6310`).
- **Ce qui manque / problème** : risque d'abus (l'orga décide les résultats de ses propres
  matchs). Pas de journalisation visible pour les autres participants (`logAdminAction` est
  interne). Pas de limite « l'orga ne peut pas forcer un match où il joue ».
- **Fichiers concernés** : `index.ts` (`force-result`).
- **Piste d'implémentation** : interdire à l'orga de forcer un match où il est participant ;
  afficher publiquement « résultat arbitré par l'organisateur ».
- **Effort** : S. **Priorité** : moyenne.

### Suppression admin : effets sur paris/cash-prize déjà versés
- **État actuel** : `DELETE /admin/tournaments/:id` (`index.ts:6187`) + cancel remboursent les
  paris **ouverts** (`refundOpenBetsForTournamentTx`).
- **Ce qui manque / problème** : si le tournoi est supprimé après que des paris ont été
  **réglés** ou un cash-prize **versé**, pas de reprise des gains (asymétrie). Cas limite à
  documenter/garder.
- **Fichiers concernés** : `index.ts` (delete/cancel).
- **Piste d'implémentation** : interdire la suppression d'un tournoi `finished` avec récompenses
  versées, ou tracer la non-réversibilité.
- **Effort** : S. **Priorité** : basse.

---

## 17. Validation, robustesse & cas limites

### `totalRounds` du règlement calculé par agrégat — fragile aux brackets atypiques
- **État actuel** : `settleConfirmedTournamentMatch` calcule `totalBracketRounds` via un
  `aggregate` `_max round` sur les matchs `stage='bracket'` (`index.ts:4298-4306`), commentaire
  « byes/poules font diverger taille et capacité ».
- **Ce qui manque / problème** : si pour une raison quelconque les matchs de bracket sont
  partiellement créés (échec en cours de `generateBracket` hors transaction), `_max round`
  peut être faux → finale détectée trop tôt/tard. Pas de validation de l'intégrité du bracket
  après génération.
- **Fichiers concernés** : `index.ts`, `tournament.ts`.
- **Piste d'implémentation** : vérifier après génération que le nombre de matchs == size-1
  (élimination) ; transactionnaliser la génération (cf. §11).
- **Effort** : M. **Priorité** : moyenne.

### Capacité 8 minimum mais aucun garde-fou « assez de vrais joueurs »
- **État actuel** : capacité min 8 ; le start exige exactement `capacity` entries.
- **Ce qui manque / problème** : pas de tournoi à 2/4 joueurs (mini-tournoi impossible alors
  que le moteur le permet). Friction pour de petits événements.
- **Fichiers concernés** : `schemas.ts`.
- **Piste d'implémentation** : abaisser le min à 2 ou 4.
- **Effort** : S. **Priorité** : basse.

### `imageUrl` : URL externe non proxifiée (vie privée / disponibilité)
- **État actuel** : `imageUrl` restreint à http(s) (`schemas.ts:227-240`).
- **Ce qui manque / problème** : pas d'upload, pas de proxy/cache, pas de validation que
  l'URL pointe vraiment une image. Image externe peut casser (404), fuiter l'IP des
  visiteurs, ou changer. Pas de modération du contenu de l'image.
- **Fichiers concernés** : `schemas.ts`, front (rendu de l'image).
- **Piste d'implémentation** : upload géré + stockage, ou proxy/cache et content-type check.
- **Effort** : M. **Priorité** : basse.

### Rate-limit création : 5/24h par sujet — pas de quota d'inscriptions simultanées
- **État actuel** : `tournaments-create` 5/24h (`index.ts:771`).
- **Ce qui manque / problème** : pas de limite au nombre de tournois `registration` ouverts
  qu'un même créateur peut maintenir → spam de tournois vides possible dans la limite des 5/j.
- **Fichiers concernés** : `index.ts`.
- **Piste d'implémentation** : limite de tournois actifs simultanés par créateur.
- **Effort** : S. **Priorité** : basse.

### Validité du score : pas de borne supérieure explicite sur les sets / pas de Bo configurable
- **État actuel** : `validateTournamentScore` accepte `hi ∈ [1,3]` pour les sets
  (`games.ts`). Le `defaultBestOf=3` n'est pas paramétrable par tournoi.
- **Ce qui manque / problème** : impossible de jouer un tournoi smash/SF en Bo5 (finale en
  Bo5 par ex.) — le format est figé à Bo3 pour la saisie. Pas de réglage « format de série »
  par tournoi ou par round (finale plus longue).
- **Fichiers concernés** : `games.ts`, `schema.prisma`, `TournoiDetailPage.tsx`.
- **Piste d'implémentation** : `bestOf` sur le tournoi (et override possible pour la finale).
- **Effort** : M. **Priorité** : basse.

### Aucun garde-fou anti-collision login partenaire vs login capitaine entre équipes
- **État actuel** : le commentaire `schema.prisma:318-319` garantit « un login n'apparaît
  qu'une fois par tournoi » côté route, mais il n'y a pas de **contrainte DB** (le
  `partnerLogin` n'est pas dans la PK).
- **Ce qui manque / problème** : la garantie repose entièrement sur la logique applicative ;
  une route oubliée pourrait insérer un même login comme partenaire de deux équipes. Pas de
  contrainte d'unicité au niveau base sur `partnerLogin`.
- **Fichiers concernés** : `schema.prisma`, routes d'inscription 2v2.
- **Piste d'implémentation** : index unique partiel, ou table de membres normalisée
  (un membre = une ligne) plutôt que `partnerLogin` dénormalisé.
- **Effort** : M. **Priorité** : moyenne.

---

## 18. Observabilité & intégrité des données

### Pas de métriques / logs structurés sur le cycle de vie d'un tournoi
- **État actuel** : `logAdminAction` trace les actions admin (force-result, remove-entry…).
- **Ce qui manque / problème** : pas d'événements métier (tournoi créé/démarré/terminé, durée
  moyenne, taux d'abandon, nombre de matchs forcés) ; pas de tableau de bord. Difficile de
  mesurer l'usage de la feature.
- **Fichiers concernés** : `index.ts`, observabilité.
- **Piste d'implémentation** : events analytiques + métriques.
- **Effort** : M. **Priorité** : basse.

### Pas de tâche de cohérence (orphelins, brackets bloqués)
- **État actuel** : aucune.
- **Ce qui manque / problème** : pas de job détectant les tournois `in_progress` bloqués
  (match avec slot null, désaccord persistant, inactivité longue), ni les invites pending sur
  tournois terminés, ni les cosmétiques-récompense orphelins.
- **Fichiers concernés** : backend (cron).
- **Piste d'implémentation** : job périodique de santé + alerte admin.
- **Effort** : M. **Priorité** : basse.

### Statut `cancelled` déclaré mais non utilisé (suppression dure à la place)
- **État actuel** : `status` peut valoir `'cancelled'` (`schema.prisma:255`) mais `cancel`
  **supprime** le tournoi (`index.ts:5017`, commentaire « Pas de statut annulé »).
- **Ce qui manque / problème** : incohérence — la valeur `cancelled` n'est jamais posée ;
  l'historique d'un tournoi annulé disparaît totalement (pas de trace pour les participants /
  parieurs remboursés). Dette : enum partiellement implémenté.
- **Fichiers concernés** : `schema.prisma`, `index.ts` (`cancel`).
- **Piste d'implémentation** : soit retirer `cancelled` de l'enum, soit l'utiliser (soft-cancel
  avec conservation, masquage des listes actives).
- **Effort** : S. **Priorité** : basse.

---

## 19. Tests manquants

### Couverture backend du moteur de tournoi
- **État actuel** : `packages/shared` a des tests (`tournament-economy.test.ts`,
  `elo.test.ts`, `schemas.test.ts`), mais `apps/backend/src/tournament.ts`
  (`generateBracket`/`generatePools`/`poolStandings`/`qualifiersFromPools`/`advanceWinner`)
  n'a pas de tests unitaires visibles.
- **Ce qui manque / problème** : pas de tests sur : byes (nombre impair, 3/5/6/7 joueurs),
  propagation de bye au round 2, `seedOrder` (paires correctes), serpent des poules,
  départage `poolStandings`, croisement des qualifiés `qualifiersFromPools`, détection de
  finale `advanceWinner`. Régressions faciles.
- **Fichiers concernés** : nouveau `apps/backend/src/tournament.test.ts`.
- **Piste d'implémentation** : tests purs (extraire la part déterministe ; `generateBracket`
  écrit en base → mocker prisma ou tester `seedOrder`/`nextPow2`/`totalRounds`/`poolStandings`
  qui sont pures).
- **Effort** : M. **Priorité** : haute.

### Tests d'intégration des routes tournoi
- **État actuel** : à confirmer dans les itests, mais peu de couverture probable sur le flux
  complet.
- **Ce qui manque / problème** : pas de scénarios e2e : création → join → start → toss →
  record → confirm (mismatch puis accord) → finale → récompense → paris réglés. Cas 2v2,
  poules→bracket, reshuffle, cancel/refund, force-result, invitations accept/decline,
  permissions (non-participant, privé).
- **Fichiers concernés** : suite d'itests backend.
- **Piste d'implémentation** : scénarios couvrant chaque transition d'état et chaque garde-fou
  (403/409).
- **Effort** : L. **Priorité** : haute.

### Tests front (saisie de score par discipline, bracket)
- **État actuel** : composants `ScoreEntry`/`BracketTree` non testés (présumé).
- **Ce qui manque / problème** : pas de tests de la logique de saisie (babyfoot abaque, sets
  smash 2/3, chess binaire), du rendu des byes, du mode privé.
- **Fichiers concernés** : tests front.
- **Effort** : M. **Priorité** : moyenne.

---

## 20. i18n & accessibilité

### Couverture i18n partielle / clés potentiellement manquantes
- **État actuel** : `apps/web/src/lib/locales/tournois.ts` fournit `fr`/`en`/`es` (690 lignes).
- **Ce qui manque / problème** : à auditer la **parité** des clés entre langues (toute clé fr
  doit exister en en/es) et l'absence de chaînes en dur dans `TournoiDetailPage.tsx`/
  `BracketTree.tsx`/composants (ex. messages d'erreur backend renvoyés tels quels en français :
  « tirage déjà effectué », « tournament is full », « not a participant » — **mélange
  français/anglais** non traduit côté client). Beaucoup de messages d'erreur backend sont en
  anglais (`tournament not found`, `match already confirmed`) et affichés bruts à l'utilisateur.
- **Fichiers concernés** : `index.ts` (messages HTTPException), `tournois.ts` (locale),
  composants tournois.
- **Piste d'implémentation** : codes d'erreur stables côté backend + mapping i18n côté front ;
  audit de parité des dictionnaires (script de diff de clés).
- **Effort** : M. **Priorité** : moyenne.

### Accessibilité du bracket et des animations
- **État actuel** : bracket visuel, overlays animés (VERSUS, coin flip).
- **Ce qui manque / problème** : navigation clavier dans le bracket, rôles ARIA, contraste des
  chips de score, alternative aux animations (`prefers-reduced-motion`), annonce vocale des
  changements d'état (live region) pour le suivi en temps réel.
- **Fichiers concernés** : `BracketTree.tsx`, overlays.
- **Piste d'implémentation** : audit a11y dédié.
- **Effort** : M. **Priorité** : basse.

---

## 21. Divergences desktop / mobile

### Création : deux implémentations (page vs sheet) à maintenir en parallèle
- **État actuel** : `CreateTournamentPage.tsx` (desktop, 18k) et
  `mobile/CreateTournamentSheet.tsx` (mobile).
- **Ce qui manque / problème** : risque de **divergence des règles** (un champ/validation
  ajouté d'un côté et pas de l'autre — ex. seeding, format poules, cash-prize). Duplication de
  la logique de formulaire et des libellés. À auditer la parité des options exposées
  (discipline fléchettes exclue des deux ? cash-prize présent des deux ?).
- **Fichiers concernés** : `apps/web/src/pages/tournois/CreateTournamentPage.tsx`,
  `apps/web/src/pages/tournois/mobile/CreateTournamentSheet.tsx`.
- **Piste d'implémentation** : factoriser un hook/schéma de formulaire partagé piloté par
  `CreateTournamentSchema`, deux rendus seulement.
- **Effort** : M. **Priorité** : moyenne.

### Détail : pas de variante mobile dédiée (cf. §14)
- Voir [§14 « Détail tournoi : page unique sans split desktop/mobile dédié »].

### Liste : parité des actions desktop/mobile
- **État actuel** : `TournoisDesktop.tsx` (27k) vs `TournoisMobile.tsx` (13k).
- **Ce qui manque / problème** : écart de taille important → des actions (reshuffle, announce,
  bets, admin) peuvent être présentes sur desktop et absentes/limitées sur mobile. À auditer.
- **Fichiers concernés** : `TournoisDesktop.tsx`, `TournoisMobile.tsx`.
- **Piste d'implémentation** : matrice de parité des fonctionnalités par plateforme.
- **Effort** : M. **Priorité** : basse.

---

## Annexe — Récapitulatif des incohérences à corriger en priorité

1. **`/reject` ignore les coéquipiers 2v2** (§4) — bug fonctionnel, effort S, **haute**.
2. **Désistement d'un joueur en cours bloque le bracket** (§5) — effort M, **haute**.
3. **Aucun forfait/abandon** (§5) — effort M, **haute**.
4. **Fléchettes créables puis bloquées** (§7) — interdire en amont, effort S, **haute**.
5. **Reshuffle hors transaction** (§11) — atomicité, effort M, **haute**.
6. **Tests du moteur de bracket absents** (§19) — effort M, **haute**.
7. **Pas de rollback d'un match confirmé par erreur** (§4/§16) — effort L, moyenne.
8. **Contradiction capacité poules ≥12 vs puissance de 2** (§1) — effort S, moyenne.
9. **Nulles d'échecs impossibles sans départage** (§8) — effort M, moyenne.
10. **Messages d'erreur backend non traduits (fr/en mélangés)** (§20) — effort M, moyenne.
