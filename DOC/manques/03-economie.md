# Manques — Économie (League Coins)

> Document d'audit des **manques, incomplétudes et améliorations** du domaine
> **Économie League Coins** (monnaie virtuelle) de 42 League. Ce document décrit
> **ce qui manque ou pose problème**, pas l'existant. L'existant de référence se
> trouve dans `DOC/DOMAIN.md` §13 (Économie) et §14 (Paris).
>
> Périmètre couvert : porte-monnaie (`User.leagueCoins`), gains (per-match,
> quêtes hebdo, grants admin, cash-prize de tournoi), sinks (boutique Shop /
> Shop GOD, mises de paris), paris (tournoi, ops, et résidu « match »), quêtes
> hebdomadaires, boutique & inventaire, raretés, équilibrage économique,
> anti-abus / anti-farming, cosmétiques, observabilité, tests, i18n.
>
> Fichiers de référence principaux :
> - `apps/backend/src/index.ts` (lignes ~7119–8313 : boutique, grants, économie,
>   quêtes, paris ; lignes ~4240–4370 : règlement des paris/cash-prize de tournoi)
> - `apps/backend/prisma/schema.prisma` (`ShopItem`, `ShopInventory`,
>   `WeeklyQuestProgress`, `Bet`, `User.leagueCoins`, `Tournament.prize*`)
> - `packages/shared/src/tournament-economy.ts` (cotes progressives, cash-prize)
> - `packages/shared/src/anti-farming.ts` (dégressivité coins/ELO)
> - `packages/shared/src/schemas.ts` (`ShopRaritySchema`, `ShopItemCreateSchema`)
> - `apps/web/src/pages/ShopPage.tsx`, `apps/web/src/pages/profil/BetsPanel.tsx`,
>   `apps/web/src/pages/profil/QuestsPanel.tsx`,
>   `apps/web/src/components/bets/BetPrimitives.tsx`,
>   `apps/web/src/components/tournois/TournamentBets.tsx`,
>   `apps/web/src/components/CoinCount.tsx`

---

## Table des matières

1. [Observabilité & traçabilité](#1-observabilité--traçabilité)
   - 1.1 [Aucun historique / grand livre des transactions de coins](#11-aucun-historique--grand-livre-des-transactions-de-coins)
   - 1.2 [Aucune métrique d'équilibrage (masse monétaire, faucet vs sink)](#12-aucune-métrique-déquilibrage-masse-monétaire-faucet-vs-sink)
   - 1.3 [Grants admin non journalisés dans l'audit](#13-grants-admin-non-journalisés-dans-laudit)
   - 1.4 [Pas de notification utilisateur des gains/pertes](#14-pas-de-notification-utilisateur-des-gainspertes)
2. [Équilibrage économique](#2-équilibrage-économique)
   - 2.1 [Un seul vrai sink : la boutique (puis plus rien)](#21-un-seul-vrai-sink--la-boutique-puis-plus-rien)
   - 2.2 [Cosmétiques achetés une seule fois → inflation garantie](#22-cosmétiques-achetés-une-seule-fois--inflation-garantie)
   - 2.3 [Constantes économiques codées en dur, non configurables](#23-constantes-économiques-codées-en-dur-non-configurables)
   - 2.4 [Quêtes hebdo statiques (4 quêtes, jamais de rotation)](#24-quêtes-hebdo-statiques-4-quêtes-jamais-de-rotation)
   - 2.5 [Pas de plancher / solde de départ / seed economy](#25-pas-de-plancher--solde-de-départ--seed-economy)
3. [Paris (betting)](#3-paris-betting)
   - 3.1 [Cote fixe ×2 sur ops : pas de cote dynamique ni de prise en compte de l'écart de niveau](#31-cote-fixe-2-sur-ops--pas-de-cote-dynamique-ni-de-prise-en-compte-de-lécart-de-niveau)
   - 3.2 [Code mort / incohérent : paris « match » retirés mais `settleMatchBetsTx` toujours appelé](#32-code-mort--incohérent--paris-match-retirés-mais-settlematchbetstx-toujours-appelé)
   - 3.3 [Paris orphelins jamais réglés (ops sans expiration atteinte, tournoi figé)](#33-paris-orphelins-jamais-réglés-ops-sans-expiration-atteinte-tournoi-figé)
   - 3.4 [Règlement paresseux des ops dépend d'une visite de page](#34-règlement-paresseux-des-ops-dépend-dune-visite-de-page)
   - 3.5 [Pas de plafond de mise ni de plafond d'exposition](#35-pas-de-plafond-de-mise-ni-de-plafond-dexposition)
   - 3.6 [Collusion sur les duels d'ops / paris truqués](#36-collusion-sur-les-duels-dops--paris-truqués)
   - 3.7 [Pas d'annulation / cash-out d'un pari ouvert](#37-pas-dannulation--cash-out-dun-pari-ouvert)
   - 3.8 [Pas de tableau « cote affichée » avant de parier](#38-pas-de-tableau-cote-affichée-avant-de-parier)
4. [Quêtes hebdomadaires](#4-quêtes-hebdomadaires)
   - 4.1 [Réclamations perdues au changement de semaine](#41-réclamations-perdues-au-changement-de-semaine)
   - 4.2 [Fuseau ISO (UTC) ≠ fuseau anti-farming (Europe/Paris)](#42-fuseau-iso-utc--fuseau-anti-farming-europeparis)
   - 4.3 [Aucune quête « one-shot » / quotidienne / saisonnière](#43-aucune-quête-one-shot--quotidienne--saisonnière)
   - 4.4 [Quêtes non comptabilisées hors match classé 1v1/2v2](#44-quêtes-non-comptabilisées-hors-match-classé-1v12v2)
5. [Boutique, inventaire & cosmétiques](#5-boutique-inventaire--cosmétiques)
   - 5.1 [Pas de revente / remboursement d'un objet acheté](#51-pas-de-revente--remboursement-dun-objet-acheté)
   - 5.2 [Catégorie `cosmetic` fantôme (schéma vs validation)](#52-catégorie-cosmetic-fantôme-schéma-vs-validation)
   - 5.3 [Rareté purement décorative (aucun effet de gameplay/prix)](#53-rareté-purement-décorative-aucun-effet-de-gameplayprix)
   - 5.4 [Pas d'édition limitée / stock / exclusivité temporelle](#54-pas-dédition-limitée--stock--exclusivité-temporelle)
   - 5.5 [Suppression d'un ShopItem efface l'inventaire payé (cascade destructrice)](#55-suppression-dun-shopitem-efface-linventaire-payé-cascade-destructrice)
   - 5.6 [Désynchronisation `user.title` ↔ inventaire de titres](#56-désynchronisation-usertitle--inventaire-de-titres)
   - 5.7 [Aucune prévisualisation cohérente bannière/badge avant achat](#57-aucune-prévisualisation-cohérente-bannièrebadge-avant-achat)
6. [Anti-abus / anti-farming des coins](#6-anti-abus--anti-farming-des-coins)
   - 6.1 [Farming inter-comptes (smurfs) non détecté](#61-farming-inter-comptes-smurfs-non-détecté)
   - 6.2 [Dégressivité par paire/jour contournable par rotation d'adversaires](#62-dégressivité-par-pairejour-contournable-par-rotation-dadversaires)
   - 6.3 [`INFINITE_COIN_LOGINS` n'est qu'un affichage front, non appliqué serveur](#63-infinite_coin_logins-nest-quun-affichage-front-non-appliqué-serveur)
   - 6.4 [Pas de rate-limit dédié sur achats/paris/claims](#64-pas-de-rate-limit-dédié-sur-achatsparisclaims)
   - 6.5 [Pas de détection d'anomalies de solde / d'enrichissement soudain](#65-pas-de-détection-danomalies-de-solde--denrichissement-soudain)
7. [Intégrité & edge cases de règlement](#7-intégrité--edge-cases-de-règlement)
   - 7.1 [Reset de saison : sort des coins/paris non spécifié](#71-reset-de-saison--sort-des-coinsparis-non-spécifié)
   - 7.2 [Anonymisation RGPD : paris ouverts non remboursés ?](#72-anonymisation-rgpd--paris-ouverts-non-remboursés-)
   - 7.3 [`grantCoinsTx` borne à 0 silencieusement (dette masquée)](#73-grantcoinstx-borne-à-0-silencieusement-dette-masquée)
   - 7.4 [Pas d'idempotence sur le règlement (double-credit possible si re-confirmation)](#74-pas-didempotence-sur-le-règlement-double-credit-possible-si-re-confirmation)
8. [Fonctionnalités annoncées mais non livrées](#8-fonctionnalités-annoncées-mais-non-livrées)
   - 8.1 [Classement de richesse (leaderboard de coins) absent](#81-classement-de-richesse-leaderboard-de-coins-absent)
   - 8.2 [Cadeaux / transferts de coins entre joueurs](#82-cadeaux--transferts-de-coins-entre-joueurs)
   - 8.3 [Malus d'inactivité hebdo (pending)](#83-malus-dinactivité-hebdo-pending)
9. [Tests & qualité](#9-tests--qualité)
   - 9.1 [Aucun test backend de l'économie (coins/paris/quêtes/boutique)](#91-aucun-test-backend-de-léconomie-coinsparisquêtesboutique)
   - 9.2 [Tests partagés limités à la logique pure](#92-tests-partagés-limités-à-la-logique-pure)
10. [Internationalisation (i18n)](#10-internationalisation-i18n)
    - 10.1 [Messages d'erreur API en français en dur](#101-messages-derreur-api-en-français-en-dur)
    - 10.2 [Valeurs chiffrées du guide « gagner des coins » figées en dur](#102-valeurs-chiffrées-du-guide-gagner-des-coins-figées-en-dur)

---

## 1. Observabilité & traçabilité

### 1.1 Aucun historique / grand livre des transactions de coins
- **État actuel** : `User.leagueCoins` (`schema.prisma:49`) est un **simple compteur scalaire**. Toutes les mutations passent par `grantCoinsTx` (`index.ts:7448`) qui fait un `update` du solde **sans écrire de ligne de journal**. Seuls les paris (`Bet`) laissent une trace, et uniquement pour leur propre cycle de vie.
- **Ce qui manque / problème** : impossible de répondre à « pourquoi mon solde a changé ? », de reconstruire un solde, de détecter un bug de double-crédit, d'auditer un litige (« j'ai été débité deux fois »), ni de faire de l'analytics (combien de coins gagnés via quêtes vs match vs paris). Un compteur scalaire est **non auditable** et non réconciliable. Pour une monnaie, c'est le manque structurel n°1.
- **Fichiers concernés** : `index.ts` (`grantCoinsTx`, `awardMatchEconomyTx`, `settleBetsTx`, `payCashPrizeTx`, `/shop/:id/buy`, `/admin/shop/grant`), `schema.prisma`.
- **Piste d'implémentation** : ajouter une table `CoinTransaction { id, login, amount (signé), reason (enum: match_played|match_won|quest_claim|bet_stake|bet_payout|bet_refund|tournament_prize|cash_prize|shop_purchase|admin_grant), refType, refId, balanceAfter, createdAt }`. Écrire une ligne **dans la même transaction** que chaque `grantCoinsTx` (passer un `reason` + `ref` en paramètre). Le solde devient une projection vérifiable (`SUM(amount)`).
- **Effort** M · **Priorité** Haute

### 1.2 Aucune métrique d'équilibrage (masse monétaire, faucet vs sink)
- **État actuel** : aucune agrégation. On ne mesure ni la masse totale de coins en circulation, ni le débit des sources (faucets) vs des puits (sinks).
- **Ce qui manque / problème** : impossible de piloter l'équilibrage. On ne sait pas si l'économie inflationne (les gains de match `+20/+50` + quêtes `850/sem` entrent en permanence, mais le seul sink — la boutique — est à achat unique). Sans observabilité, tout réglage de constante est à l'aveugle.
- **Fichiers concernés** : à créer (dashboard GOD / endpoint `/admin/economy/stats`). S'appuie sur 1.1.
- **Piste d'implémentation** : endpoint admin agrégeant `CoinTransaction` par `reason` et par fenêtre (jour/semaine), + total `SUM(leagueCoins)`, + Gini/percentiles de richesse. Affichage dans le tableau de bord GOD.
- **Effort** M · **Priorité** Moyenne

### 1.3 Grants admin non journalisés dans l'audit
- **État actuel** : `POST /admin/shop/grant` (`index.ts:8165`) et `POST /admin/shop/grant-item` (`index.ts:8187`) modifient le solde / l'inventaire **sans appeler `logAdminAction`**, contrairement à d'autres actions admin (cf. `SET_MODERATOR_PERMISSIONS`, `index.ts:7360`).
- **Ce qui manque / problème** : un admin peut créditer des coins ou offrir des cosmétiques **sans laisser de trace dans `AdminAuditLog`**. Or c'est *la* voie de création monétaire la plus puissante (montants arbitraires). Trou d'auditabilité et de responsabilité (qui a donné quoi à qui).
- **Fichiers concernés** : `index.ts` (`/admin/shop/grant`, `/admin/shop/grant-item`, `/admin/shop/items*` create/patch/delete).
- **Piste d'implémentation** : ajouter `logAdminAction(c, { action: 'GRANT_COINS' | 'GRANT_ITEM' | 'SHOP_ITEM_*', target, payload })` dans chacun de ces endpoints. Idem pour la création/édition/suppression d'objets de boutique.
- **Effort** S · **Priorité** Haute

### 1.4 Pas de notification utilisateur des gains/pertes
- **État actuel** : après un gain (match, quête, pari gagné, remboursement), le backend émet seulement `{ type: 'panel:update' }` (ex. `index.ts:7908`, `7834`) — un signal de rafraîchissement générique, **sans montant ni motif**.
- **Ce qui manque / problème** : le joueur voit son solde changer mais sans feedback (« +50 victoire », « pari gagné +200 », « mise remboursée »). Mauvaise lisibilité de l'économie, et impossible de comprendre un règlement d'ops asynchrone survenu pendant l'absence.
- **Fichiers concernés** : `index.ts` (tous les `emit([...], { type: 'panel:update' })` liés aux coins), front (toasts / centre de notifications).
- **Piste d'implémentation** : enrichir l'événement SSE (`{ type: 'coins:delta', payload: { amount, reason, refId } }`) et afficher un toast côté web. Synergie directe avec 1.1.
- **Effort** M · **Priorité** Moyenne

---

## 2. Équilibrage économique

### 2.1 Un seul vrai sink : la boutique (puis plus rien)
- **État actuel** : sinks existants = achat boutique (`/shop/:id/buy`, `index.ts:7172`) et mise de pari (`index.ts:8069`/`8139`). Mais la mise de pari **n'est pas un vrai sink** : elle est soit remboursée, soit redistribuée ×2 (jeu à somme nulle voire positive pour le gagnant, donc **création nette de coins** côté parieurs chanceux).
- **Ce qui manque / problème** : sources permanentes (match `+20/+50`, quêtes `850/sem`, cash-prize, grants) vs **un seul** puits à achat unique. Une fois la boutique « complétée » par un joueur, il n'a plus rien à dépenser → accumulation infinie, coins sans valeur. C'est le cœur du déséquilibre.
- **Fichiers concernés** : `index.ts` (volets A/B/C), `ShopPage.tsx`.
- **Piste d'implémentation** : introduire des sinks récurrents — coûts d'inscription à des tournois premium, **loot-boxes / tirages cosmétiques** consommables, re-roll de quête, achat de bannières temporaires, frais de changement de titre, enchères. Plusieurs déjà esquissés par les cartes « Bientôt » de `ShopPage.tsx:43` (`MIN_TILES`, placeholders « soon »).
- **Effort** L · **Priorité** Haute

### 2.2 Cosmétiques achetés une seule fois → inflation garantie
- **État actuel** : `POST /shop/:id/buy` refuse l'achat si déjà possédé (`index.ts:7187`, `'objet déjà possédé'`). Donc chaque objet est un sink **non répétable**.
- **Ce qui manque / problème** : le catalogue est fini, l'offre de coins est infinie → divergence. Aucun consommable, aucun objet ré-achetable.
- **Fichiers concernés** : `index.ts:7172` (`/shop/:id/buy`), `schema.prisma` (`ShopItem`, `ShopInventory`).
- **Piste d'implémentation** : type d'objet `consumable` (quantité, ré-achetable, effet à usage unique) ; quantité dans `ShopInventory`. Voir aussi 2.1.
- **Effort** M · **Priorité** Moyenne

### 2.3 Constantes économiques codées en dur, non configurables
- **État actuel** : `COINS_PER_MATCH_PLAYED = 20`, `COINS_PER_MATCH_WON = 50` (`index.ts:7530-7532`), `BET_PAYOUT_MULTIPLIER = 2` (`index.ts:7534`), récompenses de quêtes `200/300/150/200` (`WEEKLY_QUESTS`, `index.ts:7565`), `FARMING_DECAY_BASE = 0.75` (`anti-farming.ts:30`), `DEFAULT_BET_FINAL_MULT = 2` (`tournament-economy.ts:15`).
- **Ce qui manque / problème** : tout ajustement d'équilibrage nécessite un **redéploiement**. Aucune table de configuration ni override admin. Impossible de réagir vite à une inflation observée (et de toute façon non observée, cf. §1).
- **Fichiers concernés** : `index.ts`, `anti-farming.ts`, `tournament-economy.ts`.
- **Piste d'implémentation** : table `EconomyConfig` (clé/valeur) chargée au boot + cache + endpoint admin de mise à jour (journalisé). Garder les constantes actuelles comme valeurs par défaut.
- **Effort** M · **Priorité** Moyenne

### 2.4 Quêtes hebdo statiques (4 quêtes, jamais de rotation)
- **État actuel** : `WEEKLY_QUESTS` est un tableau **constant** de 4 entrées (`index.ts:7565`). Mêmes quêtes chaque semaine, mêmes récompenses.
- **Ce qui manque / problème** : pas de variété, pas de rotation, pas de quêtes ciblées par discipline ou par événement. Le plafond hebdo (`200+300+150+200 = 850`) est atteint par les joueurs assidus sans effort de découverte au-delà de quelques semaines. Lassitude + revenu garanti = pression inflationniste.
- **Fichiers concernés** : `index.ts:7565` (`WEEKLY_QUESTS`), `QuestsPanel.tsx`.
- **Piste d'implémentation** : pool de définitions + sélection déterministe par `weekKey` (seed = hash(weekKey)), ou table `QuestDefinition` administrable. Ajouter quêtes par jeu, quêtes « gagne contre un mieux classé », etc.
- **Effort** M · **Priorité** Moyenne

### 2.5 Pas de plancher / solde de départ / seed economy
- **État actuel** : `leagueCoins` démarre à `0` (`schema.prisma:49`, `@default(0)`).
- **Ce qui manque / problème** : un nouveau joueur a 0 coin et ne peut **ni parier ni acheter** avant d'avoir joué plusieurs matchs classés. Onboarding économique pauvre. Pas de bonus de bienvenue, pas de « premier achat offert ».
- **Fichiers concernés** : `schema.prisma:49`, `getOrCreateUser` (création d'utilisateur dans `index.ts`).
- **Piste d'implémentation** : crédit de bienvenue (ex. 100 coins) à la première création, journalisé (cf. 1.1) ; ou quête d'onboarding one-shot (cf. 4.3).
- **Effort** S · **Priorité** Basse

---

## 3. Paris (betting)

### 3.1 Cote fixe ×2 sur ops : pas de cote dynamique ni de prise en compte de l'écart de niveau
- **État actuel** : pari sur duel d'ops réglé à cote **fixe ×2** (`BET_PAYOUT_MULTIPLIER = 2`, utilisé par `settleBetsTx`, `index.ts:7656`). Les paris sur tournoi utilisent une cote **progressive** par tours franchis (`betMultiplier`, `tournament-economy.ts:26`), mais bornée par `finalMult` (×2 par défaut).
- **Ce qui manque / problème** : parier sur le grand favori ou sur l'outsider rapporte **pareil** (×2). Aucune incitation à parier sur l'improbable, aucune pénalité à parier sur la certitude → EV ≈ neutre et ennuyeux. Pas de cote fonction de l'ELO des duellistes, ni de la répartition des mises (pari mutuel).
- **Fichiers concernés** : `index.ts` (`settleBetsTx`, `settleOpsDuelBetsTx`), `tournament-economy.ts`.
- **Piste d'implémentation** : (a) cote ELO-based (`p = 1/(1+10^((Rb-Ra)/400))`, payout = `stake/p`) ; (b) ou **pari mutuel** (pool partagé entre gagnants au prorata des mises, la maison ne crée pas de coins → devient un vrai sink/transfert). Le pari mutuel résout aussi 2.1 (somme nulle entre parieurs).
- **Effort** L · **Priorité** Moyenne

### 3.2 Code mort / incohérent : paris « match » retirés mais `settleMatchBetsTx` toujours appelé
- **État actuel** : la doc et `PlaceBetSchema` indiquent que les paris match par match ont été **retirés** (`index.ts:8014-8015`, `targetType: z.literal('tournament')`). Or `settleMatchBetsTx(tx, id, winnerLogin)` est **toujours appelé** au règlement de chaque match de bracket (`index.ts:4254`), et `targetType: 'match'` reste dans le schéma Prisma (`Bet.targetType`, commentaire `schema.prisma:734`) + index `[matchId, status]`.
- **Ce qui manque / problème** : code de règlement de paris « match » conservé alors qu'aucun endpoint ne peut **plus créer** ce type de pari → branche morte (toujours 0 résultat) qui induit en erreur et alourdit le règlement. Risque de réactivation accidentelle / confusion lors d'une maintenance.
- **Fichiers concernés** : `index.ts:4254` (`settleMatchBetsTx`), `index.ts:7669-7672` (def), `schema.prisma:734-751`.
- **Piste d'implémentation** : soit **réactiver** proprement les paris sur match (endpoint + UI), soit **supprimer** `settleMatchBetsTx`, l'appel l.4254, le champ `matchId`/index, et figer `targetType ∈ {tournament, ops}`. Documenter la décision.
- **Effort** S · **Priorité** Moyenne

### 3.3 Paris orphelins jamais réglés (ops sans expiration atteinte, tournoi figé)
- **État actuel** : un pari de tournoi se règle quand le pronostic est éliminé ou sacré (`settleTournamentBetsForPick`, `index.ts:4289/4321/4365`). Un pari d'ops se règle à l'expiration (`sweepExpiredOpsBets`, `index.ts:7823`).
- **Ce qui manque / problème** : si un **tournoi reste bloqué `in_progress`** indéfiniment (jamais terminé, jamais supprimé), les paris restent `open` à vie → mise gelée. Pas de timeout/expiration des paris de tournoi (contrairement aux ops qui ont `expiresAt`). Aucune routine ne balaie les tournois zombies pour rembourser.
- **Fichiers concernés** : `index.ts` (règlement tournoi, pas de sweep), `schema.prisma` (`Bet`, `Tournament`).
- **Piste d'implémentation** : routine quotidienne (à côté de `runDailyPurges`, `index.ts:8288`) qui rembourse les paris de tournois `in_progress` trop anciens ou abandonnés ; ou TTL de pari avec remboursement automatique.
- **Effort** M · **Priorité** Moyenne

### 3.4 Règlement paresseux des ops dépend d'une visite de page
- **État actuel** : `sweepExpiredOpsBets` est déclenché au démarrage (`index.ts:8285`), à l'expiration d'un ops (timer `rescheduleOpsTimers`) **et à chaque GET `/bets`** (`index.ts:7918`). Pas dans `runDailyPurges`.
- **Ce qui manque / problème** : si plus personne n'ouvre la page Paris **et** que le timer a sauté (crash entre expiration et reschedule, ou edge de planification), un pari d'ops expiré peut rester `open` jusqu'au prochain GET `/bets` ou reboot. Le règlement n'est pas garanti par une routine périodique fiable.
- **Fichiers concernés** : `index.ts:7918`, `index.ts:8285`, `runDailyPurges` (`index.ts:8288`).
- **Piste d'implémentation** : ajouter `sweepExpiredOpsBets()` dans `runDailyPurges` (et/ou un `setInterval` court dédié) pour ne pas dépendre du trafic utilisateur.
- **Effort** S · **Priorité** Moyenne

### 3.5 Pas de plafond de mise ni de plafond d'exposition
- **État actuel** : `stake: z.number().int().positive()` (`PlaceBetSchema` `index.ts:8020`, `PlaceOpsBetSchema` `index.ts:8093`). Seule contrainte : `stake <= solde` (`index.ts:8068`/`8138`).
- **Ce qui manque / problème** : aucun **plafond maximal** de mise. Un joueur très riche peut miser tout son solde d'un coup ; combiné à la cote ×2, un parieur peut doubler son patrimoine en un pari (variance énorme, pression inflationniste). Pas de limite par marché ni d'exposition totale.
- **Fichiers concernés** : `index.ts` (schémas de pari, validation).
- **Piste d'implémentation** : plafond configurable (`MAX_BET_STAKE`, cf. 2.3) ; éventuellement plafond relatif au solde ou au prize-pool du marché.
- **Effort** S · **Priorité** Moyenne

### 3.6 Collusion sur les duels d'ops / paris truqués
- **État actuel** : les protagonistes d'un duel d'ops **ne peuvent pas parier** sur leur duel (`index.ts:8110`) ni sur un tournoi où ils jouent (`index.ts:8051`). Bon garde-fou de base.
- **Ce qui manque / problème** : rien n'empêche un **complice** (compte tiers) de parier gros sur un duel dont l'issue est arrangée entre les deux duellistes (qui se partagent ensuite le butin). Le vainqueur du duel = qui gagne le plus de matchs (`opsDuelWinner`, `index.ts:7770`) ; deux amis peuvent fabriquer ce résultat. Aucune détection de schémas de paris suspects (toujours gagnant, même bénéficiaire).
- **Fichiers concernés** : `index.ts` (`/bets/ops`, `opsDuelWinner`, `settleOpsDuelBetsTx`).
- **Piste d'implémentation** : détection statistique (taux de réussite anormal d'un parieur sur les duels d'un même couple), plafonds de mise sur ops, journalisation (1.1) pour enquête a posteriori. À traiter avec 6.5.
- **Effort** M · **Priorité** Basse

### 3.7 Pas d'annulation / cash-out d'un pari ouvert
- **État actuel** : « le pari est verrouillé dès qu'il est posé (aucune modif) » (`index.ts:7933`). Un seul pari ouvert par marché.
- **Ce qui manque / problème** : impossible d'annuler un pari posé par erreur (mauvais pronostic, mauvais montant) tant que le marché est encore **ouvert** (aucun match joué). Pourtant, tant que rien n'a commencé, une annulation avec remboursement serait sans risque d'abus. Frustration utilisateur.
- **Fichiers concernés** : `index.ts` (pas d'endpoint `DELETE /bets/:id`), `BetsPanel.tsx`.
- **Piste d'implémentation** : `DELETE /bets/:id` autorisé uniquement si `status='open'` ET marché encore ouvert (même garde « aucun match joué » que la pose) → rembourse la mise, passe à `refunded`/`cancelled`.
- **Effort** S · **Priorité** Basse

### 3.8 Pas de tableau « cote affichée » avant de parier
- **État actuel** : le front (`TournamentBets.tsx`, `BetPrimitives.tsx`) affiche les marchés mais la cote effective d'un tournoi est **progressive** et dépend du tour atteint (`betMultiplier`), connue seulement au règlement.
- **Ce qui manque / problème** : le parieur ne voit pas clairement le **gain potentiel** par scénario (ex. « si ton pronostic est champion : ×2 ; finaliste : ×1.5 ; … »). Manque de transparence sur la cote progressive (alors que la logique pure existe déjà côté shared et pourrait être affichée).
- **Fichiers concernés** : `tournament-economy.ts` (`betMultiplier` déjà partagé), `TournamentBets.tsx`, `BetPrimitives.tsx`.
- **Piste d'implémentation** : afficher le barème (tableau tours → multiplicateur → gain) au moment de poser le pari, en réutilisant `betMultiplier`/`betPayout`.
- **Effort** S · **Priorité** Basse

---

## 4. Quêtes hebdomadaires

### 4.1 Réclamations perdues au changement de semaine
- **État actuel** : la `weekKey` ISO partitionne `WeeklyQuestProgress` ; changer de semaine crée une nouvelle ligne, donc reset des compteurs **et** des `claimed` (`schema.prisma:706`, commentaire `index.ts:7538`). `claimable: !isClaimed && progress >= target` (`index.ts:7871`).
- **Ce qui manque / problème** : une quête **terminée mais non réclamée** avant la bascule de semaine est **perdue** (la progression repart à 0, plus aucun moyen de récupérer la récompense). Aucun rappel, aucune grâce, aucune notification « tu as 850 coins à réclamer avant dimanche minuit ». Frustration et perte sèche pour le joueur.
- **Fichiers concernés** : `index.ts` (`/quests`, `/quests/:id/claim`, `isoWeekKey`), `QuestsPanel.tsx`.
- **Piste d'implémentation** : auto-claim à la fin de semaine (job qui crédite les quêtes complétées non réclamées), **ou** notification de rappel, **ou** fenêtre de grâce. Synergie avec 1.4 (notifications).
- **Effort** M · **Priorité** Moyenne

### 4.2 Fuseau ISO (UTC) ≠ fuseau anti-farming (Europe/Paris)
- **État actuel** : `isoWeekKey` calcule la semaine en **UTC** (`index.ts:7541-7551`), alors que la dégressivité anti-farming utilise `Europe/Paris` (`FARMING_TZ`, `anti-farming.ts:33`).
- **Ce qui manque / problème** : incohérence de fuseau. La semaine de quêtes bascule à **minuit UTC** (= 01h/02h à Paris), pas à minuit local. Un match joué « lundi 00h30 Paris » peut compter pour la semaine ISO précédente. Edge confus, surtout autour du dimanche soir / lundi matin.
- **Fichiers concernés** : `index.ts:7541` (`isoWeekKey`), `anti-farming.ts:33`.
- **Piste d'implémentation** : aligner `isoWeekKey` sur `FARMING_TZ` (calculer la semaine ISO dans le fuseau de la league), ou documenter explicitement le choix UTC. Cohérence à viser entre tous les resets temporels.
- **Effort** S · **Priorité** Basse

### 4.3 Aucune quête « one-shot » / quotidienne / saisonnière
- **État actuel** : seules des quêtes **hebdomadaires** récurrentes existent (`WEEKLY_QUESTS`).
- **Ce qui manque / problème** : pas de quêtes d'onboarding (« joue ton 1er match », « équipe ton 1er titre »), pas de quêtes quotidiennes (rétention courte), pas de quêtes saisonnières/événementielles. Le système de progression est mono-cadence.
- **Fichiers concernés** : `index.ts` (`WEEKLY_QUESTS`, modèle de progression), `schema.prisma` (`WeeklyQuestProgress` figé sur la semaine).
- **Piste d'implémentation** : généraliser en `QuestProgress` avec un `period` (`daily|weekly|once|season`) et une clé de période adaptée ; définitions par période.
- **Effort** L · **Priorité** Basse

### 4.4 Quêtes non comptabilisées hors match classé 1v1/2v2
- **État actuel** : la progression de quête n'est mise à jour que par `awardMatchEconomyTx` sur un match **classé** (`index.ts:7591`), avec `countForQuests=false` sur les rematchs dégressés (`index.ts:7610`).
- **Ce qui manque / problème** : aucune quête liée aux **paris**, à la **participation à un tournoi**, aux **duels d'ops**, ou aux **matchs amicaux/non classés**. Le seul levier de progression est le match classé, ce qui appauvrit la diversité d'objectifs et ignore des pans entiers du jeu (tournois, paris) pourtant centraux pour l'économie.
- **Fichiers concernés** : `index.ts` (`awardMatchEconomyTx`, `QuestMetric`), endpoints tournoi/paris.
- **Piste d'implémentation** : nouvelles métriques de quête (`betsWon`, `tournamentsJoined`, `opsResolved`) alimentées aux endroits idoines, dans les transactions correspondantes.
- **Effort** M · **Priorité** Basse

---

## 5. Boutique, inventaire & cosmétiques

### 5.1 Pas de revente / remboursement d'un objet acheté
- **État actuel** : `POST /shop/:id/buy` débite et insère dans `ShopInventory` (`index.ts:7191-7196`). Aucun endpoint de revente.
- **Ce qui manque / problème** : un achat est définitif. Aucun « vendre pour 50 % » ni remboursement en cas d'achat erroné. Combiné à l'achat unique (2.2), cela fige la liquidité.
- **Fichiers concernés** : `index.ts` (`/shop/:id/buy`, pas de `/sell`).
- **Piste d'implémentation** : `POST /shop/:id/sell` rendant une fraction (sink partiel), avec retrait de l'inventaire et déséquipement ; journalisé (1.1).
- **Effort** S · **Priorité** Basse

### 5.2 Catégorie `cosmetic` fantôme (schéma vs validation)
- **État actuel** : le schéma Prisma documente `category: 'title' | 'banner' | 'badge' | 'cosmetic'` (`schema.prisma:645`) et un commentaire d'endpoint parle de « titre/badge/bannière/cosmétique » (`index.ts:8180`). Mais `ShopItemUpdateSchema` (`index.ts:7294`) et `ShopRaritySchema`/`ShopItemCreateSchema` (`schemas.ts`) n'autorisent que `['title', 'banner', 'badge']`.
- **Ce qui manque / problème** : la catégorie `cosmetic` est **référencée mais non créable/validable** → incohérence schéma↔validation, code/commentaires trompeurs. Soit elle existe, soit elle ne devrait pas apparaître.
- **Fichiers concernés** : `schema.prisma:645`, `index.ts:7294` (`ShopItemUpdateSchema`), `schemas.ts` (`ShopItemCreateSchema`), `index.ts:8180` (commentaire).
- **Piste d'implémentation** : trancher — soit ajouter `cosmetic` à l'enum de validation + rendu front, soit retirer la mention du schéma et des commentaires. Aligner les trois sources.
- **Effort** S · **Priorité** Basse

### 5.3 Rareté purement décorative (aucun effet de gameplay/prix)
- **État actuel** : `rarity ∈ {common, rare, epic, legendary}` (`schemas.ts:152`, `schema.prisma:651`) **pilote uniquement la couleur de la carte** en vitrine (commentaire `schema.prisma:649`, `ShopPage.tsx:50`). Par défaut, « rareté déduite du prix » pour les objets antérieurs.
- **Ce qui manque / problème** : la rareté n'a **aucune conséquence** mécanique (pas de prix imposé par palier, pas de drop-rate si loot-box, pas de prestige, pas de filtre dédié, pas d'effet visuel sur le profil). C'est un libellé cosmétique du cosmétique. Découplage total rareté↔prix (un objet `legendary` peut coûter 10).
- **Fichiers concernés** : `schemas.ts`, `index.ts` (création/édition), `ShopPage.tsx`, `lib/rarity`.
- **Piste d'implémentation** : lier rareté ↔ fourchette de prix (validation), ↔ effets visuels profil (halo, animation), ↔ drop-rate si introduction de loot-boxes (2.1). Au minimum : avertir si prix incohérent avec rareté.
- **Effort** M · **Priorité** Basse

### 5.4 Pas d'édition limitée / stock / exclusivité temporelle
- **État actuel** : un `ShopItem` est `active`/inactif, `sortOrder`, sans notion de stock ni de fenêtre de disponibilité (`schema.prisma:641`).
- **Ce qui manque / problème** : impossible de faire des objets en édition limitée (« 10 exemplaires »), saisonniers (« dispo cette semaine seulement »), ou exclusifs (récompense d'événement). Or l'exclusivité est le moteur de désirabilité d'une boutique cosmétique et un sink puissant.
- **Fichiers concernés** : `schema.prisma` (`ShopItem`), `index.ts` (catalogue, achat).
- **Piste d'implémentation** : champs `stock?`, `availableFrom?`/`availableUntil?` ; décrément atomique du stock à l'achat (dans la transaction).
- **Effort** M · **Priorité** Basse

### 5.5 Suppression d'un ShopItem efface l'inventaire payé (cascade destructrice)
- **État actuel** : `ShopInventory.item` a `onDelete: Cascade` (`schema.prisma:674`) ; `DELETE /admin/shop/items/:id` (`index.ts:7434`) supprime l'objet **et donc tous les inventaires** qui le possèdent (commentaire « cascade sur l'inventaire »).
- **Ce qui manque / problème** : si un admin supprime un objet de boutique, **les joueurs qui l'ont acheté avec leurs coins perdent l'objet sans remboursement**. Aucune protection (refus de suppression si possédé, archivage `active:false` au lieu de delete, ou remboursement). À comparer à `cleanupOrphanPrizeTx` (`index.ts:7502`) qui, lui, **refuse** de supprimer un objet possédé — incohérence de politique entre les deux chemins.
- **Fichiers concernés** : `index.ts:7434` (`DELETE /admin/shop/items/:id`), `schema.prisma:674`.
- **Piste d'implémentation** : interdire la suppression si `ShopInventory` non vide (renvoyer 409, suggérer `active:false`), ou rembourser le prix d'achat à chaque possesseur (nécessite l'historique 1.1 pour connaître le prix réellement payé).
- **Effort** S · **Priorité** Moyenne

### 5.6 Désynchronisation `user.title` ↔ inventaire de titres
- **État actuel** : équiper un titre copie `payload.title` dans `user.title` (`index.ts:7266`), déséquiper le remet à `null` **seulement si** `user.title === titleStr` (`index.ts:7275`). `grantItemTx` fait pareil à l'auto-équipement (`index.ts:7490`).
- **Ce qui manque / problème** : `user.title` est une **donnée dénormalisée** dérivée de l'inventaire équipé, avec une logique de réconciliation fragile. Cas limites : un admin change le `payload.title` d'un objet déjà équipé → `user.title` reste l'ancienne valeur ; suppression de l'objet équipé (5.5) → `user.title` peut rester orphelin ; titres gagnés par tournoi vs achetés peuvent diverger. Pas de source unique de vérité.
- **Fichiers concernés** : `index.ts` (`/me/inventory/:id/equip`, `grantItemTx`, édition/suppression d'objet).
- **Piste d'implémentation** : dériver `user.title` à la lecture depuis l'objet `title` équipé (vue/calcul) plutôt que le stocker, ou re-synchroniser systématiquement à chaque mutation d'objet `title`.
- **Effort** M · **Priorité** Basse

### 5.7 Aucune prévisualisation cohérente bannière/badge avant achat
- **État actuel** : la boutique liste les objets (`GET /shop`, `index.ts:7152`) avec leur `payload` brut transmis tel quel (`serializeShopItem`, `index.ts:7125`).
- **Ce qui manque / problème** : avant d'acheter (et de dépenser des coins non remboursables, cf. 5.1), le joueur ne voit pas toujours le rendu réel sur **son** profil (bannière en fond, badge à côté du pseudo, titre sous le nom). Risque de regret d'achat → friction sur le seul sink existant.
- **Fichiers concernés** : `ShopPage.tsx`, composants de rendu profil.
- **Piste d'implémentation** : mode « aperçu sur mon profil » avant achat (modale de prévisualisation contextualisée).
- **Effort** M · **Priorité** Basse

---

## 6. Anti-abus / anti-farming des coins

### 6.1 Farming inter-comptes (smurfs) non détecté
- **État actuel** : la dégressivité anti-farming agit **par paire et par jour** (`sameDayPriorCount`, `anti-farming.ts:45`) et plafonne le gain d'un rematch identique. Le gain de coins suit ce facteur (`coinFactor`, `index.ts:7601`).
- **Ce qui manque / problème** : deux **comptes complices** peuvent alterner victoires/défaites pour farmer des coins (le perdant gagne `+20`, le gagnant `+50`, soit `+70` par match sur la paire ; même dégressé, c'est positif). Aucune détection de comptes liés (même IP, même appareil, ratio de matchs entre eux anormal). La dégressivité ralentit mais n'arrête pas, et ne s'applique pas au-delà de la journée.
- **Fichiers concernés** : `anti-farming.ts`, `index.ts` (`awardMatchEconomyTx`, déclaration de match).
- **Piste d'implémentation** : détection de collusion (graphe de matchs, concentration anormale entre deux comptes), plafond hebdomadaire de coins gagnés par match, corrélation IP/appareil, revue manuelle via l'historique (1.1).
- **Effort** L · **Priorité** Moyenne

### 6.2 Dégressivité par paire/jour contournable par rotation d'adversaires
- **État actuel** : le facteur ne dépend que des matchs **contre le même adversaire le même jour** (`anti-farming.ts:45`).
- **Ce qui manque / problème** : un joueur qui tourne entre plusieurs adversaires (ou un petit groupe qui se farme en cercle) garde le **plein tarif** sur chaque nouvelle paire. Aucun plafond global de gains/jour ou /semaine par joueur, donc le farming « en rotation » reste rentable.
- **Fichiers concernés** : `anti-farming.ts`, `index.ts` (`awardMatchEconomyTx`).
- **Piste d'implémentation** : plafond quotidien/hebdomadaire de coins gagnés par match (indépendant de la paire), en plus de la dégressivité par paire. Configurable (2.3).
- **Effort** M · **Priorité** Moyenne

### 6.3 `INFINITE_COIN_LOGINS` n'est qu'un affichage front, non appliqué serveur
- **État actuel** : `INFINITE_COIN_LOGINS = {abidaux, throbert}` est défini **uniquement côté web** (`apps/web/src/components/CoinCount.tsx:4`) pour afficher un glyphe « ∞ ». Le backend traite ces comptes comme tous les autres (solde réel décrémenté aux achats/paris).
- **Ce qui manque / problème** : incohérence entre l'affichage (« solde infini ») et la réalité serveur (solde fini, peut tomber à 0 et bloquer un achat/pari). Si l'intention est un vrai « solde illimité » fondateur, elle n'est **pas implémentée côté serveur** ; si l'intention est purement décorative, c'est trompeur. La constante est aussi **dupliquée** logiquement avec la notion `INFINITE_COIN_LOGINS` mentionnée dans `DOMAIN.md:374` sans implémentation backend correspondante.
- **Fichiers concernés** : `apps/web/src/components/CoinCount.tsx`, `index.ts` (débits `/shop/:id/buy`, `/bets`, `/bets/ops`), `DOMAIN.md:374`.
- **Piste d'implémentation** : décider de la sémantique. Si « illimité » : court-circuiter les débits/vérifs de solde côté serveur pour ces logins (et ne pas journaliser de dette). Sinon : retirer l'affichage trompeur. Centraliser la liste (partagée), pas en dur dans un composant front.
- **Effort** S · **Priorité** Moyenne

### 6.4 Pas de rate-limit dédié sur achats/paris/claims
- **État actuel** : un rate-limit global existe (`rate-limit.test.ts`), mais aucun seuil **spécifique** aux endpoints économiques (`/shop/:id/buy`, `/bets`, `/bets/ops`, `/quests/:id/claim`).
- **Ce qui manque / problème** : les transactions concurrentes sont protégées par les transactions DB et les gardes anti-doublon, mais rien ne limite le **débit de requêtes** sur ces routes sensibles (sondage de race conditions, spam d'essais d'achat/pari). Pas de défense en profondeur côté débit.
- **Fichiers concernés** : `index.ts` (middleware de rate-limit), endpoints économiques.
- **Piste d'implémentation** : buckets de rate-limit plus stricts sur les routes mutant le solde.
- **Effort** S · **Priorité** Basse

### 6.5 Pas de détection d'anomalies de solde / d'enrichissement soudain
- **État actuel** : aucun monitoring. Le solde peut bondir (pari ×2 sur grosse mise, grant admin, collusion) sans alerte.
- **Ce qui manque / problème** : aucune alerte sur une variation anormale de solde, un taux de réussite de paris suspect (3.6), ou un compte qui accumule anormalement. Détection de triche impossible sans 1.1.
- **Fichiers concernés** : à créer (s'appuie sur 1.1 et 1.2).
- **Piste d'implémentation** : règles d'alerte sur l'historique de transactions (seuils, ratios), tableau de bord GOD.
- **Effort** M · **Priorité** Basse

---

## 7. Intégrité & edge cases de règlement

### 7.1 Reset de saison : sort des coins/paris non spécifié
- **État actuel** : `DOMAIN.md` décrit le reset de saison comme touchant l'ELO/les notes, et précise que « le reset ne touche pas `leagueCoins` » (commentaire `index.ts:3615`). Mais les **paris ouverts** au moment d'un reset de saison ne sont pas explicitement traités.
- **Ce qui manque / problème** : ambiguïté. Les coins persistent (OK), mais que deviennent les paris `open` sur des tournois/ops à cheval sur la bascule de saison ? Les quêtes hebdo en cours ? Pas de spec ni de garde dédiée. Risque de paris orphelins (cf. 3.3) au changement de saison.
- **Fichiers concernés** : `index.ts` (logique de reset de saison ~`l.3615`, règlement des paris).
- **Piste d'implémentation** : documenter et tester explicitement le comportement (paris non liés à la saison → inchangés ; ou remboursement des paris ouverts au reset). Aligner avec 3.3.
- **Effort** S · **Priorité** Basse

### 7.2 Anonymisation RGPD : paris ouverts non remboursés ?
- **État actuel** : `refundOpenBetsForTournamentsTx` est appelé avant les suppressions en masse de tournois (`index.ts:301`, `3577`). Mais l'**anonymisation d'un compte** (`anonymizeAccount`, `purgeScheduledDeletions`, `index.ts:8251`) supprime/anonymise l'utilisateur ; `Bet.bettor` est `onDelete: Cascade` (`schema.prisma:745`).
- **Ce qui manque / problème** : si un compte avec des **paris ouverts** (sa mise est débitée et gelée) est supprimé/anonymisé, ses paris peuvent être effacés par cascade **sans que la mise lui revienne** (de toute façon il part) — mais surtout, cela **retire de la masse** des coins gelés sans règlement propre, et peut laisser des marchés incohérents. Le chemin d'anonymisation ne semble pas appeler `refundBetsTx` pour les paris du compte.
- **Fichiers concernés** : `index.ts` (`anonymizeAccount`, `purgeScheduledDeletions`), `schema.prisma:745`.
- **Piste d'implémentation** : vérifier/expliciter le traitement des paris ouverts à l'anonymisation (régler ou marquer `void`), pour cohérence comptable et auditabilité (1.1).
- **Effort** S · **Priorité** Basse

### 7.3 `grantCoinsTx` borne à 0 silencieusement (dette masquée)
- **État actuel** : `grantCoinsTx` fait `next = Math.max(0, target.leagueCoins + amount)` (`index.ts:7455`). Les débits vérifient le solde **en amont** (`/bets`, `/shop`, `/admin/shop/grant`).
- **Ce qui manque / problème** : la borne à 0 **masque** tout débit excédentaire bugué. Si un futur appelant débite sans vérifier le solde (ou avec une race échappant aux gardes), le solde tombe simplement à 0 — l'incohérence (coins « créés » du néant pour combler le débit) est invisible et non auditée. C'est un filet de sécurité qui cache les erreurs au lieu de les signaler.
- **Fichiers concernés** : `index.ts:7448` (`grantCoinsTx`).
- **Piste d'implémentation** : logguer/alerter (ou throw en mode strict) quand `target.leagueCoins + amount < 0` ; tracer le débit borné dans l'historique (1.1) avec un flag d'anomalie.
- **Effort** S · **Priorité** Basse

### 7.4 Pas d'idempotence sur le règlement (double-credit possible si re-confirmation)
- **État actuel** : `settleBetsTx`/`settleTournamentBetsForPick` ne règlent que les paris `status='open'` et passent à `won/lost` (`index.ts:7651`, `7689`). Le re-traitement d'un même pari est donc protégé par le passage de statut. Le **cash-prize** (`payCashPrizeTx`, `index.ts:7712`) et la **récompense de tournoi** (`grantCoinsTx` champion, `index.ts:4357`) n'ont **pas** de garde d'idempotence équivalente.
- **Ce qui manque / problème** : si la finale d'un tournoi était re-confirmée / re-déclenchée (bug, action admin de re-règlement, replay), `prizeCoins`/cash-prize seraient **re-crédités** (pas de marqueur « prize déjà versé »). Le règlement des paris est idempotent (via le statut), mais le versement des primes ne l'est pas explicitement.
- **Fichiers concernés** : `index.ts:4331-4369` (finale, `prizeAwarded`, `payCashPrizeTx`), `schema.prisma` (`Tournament`).
- **Piste d'implémentation** : marqueur d'idempotence (ex. `Tournament.prizePaidAt`) vérifié avant tout versement de prime/cash-prize ; clé d'idempotence sur l'historique (1.1).
- **Effort** S · **Priorité** Moyenne

---

## 8. Fonctionnalités annoncées mais non livrées

### 8.1 Classement de richesse (leaderboard de coins) absent
- **État actuel** : aucun classement par solde de coins. La recherche `richesse|wealthiest|leaderboard coin` ne renvoie aucun endpoint ni page. `leagueCoins` est explicitement exclu de `toPublicUser` (commentaire `index.ts:1901`).
- **Ce qui manque / problème** : pas de « top des plus riches », donc aucun objectif de statut autour des coins, et pas de boucle de prestige. (Note : exposer les soldes publiquement est aussi un choix de confidentialité — d'où l'exclusion actuelle de `toPublicUser` — à arbitrer.)
- **Fichiers concernés** : `index.ts` (pas d'endpoint), front (pas de page), `toPublicUser`.
- **Piste d'implémentation** : endpoint opt-in / réservé GOD d'un top richesse, ou classement « gains de la semaine » (moins sensible que le patrimoine absolu) basé sur l'historique (1.1).
- **Effort** M · **Priorité** Basse

### 8.2 Cadeaux / transferts de coins entre joueurs
- **État actuel** : aucun transfert P2P. Seul un admin peut créditer (`/admin/shop/grant`).
- **Ce qui manque / problème** : pas de don de coins entre joueurs, pas d'offre de cosmétique à un ami. Limite la dimension sociale et un éventuel sink (frais de transfert).
- **Fichiers concernés** : `index.ts` (à créer).
- **Piste d'implémentation** : `POST /coins/transfer { to, amount }` avec frais (sink), plafonds, journalisation (1.1) et garde anti-blanchiment (cf. collusion 3.6/6.1).
- **Effort** M · **Priorité** Basse

### 8.3 Malus d'inactivité hebdo (pending)
- **État actuel** : `DOC/pending.md:16` liste explicitement comme **non fait** : « Minimum hebdo : X matchs/semaine sinon malus / dégradation ELO ». Les quêtes récompensent l'activité mais aucun malus d'inactivité n'existe.
- **Ce qui manque / problème** : pas de pression à la rétention par la perte. (Côté économie, on pourrait imaginer une **taxe d'inactivité** / fonte des coins comme sink — non implémenté.) Item déjà identifié dans le backlog.
- **Fichiers concernés** : à créer ; `DOC/pending.md:16`.
- **Piste d'implémentation** : job hebdo appliquant un malus ELO **et/ou** une légère fonte de coins aux comptes inactifs (sink démographique). À équilibrer prudemment.
- **Effort** M · **Priorité** Basse

---

## 9. Tests & qualité

### 9.1 Aucun test backend de l'économie (coins/paris/quêtes/boutique)
- **État actuel** : les tests backend (`apps/backend/src/*.test.ts` : `admins`, `audit`, `auth`, `cors-origins`, `locations`, `rate-limit`, `sse`, `tokens`, `tournament.engine`, `tournament`) et les itests (`apps/backend/test/*.itest.ts` : `auth-coverage`, `challenges`, `consent`, `matches`, `smoke`) **ne couvrent pas** les endpoints `/shop*`, `/bets*`, `/quests*`, ni `grantCoinsTx`, `awardMatchEconomyTx`, `settleBetsTx`, `settleOpsDuelBetsTx`, `sweepExpiredOpsBets`. Aucun fichier ne référence `leagueCoins`/`/bets`/`/quests`/`/shop` en test.
- **Ce qui manque / problème** : la partie **monétaire** (donc la plus sensible aux bugs de double-crédit, race conditions, remboursements, soldes négatifs) n'a **aucun test backend**. Régression silencieuse garantie à terme. Les edge cases (mise > solde, double-claim, remboursement à la suppression, règlement d'ops égalité) ne sont pas verrouillés par des tests d'intégration.
- **Fichiers concernés** : `apps/backend/src/*.test.ts`, `apps/backend/test/*.itest.ts`.
- **Piste d'implémentation** : itests couvrant : achat (solde insuffisant, double achat, équip 1/cat), pose de pari (anti-doublon, participant interdit, solde insuffisant), règlement gagnant/perdant/remboursement, ops (vainqueur/égalité/aucun match), quête (claim, double-claim concurrent via le `FOR UPDATE`), grant admin (borne 0). Rappel mémo : les itests utilisent `prisma db push`.
- **Effort** L · **Priorité** Haute

### 9.2 Tests partagés limités à la logique pure
- **État actuel** : `tournament-economy.test.ts` et `anti-farming.test.ts` testent la logique **pure** (`betMultiplier`, `cashPrizeForRounds`, `farmingDecayFactor`). Pas de test de l'intégration de ces fonctions avec le règlement DB.
- **Ce qui manque / problème** : les fonctions pures sont validées, mais leur **branchement** (quel `roundsWon`/`totalRounds` est passé au bon moment, à la poule, à l'élimination, à la finale) n'est testé nulle part → c'est précisément là que les bugs d'économie se logent.
- **Fichiers concernés** : `packages/shared/src/*.test.ts`, manque côté backend (cf. 9.1).
- **Piste d'implémentation** : couvrir par les itests de 9.1 le câblage `settleTournamentBetsForPick`/`payCashPrizeTx` sur un vrai bracket (poules + bracket + finale).
- **Effort** M · **Priorité** Moyenne

---

## 10. Internationalisation (i18n)

### 10.1 Messages d'erreur API en français en dur
- **État actuel** : tous les messages d'erreur économiques sont des **chaînes françaises en dur** côté serveur : `'solde insuffisant'` (`index.ts:8068`/`8138`/`7189`), `'objet déjà possédé'` (`7187`), `'tu as déjà un pari ouvert sur ce tournoi'` (`8062`), `'tu ne peux pas parier sur un tournoi auquel tu participes'` (`8052`), `'quête non terminée'` (`7895`), `'récompense déjà réclamée'` (`7898`), etc. Le front est pourtant multilingue (fr/en/es, `locales/economy.ts`).
- **Ce qui manque / problème** : un utilisateur en anglais/espagnol verra des erreurs API **en français**. Incohérence avec l'effort i18n du front. Pas de codes d'erreur stables (le front ne peut pas traduire de façon fiable car il reçoit du texte FR, pas un code).
- **Fichiers concernés** : `index.ts` (tous les `HTTPException` économiques), `apps/web/src/lib/locales/economy.ts`.
- **Piste d'implémentation** : renvoyer des **codes d'erreur** stables (`INSUFFICIENT_BALANCE`, `ALREADY_OWNED`, `BET_DUPLICATE`, …) et laisser le front traduire ; ou messages neutres + mapping i18n côté client.
- **Effort** M · **Priorité** Basse

### 10.2 Valeurs chiffrées du guide « gagner des coins » figées en dur
- **État actuel** : `EARN_METHODS` dans `ShopPage.tsx:85` affiche en dur `value: '20–50'` (match), `'850'` (quêtes), `'×2'` (paris) — ces nombres dupliquent les constantes serveur (`COINS_PER_MATCH_*`, somme des `WEEKLY_QUESTS.reward`, `BET_PAYOUT_MULTIPLIER`).
- **Ce qui manque / problème** : **duplication** front/back des valeurs économiques. Si un admin/dev change `COINS_PER_MATCH_WON` ou une récompense de quête (a fortiori si 2.3 rend ça configurable), le guide pédagogique de la boutique **mentira** sans que rien ne le signale. De plus, `'850'` est la somme manuelle de 4 récompenses : tout ajout/retrait de quête désynchronise le chiffre.
- **Fichiers concernés** : `apps/web/src/pages/ShopPage.tsx:85`, `index.ts` (`COINS_PER_MATCH_*`, `WEEKLY_QUESTS`, `BET_PAYOUT_MULTIPLIER`).
- **Piste d'implémentation** : exposer ces valeurs via un endpoint (`GET /economy/config`) ou via `@42-league/shared`, et calculer le total des quêtes dynamiquement. Synergie avec 2.3.
- **Effort** S · **Priorité** Basse

---

## Synthèse des priorités

| Priorité | Manques |
| --- | --- |
| **Haute** | 1.1 (historique de transactions), 1.3 (audit des grants), 2.1 (sinks), 9.1 (tests backend économie) |
| **Moyenne** | 1.2, 1.4, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 5.5, 6.1, 6.2, 6.3, 7.4, 9.2 |
| **Basse** | 2.5, 3.6, 3.7, 3.8, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 6.4, 6.5, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 10.1, 10.2 |

**Trois chantiers structurants** (débloquent les autres) :
1. **Grand livre des transactions** (1.1) → prérequis de l'observabilité (1.2), des notifications (1.4), de l'anti-triche (6.5), des remboursements justes (5.5) et de l'idempotence (7.4).
2. **Vrais sinks récurrents** (2.1/2.2) + **cotes en pari mutuel** (3.1) → arrêtent l'inflation par construction.
3. **Couverture de tests backend** (9.1) → sécurise toute évolution de la partie monétaire.
