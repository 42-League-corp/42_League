# Manques — Profil & Social

> Domaine **Profil joueur, identité, avatars/grades, badges/trophées, suivi
> (Follow), équipes 2v2, saisons & palmarès, leaderboard & ses scopes (discipline,
> saison, nuage, H2H), GOAT, recherche de joueurs, cosmétiques, statut intra 42,
> RGPD/anonymisation**.
> Ce document recense **ce qui manque, est incomplet, fragile ou améliorable** — il
> ne documente PAS l'existant (voir `DOC/DOMAIN.md` §2bis, §10, §11 et `DOC/DATABASE.md`).
> Chaque entrée suit le gabarit : État actuel → Manque → Fichiers → Piste → Effort/Priorité.
>
> Légende effort : **S** (< ½ j) · **M** (½–2 j) · **L** (> 2 j).
> Légende priorité : **haute** (impact joueur fort / bug / RGPD) · **moyenne** · **basse** (confort, dette).

## Table des matières

1. [Badges & trophées](#1-badges--trophées)
   - 1.1 [Catalogue minuscule (4 badges) et figé](#11-catalogue-minuscule-4-badges-et-figé)
   - 1.2 [Aucun badge automatisé hors `season_champion`](#12-aucun-badge-automatisé-hors-season_champion)
   - 1.3 [Pas de route admin pour attribuer / retirer un badge](#13-pas-de-route-admin-pour-attribuer--retirer-un-badge)
   - 1.4 [Préférence `notifyTrophy` morte (jamais émise)](#14-préférence-notifytrophy-morte-jamais-émise)
   - 1.5 [Badge `founder` codé en dur sur deux logins](#15-badge-founder-codé-en-dur-sur-deux-logins)
   - 1.6 [Pas de notification de badge complète / historisée](#16-pas-de-notification-de-badge-complète--historisée)
   - 1.7 [`game` du badge non rendu (champion multi-discipline indistinct)](#17-game-du-badge-non-rendu-champion-multi-discipline-indistinct)
   - 1.8 [Pas de progression / badges « rares » / paliers](#18-pas-de-progression--badges-rares--paliers)
2. [Suivi (Follow) & graphe social](#2-suivi-follow--graphe-social)
   - 2.1 [Pas de notification quand on est suivi](#21-pas-de-notification-quand-on-est-suivi)
   - 2.2 [`/follows` et `/followers` sans pagination ni filtre hors-jeu](#22-follows-et-followers-sans-pagination-ni-filtre-hors-jeu)
   - 2.3 [Pas de réglage de toutes les prefs de notif depuis le profil perso](#23-pas-de-réglage-de-toutes-les-prefs-de-notif-depuis-le-profil-perso)
   - 2.4 [Aucune mention « se suivent mutuellement » / amis](#24-aucune-mention-se-suivent-mutuellement--amis)
   - 2.5 [Pas de blocage / mute](#25-pas-de-blocage--mute)
   - 2.6 [Compteurs `following`/`followers` non exposés en agrégat](#26-compteurs-followingfollowers-non-exposés-en-agrégat)
3. [Fonctionnalités sociales absentes](#3-fonctionnalités-sociales-absentes)
   - 3.1 [Aucune messagerie / chat](#31-aucune-messagerie--chat)
   - 3.2 [Pas de rivalités / némésis automatiques](#32-pas-de-rivalités--némésis-automatiques)
   - 3.3 [Pas de commentaires / réactions sur les matchs](#33-pas-de-commentaires--réactions-sur-les-matchs)
   - 3.4 [Aucun partage externe / Open Graph / profil public sans login](#34-aucun-partage-externe--open-graph--profil-public-sans-login)
   - 3.5 [Pas de flux d'activité (feed)](#35-pas-de-flux-dactivité-feed)
4. [Profil joueur (page, stats, historique)](#4-profil-joueur-page-stats-historique)
   - 4.1 [`/users/:login` : historique plafonné à 50, multi-jeux mélangés](#41-usersuserlogin--historique-plafonné-à-50-multi-jeux-mélangés)
   - 4.2 [Rang affiché = rang babyfoot, indépendant du mode consulté](#42-rang-affiché--rang-babyfoot-indépendant-du-mode-consulté)
   - 4.3 [Win/loss/draw calculés sur 50 derniers matchs seulement](#43-winlossdraw-calculés-sur-50-derniers-matchs-seulement)
   - 4.4 [Pas de stats fines (streak, meilleur ELO, par perso, FFA…)](#44-pas-de-stats-fines-streak-meilleur-elo-par-perso-ffa)
   - 4.5 [Historique sans pagination « voir plus »](#45-historique-sans-pagination-voir-plus)
   - 4.6 [FFA / fléchettes absents de l'historique profil](#46-ffa--fléchettes-absents-de-lhistorique-profil)
5. [Identité, pseudo & RGPD](#5-identité-pseudo--rgpd)
   - 5.1 [Anonymisation : badges, follows et cosmétiques non purgés](#51-anonymisation--badges-follows-et-cosmétiques-non-purgés)
   - 5.2 [Pas de re-rendu live après anonymisation (caches front)](#52-pas-de-re-rendu-live-après-anonymisation-caches-front)
   - 5.3 [`firstName`/`lastName` exposés sans option de masquage](#53-firstnamelastname-exposés-sans-option-de-masquage)
   - 5.4 [Pas de purge effective post-période de grâce visible](#54-pas-de-purge-effective-post-période-de-grâce-visible)
6. [Avatars & anneau de grade](#6-avatars--anneau-de-grade)
   - 6.1 [Anneau absent hors provider (profil, recherche, hovercard…)](#61-anneau-absent-hors-provider-profil-recherche-hovercard)
   - 6.2 [Couleur d'anneau = mode courant uniquement](#62-couleur-danneau--mode-courant-uniquement)
   - 6.3 [`alt`/a11y de l'avatar = login brut](#63-alta11y-de-lavatar--login-brut)
   - 6.4 [Pas de gestion d'images cassées côté `team/photos`](#64-pas-de-gestion-dimages-cassées-côté-teamphotos)
7. [Grades & rangs](#7-grades--rangs)
   - 7.1 [Grand Master positionnel non expliqué / non notifié](#71-grand-master-positionnel-non-expliqué--non-notifié)
   - 7.2 [Pas de notification de montée/descente de grade](#72-pas-de-notification-de-montéedescente-de-grade)
   - 7.3 [Grade figé par mode, pas de « grade principal » lisible](#73-grade-figé-par-mode-pas-de-grade-principal-lisible)
8. [Équipes 2v2 babyfoot](#8-équipes-2v2-babyfoot)
   - 8.1 [Duos créés silencieusement, pas d'invitation / consentement](#81-duos-créés-silencieusement-pas-dinvitation--consentement)
   - 8.2 [Renommage du duo sans contrôle d'accès clair / modération](#82-renommage-du-duo-sans-contrôle-daccès-clair--modération)
   - 8.3 [`/teams/leaderboard` non scopé par saison ni filtré hors-jeu](#83-teamsleaderboard-non-scopé-par-saison-ni-filtré-hors-jeu)
   - 8.4 [Pas de palmarès / badges / grade d'équipe](#84-pas-de-palmarès--badges--grade-déquipe)
   - 8.5 [Pas de stats H2H entre équipes, ni d'historique dédié](#85-pas-de-stats-h2h-entre-équipes-ni-dhistorique-dédié)
   - 8.6 [Pas de dissolution / archivage de duo](#86-pas-de-dissolution--archivage-de-duo)
9. [Saisons & palmarès](#9-saisons--palmarès)
   - 9.1 [Aucun calendrier automatique (clôture 100 % manuelle)](#91-aucun-calendrier-automatique-clôture-100--manuelle)
   - 9.2 [`palmaresFor` ne retourne que le babyfoot](#92-palmaresfor-ne-retourne-que-le-babyfoot)
   - 9.3 [Standings d'équipe non figés en fin de saison](#93-standings-déquipe-non-figés-en-fin-de-saison)
   - 9.4 [GOAT all-time : pas de modèle dédié, recalculé à la volée](#94-goat-all-time--pas-de-modèle-dédié-recalculé-à-la-volée)
   - 9.5 [`/seasons/:id/activate` casse l'invariant « une seule clôturée »](#95-seasonsidactivate-casse-linvariant-une-seule-clôturée)
   - 9.6 [Pas d'annonce / récap de fin de saison](#96-pas-dannonce--récap-de-fin-de-saison)
10. [Leaderboard & ses scopes](#10-leaderboard--ses-scopes)
    - 10.1 [Recherche / filtre absent du leaderboard](#101-recherche--filtre-absent-du-leaderboard)
    - 10.2 [Nuage de points & scatter : a11y et perf](#102-nuage-de-points--scatter--a11y-et-perf)
    - 10.3 [H2H calculé 100 % client, babyfoot only, pas de lien profil](#103-h2h-calculé-100--client-babyfoot-only-pas-de-lien-profil)
    - 10.4 [Pas de pagination / virtualisation du classement](#104-pas-de-pagination--virtualisation-du-classement)
11. [Recherche de joueurs](#11-recherche-de-joueurs)
    - 11.1 [Recherche locale seulement, sur la liste plafonnée](#111-recherche-locale-seulement-sur-la-liste-plafonnée)
    - 11.2 [Pas de recherche par prénom/nom, ni tolérance de casse/accents](#112-pas-de-recherche-par-prénomnom-ni-tolérance-de-casseaccents)
    - 11.3 [Pas d'endpoint `/search` serveur](#113-pas-dendpoint-search-serveur)
12. [Cosmétiques équipés (titres / bannières / badges achetés)](#12-cosmétiques-équipés-titres--bannières--badges-achetés)
13. [Statut intra 42 (pastille dispo)](#13-statut-intra-42-pastille-dispo)
14. [Observabilité, audit & métriques](#14-observabilité-audit--métriques)
15. [Tests manquants](#15-tests-manquants)
16. [i18n manquant / en dur](#16-i18n-manquant--en-dur)
17. [Accessibilité (a11y)](#17-accessibilité-a11y)
18. [Divergences desktop / mobile](#18-divergences-desktop--mobile)
19. [Dette technique & cohérence du modèle](#19-dette-technique--cohérence-du-modèle)

---

## 1. Badges & trophées

### 1.1 Catalogue minuscule (4 badges) et figé
- **État actuel** : le catalogue front (`apps/web/src/lib/badges.ts:16`) ne contient que
  **4 entrées** : `founder`, `admin`, `beta_tester`, `season_champion`. Tout code inconnu
  retombe sur un rendu générique (`badgeDef`, `:44`).
- **Ce qui manque / problème** :
  - Aucun badge récompensant l'activité réelle : nombre de matchs (10/100/1000),
    série de victoires, tournoi remporté, premier OPS, premier 2v2, GOAT du mois,
    montée Diamant, fléchettes 180, FFA gagné, premier pari gagné, etc.
  - Le catalogue est **hardcodé côté front** : impossible d'en ajouter sans déploiement.
  - Pas de séparation « badge de palmarès » vs « badge cosmétique acheté » dans le catalogue
    (le second passe par `EquippedBadge` inline boutique — deux systèmes parallèles).
- **Fichiers concernés** : `apps/web/src/lib/badges.ts`, `apps/web/src/lib/badgeIcons.ts`,
  `apps/web/src/components/Badges.tsx`, `apps/backend/src/index.ts:532` (`badgesFor`),
  `prisma/schema.prisma:138` (`UserBadge`).
- **Piste d'implémentation** : définir un catalogue partagé dans `@42-league/shared`
  (clé → label/desc/couleur/icône/condition) consommé par front ET backend ;
  fonction `evaluateBadges(login)` appelée au settlement de match/tournoi/saison.
- **Effort** L · **Priorité** moyenne.

### 1.2 Aucun badge automatisé hors `season_champion`
- **État actuel** : un seul badge est attribué par code : `season_champion`, à la clôture
  de saison (`apps/backend/src/index.ts:1811`, `userBadge.upsert`). `beta_tester` n'a été
  posé qu'**une fois** par une migration SQL de backfill
  (`prisma/migrations/20260605000000_add_seasons/migration.sql:34`). `founder` et `admin`
  sont **dérivés à la volée** du login/rôle (`badgesFor`, `:539`-`:540`), pas stockés.
- **Ce qui manque / problème** : aucun hook d'attribution sur les événements de jeu
  (victoire de tournoi, palier de matchs, streak, premier 2v2…). Le système de badges
  est donc, en pratique, **quasi inerte** : un joueur ne gagne jamais de nouveau badge
  sauf à finir n°1 d'une saison.
- **Fichiers concernés** : `apps/backend/src/index.ts` (settlement match `~:2600`+,
  tournoi `~:4200`+, FFA `~:2940`), `prisma/schema.prisma:138`.
- **Piste d'implémentation** : helper `awardBadge(tx, login, code, {game, seasonId})`
  idempotent (la contrainte `@@unique([userLogin, code, game])` garantit l'unicité),
  appelé dans chaque transaction de settlement, suivi d'un `notify`.
- **Effort** M · **Priorité** moyenne.

### 1.3 Pas de route admin pour attribuer / retirer un badge
- **État actuel** : il existe `POST /admin/shop/grant-item` (`:8180`) pour donner un
  **cosmétique de boutique**, mais **aucune** route pour attribuer/retirer un `UserBadge`
  de palmarès. Les admins ne peuvent donc pas corriger un badge à la main.
- **Ce qui manque / problème** : impossible de réparer un `season_champion` mal attribué
  (ex. ex æquo, tricherie annulée), ni de donner un badge honorifique ponctuel. Pas de
  trace `AdminAuditLog` associée (pas d'`AdminAction` `GRANT_BADGE`).
- **Fichiers concernés** : `apps/backend/src/index.ts`, `prisma/schema.prisma:598`
  (enum `AdminAction`).
- **Piste d'implémentation** : `POST/DELETE /admin/users/:login/badges/:code` réservé
  ADMIN+, avec audit log et notif. Ajouter `GRANT_BADGE` / `REVOKE_BADGE` à l'enum.
- **Effort** S · **Priorité** basse.

### 1.4 Préférence `notifyTrophy` morte (jamais émise)
- **État actuel** : `Follow.notifyTrophy` existe (`schema.prisma:126`), est réglable
  (`FollowPrefsSchema`, `:2092`) et affichée comme toggle, mais **aucun** appel
  `notifyFollowers(login, 'notifyTrophy', …)` n'existe dans le backend. Seules
  `notifyTop3`, `notifyOps`, `notifyTournament` sont réellement émises
  (`grep` : `:517`, `:2692`, `:4649`, `:4734`, `:4866`, `:5719`, `:5725`).
- **Ce qui manque / problème** : un abonné qui active « me prévenir quand X gagne un
  trophée » ne reçoit **jamais** rien. Toggle trompeur (dette « UI sans backend »).
- **Fichiers concernés** : `apps/backend/src/index.ts:494` (`notifyFollowers`),
  settlement tournoi (`~:4200`+), settlement saison (`:1857`), `PlayerPage.tsx:167`.
- **Piste d'implémentation** : émettre `notifyFollowers(winner, 'notifyTrophy', …)`
  à la victoire d'un tournoi et à l'attribution d'un badge (cf. 1.2/1.6).
- **Effort** S · **Priorité** moyenne.

### 1.5 Badge `founder` codé en dur sur deux logins
- **État actuel** : `badgesFor` (`:539`) ajoute `founder` si
  `['throbert', 'abidaux'].includes(login.toLowerCase())`. Liste en dur, dupliquée
  ailleurs (`SUPERADMINS`).
- **Ce qui manque / problème** : pas de source unique de vérité ; ajouter un fondateur
  exige un déploiement. Aucun lien avec une éventuelle table de rôles honorifiques.
- **Fichiers concernés** : `apps/backend/src/index.ts:539`.
- **Piste d'implémentation** : déplacer la liste dans une constante partagée (ou un
  `UserBadge` réel `founder` posé par migration), supprimer la dérivation à la volée.
- **Effort** S · **Priorité** basse.

### 1.6 Pas de notification de badge complète / historisée
- **État actuel** : la seule notif de badge est celle du champion de saison babyfoot
  (`:1857`, `type: 'badge'`). Les champions des **autres disciplines** ne sont **pas**
  notifiés (la map `champions` couvre tous les jeux mais seul `babyfootChamp` déclenche
  un `notify`, `:1846`-`:1864`).
- **Ce qui manque / problème** : un champion Smash/Chess/SF gagne le badge mais n'est
  jamais prévenu. Pas de notif pour les futurs badges automatisés (cf. 1.2).
- **Fichiers concernés** : `apps/backend/src/index.ts:1809`-`:1865`.
- **Piste d'implémentation** : boucler sur `champions` (toutes disciplines) pour notifier,
  centraliser via `awardBadge` (cf. 1.2) qui notifie systématiquement.
- **Effort** S · **Priorité** moyenne.

### 1.7 `game` du badge non rendu (champion multi-discipline indistinct)
- **État actuel** : `UserBadge.game` distingue un `season_champion` babyfoot d'un champion
  chess (`schema.prisma:145`), mais `badgesFor` ne renvoie que les **codes** (`:541`),
  pas le `game`. Le front affiche donc « Champion » sans préciser la discipline ; deux
  badges champion fusionnent même via `[...new Set(out)]` (`:542`).
- **Ce qui manque / problème** : un joueur champion en babyfoot ET en chess n'affiche
  qu'**un seul** badge « Champion », perdant l'info de discipline et le doublon.
- **Fichiers concernés** : `apps/backend/src/index.ts:532`-`:542`,
  `apps/web/src/lib/badges.ts`, `apps/web/src/components/Badges.tsx`.
- **Piste d'implémentation** : renvoyer `{code, game, seasonId}[]` au lieu de `string[]` ;
  enrichir le label front (« Champion · Babyfoot · Saison 3 »).
- **Effort** M · **Priorité** basse.

### 1.8 Pas de progression / badges « rares » / paliers
- **État actuel** : un badge est binaire (possédé ou non). Aucune notion de rareté,
  de progression (« 73/100 matchs »), ni de tri par prestige.
- **Ce qui manque / problème** : pas d'incitation graduée ; le `ShopItem` possède pourtant
  un champ `rarity` (`schema.prisma:651`) non répliqué côté `UserBadge`.
- **Fichiers concernés** : `prisma/schema.prisma:138`, `apps/web/src/components/Badges.tsx`.
- **Piste d'implémentation** : ajouter `rarity`/`tier` à `UserBadge` + barre de progression
  dans la modale badges pour les badges à seuil.
- **Effort** M · **Priorité** basse.

---

## 2. Suivi (Follow) & graphe social

### 2.1 Pas de notification quand on est suivi
- **État actuel** : `POST /follows` (`:2118`) crée la relation et renvoie la ligne, sans
  aucune notification au suivi.
- **Ce qui manque / problème** : le joueur suivi n'apprend jamais qu'il a un nouvel abonné
  (boucle d'engagement « GitHub follow » incomplète). C'est pourtant un vecteur social fort.
- **Fichiers concernés** : `apps/backend/src/index.ts:2118`.
- **Piste d'implémentation** : `notify(login, { type: 'new_follower', title: '@me te suit', … })`
  après l'upsert (idempotent : ne re-notifier que sur création réelle, pas sur ré-upsert).
- **Effort** S · **Priorité** moyenne.

### 2.2 `/follows` et `/followers` sans pagination ni filtre hors-jeu
- **État actuel** : `/follows` (`:2097`) et `/followers` (`:2108`) renvoient **toutes** les
  lignes, sans `take`, et **sans** filtrer les abonnés bannis/anonymisés (le `include`
  ne pose pas de `where` sur `VISIBLE_USER_WHERE`).
- **Ce qui manque / problème** :
  - Un compte anonymisé/banni reste **listé** dans le réseau d'un joueur (login `anon_xxx`,
    photo nulle) → fuite RGPD légère + UI cassée.
  - Pas de pagination : un joueur très suivi charge tout d'un bloc.
  - Idem dans `/users/:login` (`:1415`-`:1424`) : `followingList`/`followersList` non filtrés.
- **Fichiers concernés** : `apps/backend/src/index.ts:2097`, `:2108`, `:1415`-`:1459`,
  `apps/web/src/components/FollowLists.tsx`.
- **Piste d'implémentation** : filtrer sur `VISIBLE_USER_WHERE` côté `followee`/`follower`,
  ajouter `take`/curseur, et nettoyer les follows orphelins lors de l'anonymisation (cf. 5.1).
- **Effort** M · **Priorité** moyenne.

### 2.3 Pas de réglage de toutes les prefs de notif depuis le profil perso
- **État actuel** : les prefs `notify*` se règlent **par personne suivie** depuis sa fiche
  (`PlayerPage.tsx:165`-`:167`). Aucun écran « mes abonnements » avec réglage groupé, ni
  réglage global dans `ReglagesPage.tsx`.
- **Ce qui manque / problème** : pour couper les notifs de 20 suivis, il faut ouvrir 20
  fiches. Pas de « tout couper » ni de défaut global.
- **Fichiers concernés** : `apps/web/src/pages/ReglagesPage.tsx`,
  `apps/web/src/components/FollowLists.tsx`, `apps/backend/src/index.ts:2141`.
- **Piste d'implémentation** : panneau « Abonnements » listant les suivis avec toggles
  inline (réutilise `PATCH /follows/:login`), + action « réglages par défaut ».
- **Effort** M · **Priorité** basse.

### 2.4 Aucune mention « se suivent mutuellement » / amis
- **État actuel** : `Follow` est unidirectionnel ; aucune notion d'« amitié »
  (suivi réciproque) n'est calculée ni affichée.
- **Ce qui manque / problème** : pas de badge « vous vous suivez », pas de tri des suivis
  mutuels en tête, pas de suggestion « X te suit, le suivre en retour ».
- **Fichiers concernés** : `apps/backend/src/index.ts:2097`-`:2116`,
  `apps/web/src/components/FollowLists.tsx`.
- **Piste d'implémentation** : marquer `mutual: bool` dans les edges renvoyés (jointure
  croisée sur `Follow`), pastille front + suggestion « suivre en retour ».
- **Effort** S · **Priorité** basse.

### 2.5 Pas de blocage / mute
- **État actuel** : aucun mécanisme pour empêcher un joueur de me suivre, de me défier,
  de m'OPS ou de me mentionner.
- **Ce qui manque / problème** : pas de protection contre le harcèlement (OPS répétés,
  défis spam). Le seul levier est le ban admin global.
- **Fichiers concernés** : `prisma/schema.prisma` (nouveau modèle `Block`),
  `apps/backend/src/index.ts` (gardes follow/challenge/ops).
- **Piste d'implémentation** : modèle `Block(blockerLogin, blockedLogin)` + vérif dans
  `assertTargetable`/`POST /follows`/`/challenges`/`/ops`.
- **Effort** L · **Priorité** basse.

### 2.6 Compteurs `following`/`followers` non exposés en agrégat
- **État actuel** : les compteurs sont dérivés de la **longueur des listes** côté front
  (`FollowLists.tsx:38`-`:39`). `/users/:login` renvoie les listes complètes plutôt qu'un
  `count`.
- **Ce qui manque / problème** : surcoût de transfert (payload entier juste pour un nombre),
  et impossible d'afficher « 1.2k abonnés » sans tout charger.
- **Fichiers concernés** : `apps/backend/src/index.ts:1415`-`:1459`,
  `apps/web/src/components/FollowLists.tsx:38`.
- **Piste d'implémentation** : exposer `followingCount`/`followersCount` (`prisma.count`)
  et charger les listes à la demande (onglet ouvert).
- **Effort** S · **Priorité** basse.

---

## 3. Fonctionnalités sociales absentes

### 3.1 Aucune messagerie / chat
- **État actuel** : aucune messagerie directe, aucun salon. La seule communication est
  asynchrone via les actions de jeu (défi, OPS, contestation).
- **Ce qui manque / problème** : impossible d'organiser un match (« on joue à 14h ? »)
  dans l'app ; les joueurs sortent vers Discord/intra.
- **Fichiers concernés** : nouveau domaine (modèle `Message`/`Thread`, routes, SSE).
- **Piste d'implémentation** : DM minimal entre joueurs qui se suivent mutuellement,
  diffusé via le canal SSE existant (`/events`).
- **Effort** L · **Priorité** basse.

### 3.2 Pas de rivalités / némésis automatiques
- **État actuel** : le H2H existe (`H2HPage.tsx`) mais il faut **saisir** manuellement
  deux logins en query (`?a=&b=`). Aucune mise en avant automatique du rival.
- **Ce qui manque / problème** : pas de « ton pire ennemi » (adversaire le plus joué /
  pire bilan), pas d'encart rivalité sur le profil, pas de notif « revanche ».
- **Fichiers concernés** : `apps/web/src/pages/H2HPage.tsx`, profil
  (`apps/web/src/pages/profil/*`), `apps/backend/src/index.ts:1382` (`/users/:login`).
- **Piste d'implémentation** : calculer le top adversaire (par volume / par bilan) côté
  `/users/:login` et l'afficher en encart avec lien direct vers `/h2h`.
- **Effort** M · **Priorité** moyenne.

### 3.3 Pas de commentaires / réactions sur les matchs
- **État actuel** : un match joué (`PlayedMatch`) est un enregistrement muet.
- **Ce qui manque / problème** : pas de « GG », pas d'emoji-réaction, pas de trash-talk
  encadré — alors que la culture de la league est très sociale (cf. OPS « la chasse »).
- **Fichiers concernés** : `prisma/schema.prisma` (modèle `MatchReaction`), historique.
- **Piste d'implémentation** : réactions emoji légères (1 par joueur/match) diffusées en SSE.
- **Effort** M · **Priorité** basse.

### 3.4 Aucun partage externe / Open Graph / profil public sans login
- **État actuel** : **toutes** les routes data exigent une auth (« Privacy by design »,
  `index.ts:1319`). Un lien de profil partagé hors-app affiche la page de login.
- **Ce qui manque / problème** : impossible de partager « regarde mon classement » sur
  Discord avec une carte de prévisualisation (pas de balises OG/Twitter, pas de page
  publique en lecture seule, pas d'image générée).
- **Fichiers concernés** : `apps/web/index.html`, `apps/backend/src/index.ts` (route OG
  publique), `apps/web/src/pages/PlayerPage.tsx`.
- **Piste d'implémentation** : endpoint public **read-only** opt-in (RGPD) renvoyant un
  sous-ensemble + balises OG + image carte générée. Respecter le consentement.
- **Effort** L · **Priorité** basse.

### 3.5 Pas de flux d'activité (feed)
- **État actuel** : la cloche `Notification` est la seule timeline ; pas de feed des
  matchs/exploits des joueurs suivis.
- **Ce qui manque / problème** : pas de page « quoi de neuf chez mes suivis » (matchs,
  montées de grade, tournois gagnés).
- **Fichiers concernés** : nouvelle page + agrégat backend sur `PlayedMatch`/`UserBadge`.
- **Piste d'implémentation** : feed paginé filtré par les `followeeLogin` de l'utilisateur.
- **Effort** L · **Priorité** basse.

---

## 4. Profil joueur (page, stats, historique)

### 4.1 `/users/:login` : historique plafonné à 50, multi-jeux mélangés
- **État actuel** : `/users/:login` (`:1407`-`:1413`) charge les **50 derniers**
  `PlayedMatch` toutes disciplines confondues (`OR playerA/B`), sans filtre `game`.
- **Ce qui manque / problème** : un joueur multi-jeux voit son historique babyfoot dilué
  par le smash ; pas de séparation par onglet de discipline ; les W/L (cf. 4.3) mélangent
  tous les jeux.
- **Fichiers concernés** : `apps/backend/src/index.ts:1407`-`:1432`,
  `apps/web/src/pages/PlayerPage.tsx`, `apps/web/src/pages/profil/shared/ProfilHistory.tsx`.
- **Piste d'implémentation** : accepter `?game=` et grouper par discipline ; renvoyer des
  compteurs par jeu.
- **Effort** M · **Priorité** moyenne.

### 4.2 Rang affiché = rang babyfoot, indépendant du mode consulté
- **État actuel** : `rank` dans `/users/:login` est calculé sur
  `allUsers … orderBy: { elo: 'desc' }` (`:1402`-`:1426`) — **toujours l'ELO babyfoot**,
  jamais celui du mode regardé.
- **Ce qui manque / problème** : sur un profil consulté en contexte Smash, le rang affiché
  reste le rang babyfoot → incohérent avec l'anneau de grade (qui suit le mode courant,
  cf. 6.2).
- **Fichiers concernés** : `apps/backend/src/index.ts:1402`-`:1426`.
- **Piste d'implémentation** : paramétrer le calcul de rang par `game` (réutiliser
  `eloOrderBy`/`readElo` déjà utilisés pour le leaderboard).
- **Effort** S · **Priorité** moyenne.

### 4.3 Win/loss/draw calculés sur 50 derniers matchs seulement
- **État actuel** : `wins`/`losses`/`draws` (`:1427`-`:1432`) sont dérivés du tableau
  `played` **déjà tronqué à 50** (`take: 50`, `:1412`).
- **Ce qui manque / problème** : le bilan affiché n'est **pas** le bilan carrière mais
  celui des 50 derniers matchs — trompeur pour un vétéran. Le winrate du profil est faux.
- **Fichiers concernés** : `apps/backend/src/index.ts:1407`-`:1432`.
- **Piste d'implémentation** : agréger les W/L via `groupBy`/`count` sur **tout**
  l'historique (par jeu), indépendamment de la liste « 50 récents ».
- **Effort** S · **Priorité** haute.

### 4.4 Pas de stats fines (streak, meilleur ELO, par perso, FFA…)
- **État actuel** : le profil expose ELO courant, W/L (biaisé, cf. 4.3), tournois gagnés,
  coins. `computePlayerStats` (front) reste basique.
- **Ce qui manque / problème** : pas de série en cours / record de série, pas de pic d'ELO
  historique, pas de stats par personnage (Smash/SF, alors que `favSmash`/`favSf` existent),
  pas de moyenne de buts, pas de bilan FFA/fléchettes, pas de meilleur jour/heure.
- **Fichiers concernés** : `apps/web/src/lib/playerStats.ts`,
  `apps/backend/src/index.ts:1382`, `prisma/schema.prisma` (`PlayedMatch`,
  `PlayedFfaParticipant`).
- **Piste d'implémentation** : route `/users/:login/stats?game=` calculant streaks, peak,
  par-perso ; cartes dédiées sur le profil.
- **Effort** L · **Priorité** moyenne.

### 4.5 Historique sans pagination « voir plus »
- **État actuel** : 50 matchs renvoyés, point. Pas de bouton « charger plus ».
- **Ce qui manque / problème** : impossible de remonter au-delà de 50 sur le profil
  (alors que `HistoriquePage` existe pour soi).
- **Fichiers concernés** : `apps/web/src/pages/profil/shared/ProfilHistory.tsx`,
  `apps/backend/src/index.ts:1407`.
- **Piste d'implémentation** : curseur `before=<playedAt>` + « voir plus ».
- **Effort** M · **Priorité** basse.

### 4.6 FFA / fléchettes absents de l'historique profil
- **État actuel** : `/users/:login` ne lit que `playedMatch` (1v1/2v2). Les
  `PlayedFfaParticipant` (Smash FFA, fléchettes 301/501) ne remontent **pas** au profil.
- **Ce qui manque / problème** : un joueur essentiellement fléchettes/FFA a un profil
  quasi vide ; son ELO fléchettes/smash bouge sans historique consultable sur sa fiche.
- **Fichiers concernés** : `apps/backend/src/index.ts:1382`,
  `prisma/schema.prisma:524` (`PlayedFfaParticipant`).
- **Piste d'implémentation** : fusionner FFA dans l'historique (timeline unifiée triée par
  date), ou onglet dédié.
- **Effort** M · **Priorité** moyenne.

---

## 5. Identité, pseudo & RGPD

### 5.1 Anonymisation : badges, follows et cosmétiques non purgés
- **État actuel** : `anonymizeAccount` (`:1221`) renomme le login (cascade FK), met
  `imageUrl/title/campus/ftId` à null, purge tournois/défis/FFA. Mais **ne touche pas** :
  les `UserBadge` (restent attachés au `anon_xxx`), les `Follow` (le réseau du compte
  anonymisé reste intact), les `ShopInventory`/cosmétiques équipés.
- **Ce qui manque / problème** :
  - Un `anon_xxx` peut continuer à **apparaître dans les listes de suivis** d'autres
    joueurs (cf. 2.2) avec ses badges → anonymisation incomplète.
  - `firstName`/`lastName` **ne sont PAS nullifiés** par `anonymizeAccount` (le `data`
    `:1235`-`:1243` n'inclut pas `firstName`/`lastName`) → **fuite d'identité réelle**
    après anonymisation. **Bug RGPD.**
- **Fichiers concernés** : `apps/backend/src/index.ts:1221`-`:1250`.
- **Piste d'implémentation** : dans la transaction, ajouter `firstName: null, lastName: null`,
  supprimer `follow` (les deux sens), purger `userBadge` & `shopInventory` (ou au moins
  déséquiper), et nettoyer les `Notification` mentionnant le login.
- **Effort** M · **Priorité** **haute** (conformité).

### 5.2 Pas de re-rendu live après anonymisation (caches front)
- **État actuel** : `DELETE /me/account` broadcaste `data:update` (`:1274`), mais les
  profils/listes déjà ouverts chez d'autres joueurs peuvent garder en cache l'ancien login.
- **Ce qui manque / problème** : fenêtre où l'identité reste visible jusqu'au refetch.
- **Fichiers concernés** : `apps/backend/src/index.ts:1252`-`:1276`, `useLeagueData.tsx`.
- **Piste d'implémentation** : invalidation ciblée + suppression locale des entrées du login.
- **Effort** S · **Priorité** basse.

### 5.3 `firstName`/`lastName` exposés sans option de masquage
- **État actuel** : `toPublicUser` expose `firstName`/`lastName` ; le front affiche
  « Prénom Nom » par défaut (`Avatar.tsx:127`).
- **Ce qui manque / problème** : aucun réglage « afficher mon login plutôt que mon nom ».
  Certains joueurs ne veulent pas exposer leur identité civile.
- **Fichiers concernés** : `apps/backend/src/index.ts:367` (`toPublicUser`),
  `apps/web/src/components/Avatar.tsx:126`, `ReglagesPage.tsx`.
- **Piste d'implémentation** : flag `displayRealName` sur `User`, respecté par
  `toPublicUser`/`UserBadge`.
- **Effort** M · **Priorité** moyenne.

### 5.4 Pas de purge effective post-période de grâce visible
- **État actuel** : `DELETE /me/account` pose `deletionScheduledAt` (`:1262`) ; la doc
  mentionne un balayage d'anonymisation (`~:8248`). La purge réelle des données reste
  opaque côté profil (pas de date de suppression définitive affichée à l'utilisateur).
- **Ce qui manque / problème** : l'utilisateur ne sait pas **quand** ses données seront
  effacées ni comment annuler explicitement (au-delà du « se reconnecter »).
- **Fichiers concernés** : `apps/backend/src/index.ts:1252`, `ReglagesPage.tsx`.
- **Piste d'implémentation** : afficher la date d'effacement (`+ACCOUNT_GRACE_DAYS`) et un
  bouton « annuler la suppression ».
- **Effort** S · **Priorité** moyenne.

---

## 6. Avatars & anneau de grade

### 6.1 Anneau absent hors provider (profil, recherche, hovercard…)
- **État actuel** : l'anneau provient de `AvatarRingProvider` qui dérive la table
  `login→couleur` du `leaderboard` du **mode courant** (`useAvatarRing.tsx:24`-`:32`).
  Hors provider, `lookup` renvoie `null` (`:18`).
- **Ce qui manque / problème** :
  - Sur une vue où le contexte n'est pas alimenté (ou pour un joueur **absent du
    leaderboard du mode courant** — ex. il ne joue pas ce mode), l'anneau **disparaît**,
    même si le joueur a un grade dans une autre discipline.
  - Le provider exige `matchesPlayed > 0` (`:29`) : un nouveau joueur n'a jamais d'anneau.
- **Fichiers concernés** : `apps/web/src/hooks/useAvatarRing.tsx`,
  `apps/web/src/components/Avatar.tsx:71`, `PlayerHoverCard.tsx`,
  `apps/web/src/pages/defis/shared/PlayerSearch.tsx`.
- **Piste d'implémentation** : permettre de passer une couleur explicite à `Avatar`
  (ex. depuis `/users/:login` qui connaît le grade par mode), en complément du lookup.
- **Effort** M · **Priorité** basse.

### 6.2 Couleur d'anneau = mode courant uniquement
- **État actuel** : la couleur suit le **mode de jeu courant** (`useAvatarRing.tsx` doc).
- **Ce qui manque / problème** : sur la fiche d'un joueur, l'anneau peut contredire le rang
  babyfoot affiché (cf. 4.2). Pas de cohérence « grade de la discipline regardée ».
- **Fichiers concernés** : `apps/web/src/hooks/useAvatarRing.tsx`, `PlayerPage.tsx`.
- **Piste d'implémentation** : aligner anneau + rang + stats sur le même `game` sélectionné.
- **Effort** M · **Priorité** basse.

### 6.3 `alt`/a11y de l'avatar = login brut
- **État actuel** : `<img alt={login}>` (`Avatar.tsx:101`) ; le placeholder est une initiale
  sans `aria-label`.
- **Ce qui manque / problème** : un lecteur d'écran annonce le login technique plutôt que
  « Photo de Prénom Nom » ; le placeholder lettre n'est pas décrit.
- **Fichiers concernés** : `apps/web/src/components/Avatar.tsx:99`-`:107`.
- **Piste d'implémentation** : `alt` = nom affiché ; `aria-label`/`role="img"` sur le
  placeholder.
- **Effort** S · **Priorité** basse.

### 6.4 Pas de gestion d'images cassées côté `team/photos`
- **État actuel** : `Avatar` gère le `onError` (`:102`) pour retomber sur l'initiale. Mais
  `GET /team/photos` (`:1345`) cache un `null` brièvement et retente ; côté About/Team un
  fetch 42 raté peut laisser un trou transitoire.
- **Ce qui manque / problème** : edge case d'affichage (trou photo) déjà commenté dans le
  code (TTL négatif), mais pas de placeholder cohérent partout.
- **Fichiers concernés** : `apps/backend/src/index.ts:1345`-`:1375`, `AboutPage.tsx`.
- **Piste d'implémentation** : uniformiser le fallback via `Avatar` (initiale) côté About.
- **Effort** S · **Priorité** basse.

---

## 7. Grades & rangs

### 7.1 Grand Master positionnel non expliqué / non notifié
- **État actuel** : le grade `grandmaster` est **positionnel** (top N + ≥ Diamant), calculé
  via `rankTierForRank(elo, rank)` (cf. `useAvatarRing.tsx:29`, saison `:1789`).
- **Ce qui manque / problème** : aucune notif quand on **devient** GM ou qu'on **perd** le
  statut (un autre joueur passe devant). Le caractère « glissant » du GM n'est pas expliqué
  dans l'UI (`GradesPage.tsx`).
- **Fichiers concernés** : `packages/shared/src/rank.ts`,
  `apps/web/src/pages/GradesPage.tsx`, `apps/backend/src/index.ts`.
- **Piste d'implémentation** : détecter les transitions GM au settlement et notifier ;
  encart explicatif dans `GradesPage`.
- **Effort** M · **Priorité** basse.

### 7.2 Pas de notification de montée/descente de grade
- **État actuel** : seul l'entrée dans le **top 3** notifie les abonnés (`maybeNotifyTop3`,
  `:507`). Aucune notif au joueur lui-même quand il **change de palier** (Bronze→Argent…).
- **Ce qui manque / problème** : moment de gratification manqué (les jeux compétitifs
  célèbrent les promotions de grade).
- **Fichiers concernés** : `apps/backend/src/index.ts` (settlement match), `rank.ts`.
- **Piste d'implémentation** : comparer le tier avant/après delta, notifier le joueur
  (`type: 'rank_up'/'rank_down'`).
- **Effort** M · **Priorité** moyenne.

### 7.3 Grade figé par mode, pas de « grade principal » lisible
- **État actuel** : chaque discipline a son grade ; aucune notion de grade « principal »
  consolidé.
- **Ce qui manque / problème** : sur une carte joueur multi-jeux, on ne sait pas quel grade
  est « le sien ». L'anneau prend le mode courant (cf. 6.2), ce qui peut surprendre.
- **Fichiers concernés** : `apps/web/src/hooks/useAvatarRing.tsx`, profil.
- **Piste d'implémentation** : exposer le grade du `games[0]` (mode principal) comme défaut.
- **Effort** S · **Priorité** basse.

---

## 8. Équipes 2v2 babyfoot

### 8.1 Duos créés silencieusement, pas d'invitation / consentement
- **État actuel** : un `BabyfootTeam` est créé « silencieusement » à la validation du
  **premier match 2v2** (`schema.prisma:543`-`:551`). Pas d'invitation, pas d'acceptation.
- **Ce qui manque / problème** : on ne « choisit » pas son duo ; il naît d'un match. Pas de
  notion d'équipe formée à l'avance, pas de demande/refus, pas de notif « tu fais désormais
  équipe avec X ».
- **Fichiers concernés** : `apps/backend/src/index.ts` (settlement 2v2,
  `settle2v2PendingAsPlayed`), `prisma/schema.prisma:552`.
- **Piste d'implémentation** : créer la `NewTeamCelebration` (composant déjà présent) avec
  notif aux deux joueurs ; optionnel : flux d'invitation explicite de duo.
- **Effort** M · **Priorité** basse.

### 8.2 Renommage du duo sans contrôle d'accès clair / modération
- **État actuel** : `BabyfootTeam.name` est un surnom libre défini par les joueurs
  (`schema.prisma:557`, `TeamNameModal.tsx`).
- **Ce qui manque / problème** : pas de filtrage des noms (insultes), pas de limite de
  fréquence de renommage, contrôle d'accès (les deux membres ? un seul ?) à vérifier.
- **Fichiers concernés** : `apps/backend/src/index.ts` (route rename team),
  `apps/web/src/components/TeamNameModal.tsx`.
- **Piste d'implémentation** : valider longueur/charset, throttle, journaliser ;
  permettre la modération (reset par admin).
- **Effort** S · **Priorité** basse.

### 8.3 `/teams/leaderboard` non scopé par saison ni filtré hors-jeu
- **État actuel** : `/teams/leaderboard` (`:1492`) agrège **tous** les matchs 2v2
  `countedForElo` d'un duo, **toutes saisons confondues**, sans filtrer les duos dont un
  membre est banni/anonymisé (pas de `where` `VISIBLE_USER_WHERE`).
- **Ce qui manque / problème** :
  - Le classement d'équipe n'a **pas de notion de saison** (contrairement au 1v1) → pas de
    reset, pas de `SeasonStanding` d'équipe (cf. 9.3).
  - Un duo avec un membre banni reste classé.
- **Fichiers concernés** : `apps/backend/src/index.ts:1492`-`:1523`,
  `apps/web/src/pages/leaderboard/TeamLeaderboard.tsx`.
- **Piste d'implémentation** : filtrer les membres visibles ; introduire un scope saison
  (au moins exclure les matchs hors saison active).
- **Effort** M · **Priorité** moyenne.

### 8.4 Pas de palmarès / badges / grade d'équipe
- **État actuel** : un duo a un ELO et un nom, mais pas de badge, pas d'anneau de grade,
  pas de palmarès saisonnier.
- **Ce qui manque / problème** : asymétrie forte avec le 1v1 (badges, grades, palmarès).
- **Fichiers concernés** : `apps/web/src/pages/team/TeamProfile*.tsx`,
  `prisma/schema.prisma:552`.
- **Piste d'implémentation** : appliquer `rankTierForRank` à l'ELO de duo ; badges d'équipe
  (cf. 1.2) ; standings d'équipe (cf. 9.3).
- **Effort** M · **Priorité** basse.

### 8.5 Pas de stats H2H entre équipes, ni d'historique dédié
- **État actuel** : le H2H 1v1 existe ; aucun équivalent duo-vs-duo.
- **Ce qui manque / problème** : impossible de comparer deux duos ni de voir leurs
  confrontations.
- **Fichiers concernés** : `apps/web/src/pages/H2HPage.tsx`, `team/TeamProfile*.tsx`.
- **Piste d'implémentation** : variante H2H d'équipe via `teamAId`/`teamBId`
  (`PlayedMatch:451`).
- **Effort** M · **Priorité** basse.

### 8.6 Pas de dissolution / archivage de duo
- **État actuel** : un `BabyfootTeam` est permanent (clé canonique triée). Pas de moyen de
  « quitter » un duo ni de l'archiver.
- **Ce qui manque / problème** : deux joueurs ne jouant plus ensemble traînent un duo
  « zombie » dans le classement.
- **Fichiers concernés** : `prisma/schema.prisma:552`, `team/TeamProfile*.tsx`.
- **Piste d'implémentation** : champ `archivedAt` (masqué du leaderboard mais historique
  conservé), réactivé au prochain match commun.
- **Effort** M · **Priorité** basse.

---

## 9. Saisons & palmarès

### 9.1 Aucun calendrier automatique (clôture 100 % manuelle)
- **État actuel** : `POST /seasons` (`:1737`) clôt l'active + en démarre une, **manuellement**,
  SUPERADMIN only. Aucune date de fin programmée, aucun cron.
- **Ce qui manque / problème** : pas de saison à durée fixe (ex. mensuelle), pas de
  compte-à-rebours affiché, pas de clôture auto.
- **Fichiers concernés** : `apps/backend/src/index.ts:1737`, `prisma/schema.prisma:572`
  (`Season` n'a pas de `plannedEndAt`).
- **Piste d'implémentation** : `plannedEndAt` + sweeper de clôture (modèle des sweepers
  OPS/anonymisation) + bandeau « fin dans Xj » côté leaderboard.
- **Effort** M · **Priorité** moyenne.

### 9.2 `palmaresFor` ne retourne que le babyfoot
- **État actuel** : `palmaresFor` (`:546`) filtre **explicitement** `game: 'babyfoot'`
  (`:551`) « pour éviter les doublons multi-jeux ».
- **Ce qui manque / problème** : un joueur champion/bien classé en Smash/Chess/SF/fléchettes
  n'a **aucun** palmarès affiché pour ces disciplines. Les `SeasonStanding` des autres jeux
  sont figés mais jamais montrés sur le profil.
- **Fichiers concernés** : `apps/backend/src/index.ts:546`-`:570`, `Palmares.tsx`.
- **Piste d'implémentation** : grouper par `(seasonId, game)` et afficher des onglets/lignes
  par discipline.
- **Effort** M · **Priorité** moyenne.

### 9.3 Standings d'équipe non figés en fin de saison
- **État actuel** : la clôture fige `SeasonStanding` par discipline pour le **1v1** (`:1791`).
  Aucun snapshot des **classements d'équipe 2v2**.
- **Ce qui manque / problème** : pas de palmarès de duo, pas de champion 2v2 de saison.
- **Fichiers concernés** : `apps/backend/src/index.ts:1744`-`:1855`,
  `prisma/schema.prisma:583` (`SeasonStanding` n'a pas de variante équipe).
- **Piste d'implémentation** : table `SeasonTeamStanding` figée à la clôture + reset ELO duo.
- **Effort** L · **Priorité** basse.

### 9.4 GOAT all-time : pas de modèle dédié, recalculé à la volée
- **État actuel** : la page GOAT (`GoatPage.tsx`) calcule le score **côté client** à partir
  de `GOAT_WEIGHTS` et des matchs (`goat.ts`), filtrable par saison (`:60`). Pas de table
  ni d'agrégat serveur.
- **Ce qui manque / problème** : recalcul intégral à chaque visite (coût client), pas de
  GOAT figé par saison, pas de « GOAT all-time » persistant, sensible à la troncature des
  matchs renvoyés.
- **Fichiers concernés** : `apps/web/src/pages/GoatPage.tsx`, `apps/web/src/lib/goat.ts`.
- **Piste d'implémentation** : endpoint `/goat?seasonId=` calculant serveur (sur tout
  l'historique) ; option de snapshot à la clôture.
- **Effort** M · **Priorité** basse.

### 9.5 `/seasons/:id/activate` casse l'invariant « une seule clôturée »
- **État actuel** : `/seasons/:id/activate` (`:1875`) repositionne `isActive=true` ET
  `endedAt=null` sur une saison passée, désactivant les autres — **sans reset ni snapshot**.
- **Ce qui manque / problème** : effacer `endedAt` d'une saison archivée la fait passer pour
  « en cours », ce qui peut **corrompre** la logique de palmarès/figeage (une saison figée
  redevient « live »). Outil de bascule de vue puissant et risqué, peu balisé.
- **Fichiers concernés** : `apps/backend/src/index.ts:1875`-`:1888`.
- **Piste d'implémentation** : séparer « saison de vue courante » (UI) de « saison active de
  scoring » (jeu) ; ne pas écraser `endedAt` ; confirmation explicite.
- **Effort** M · **Priorité** moyenne.

### 9.6 Pas d'annonce / récap de fin de saison
- **État actuel** : la clôture notifie seulement le champion babyfoot (`:1857`, cf. 1.6).
  Aucune annonce générale, aucun récap (« la saison X est finie, voici le podium »).
- **Ce qui manque / problème** : moment fort non célébré ; les non-champions ne savent même
  pas que la saison a changé (hors refresh leaderboard).
- **Fichiers concernés** : `apps/backend/src/index.ts:1856`-`:1868`.
- **Piste d'implémentation** : notif broadcast + page/modale récap saison (podium par jeu,
  GOAT, badges distribués).
- **Effort** M · **Priorité** moyenne.

---

## 10. Leaderboard & ses scopes

### 10.1 Recherche / filtre absent du leaderboard
- **État actuel** : `LeaderboardDesktop`/`Mobile` affichent la liste triée ; pas de champ
  de recherche pour sauter à un joueur, pas de filtre par grade/campus.
- **Ce qui manque / problème** : sur une grande league, retrouver un joueur précis exige de
  scroller.
- **Fichiers concernés** : `apps/web/src/pages/leaderboard/LeaderboardDesktop.tsx`,
  `LeaderboardMobile.tsx`.
- **Piste d'implémentation** : champ de filtre client (login/nom) + scroll-to + surlignage.
- **Effort** S · **Priorité** moyenne.

### 10.2 Nuage de points & scatter : a11y et perf
- **État actuel** : `LeaderboardScatter.tsx` rend un nuage ELO. Probable absence de
  description textuelle alternative et de fallback non-visuel.
- **Ce qui manque / problème** : graphique inaccessible aux lecteurs d'écran ; perf à
  surveiller sur grande population (pas de virtualisation/canvas vérifiée).
- **Fichiers concernés** : `apps/web/src/pages/leaderboard/LeaderboardScatter.tsx`.
- **Piste d'implémentation** : `aria-label`/résumé textuel, throttle au resize, canvas si
  N élevé.
- **Effort** M · **Priorité** basse.

### 10.3 H2H calculé 100 % client, babyfoot only, pas de lien profil
- **État actuel** : `H2HPage` filtre `matches` du contexte sur `countedForElo` (`:53`-`:60`)
  — donc **babyfoot uniquement** (les autres jeux passent par `PlayedFfa`/colonnes propres),
  et sur la **liste tronquée** `MAX_PUBLIC_LIST` renvoyée par `/matches`.
- **Ce qui manque / problème** :
  - Pas de H2H pour Smash/Chess/SF/fléchettes/2v2.
  - Confrontations anciennes (> plafond) ignorées → bilan H2H **incomplet** pour des
    rivaux de longue date.
  - Pas d'accès direct au H2H depuis deux profils (il faut bricoler l'URL `?a=&b=`).
- **Fichiers concernés** : `apps/web/src/pages/H2HPage.tsx`, `apps/backend/src/index.ts`
  (`/matches` `:2158`), `PlayerPage.tsx`.
- **Piste d'implémentation** : endpoint `/h2h?a=&b=&game=` calculant serveur sur tout
  l'historique (incluant FFA/fléchettes/2v2) ; bouton « comparer » sur les profils.
- **Effort** M · **Priorité** moyenne.

### 10.4 Pas de pagination / virtualisation du classement
- **État actuel** : `/leaderboard` (`:1475`) renvoie jusqu'à `MAX_PUBLIC_LIST` joueurs ; le
  front rend tout.
- **Ce qui manque / problème** : passé quelques centaines de joueurs, coût DOM. Pas de
  « charger la suite », pas de virtualisation.
- **Fichiers concernés** : `apps/backend/src/index.ts:1475`,
  `apps/web/src/pages/leaderboard/*`.
- **Piste d'implémentation** : virtualiser la liste (react-window) ou paginer.
- **Effort** M · **Priorité** basse.

---

## 11. Recherche de joueurs

### 11.1 Recherche locale seulement, sur la liste plafonnée
- **État actuel** : `PlayerSearch` (`apps/web/src/pages/defis/shared/PlayerSearch.tsx`) filtre
  **côté client** la liste `users`/`leaderboard` du contexte (elle-même plafonnée à
  `MAX_PUBLIC_LIST`).
- **Ce qui manque / problème** : un joueur au-delà du plafond (ou inconnu du contexte
  courant) est **introuvable** ; la recherche ne couvre pas toute la base.
- **Fichiers concernés** : `apps/web/src/pages/defis/shared/PlayerSearch.tsx`,
  `apps/backend/src/index.ts:1321` (`/users`).
- **Piste d'implémentation** : endpoint `/search?q=` serveur (cf. 11.3).
- **Effort** M · **Priorité** moyenne.

### 11.2 Pas de recherche par prénom/nom, ni tolérance de casse/accents
- **État actuel** : la recherche porte essentiellement sur le `login`.
- **Ce qui manque / problème** : impossible de chercher « Thomas » si on ne connaît que le
  nom ; pas de normalisation accents/casse.
- **Fichiers concernés** : `PlayerSearch.tsx`, backend `/search`.
- **Piste d'implémentation** : indexer login + firstName + lastName, normaliser
  (lowercase, sans accents), `ILIKE`/trigram côté Postgres.
- **Effort** M · **Priorité** moyenne.

### 11.3 Pas d'endpoint `/search` serveur
- **État actuel** : aucune route de recherche dédiée (les écrans bricolent depuis `/users`).
- **Ce qui manque / problème** : pas de recherche performante/scalable, pas de réutilisation
  serveur (autocomplétion défi/tournoi/follow toutes locales).
- **Fichiers concernés** : `apps/backend/src/index.ts`.
- **Piste d'implémentation** : `GET /search/players?q=&limit=` filtrant `VISIBLE_USER_WHERE`,
  tri par pertinence (préfixe > sous-chaîne) puis ELO.
- **Effort** M · **Priorité** moyenne.

---

## 12. Cosmétiques équipés (titres / bannières / badges achetés)
- **État actuel** : `equippedCosmetics` (`:979`) renvoie `titleColor`, `equippedBadge`,
  `equippedBanner` (au plus un par catégorie). Exposés sur `/me` et `/users/:login`.
- **Ce qui manque / problème** :
  - Le badge **acheté** (boutique, def inline) et le badge **de palmarès** (`UserBadge`)
    sont deux systèmes parallèles (cf. 1.1) ; un seul badge boutique équipable à la fois.
  - Pas de prévisualisation de la bannière sur le profil d'un autre joueur dans toutes les
    vues (à vérifier mobile vs desktop).
  - Pas de déséquipement automatique au refund/désactivation d'un `ShopItem` (à confirmer).
  - Anonymisation : cosmétiques équipés non nettoyés (cf. 5.1).
- **Fichiers concernés** : `apps/backend/src/index.ts:979`-`:1000`, `:1442`-`:1457`,
  `apps/web/src/components/TitlePicker.tsx`, `BannerPicker.tsx`, `Badges.tsx`.
- **Piste d'implémentation** : unifier le rendu badge (catalogue partagé), garantir le
  déséquipement à la perte d'un item, couvrir l'affichage bannière partout.
- **Effort** M · **Priorité** basse.

---

## 13. Statut intra 42 (pastille dispo)
- **État actuel** : `IntraStatusPill` (`apps/web/src/components/IntraStatusPill.tsx`) affiche
  disponible/indisponible + hôte, alimenté par `/locations` 42 rafraîchi **toutes les 5 min**
  par `useLeagueData`.
- **Ce qui manque / problème** :
  - Latence jusqu'à 5 min : le statut peut être périmé (joueur déjà parti / arrivé).
  - Pas de filtre « joueurs en ligne » sur le leaderboard / la recherche (« qui peut jouer
    maintenant ? ») alors que la donnée existe.
  - Pas d'historique de présence, pas de notif « X vient de se connecter au cluster ».
  - Dépendance dure à l'API 42 `/locations` : pas de dégradation gracieuse documentée si
    indispo (la pastille tombe sur « indisponible » silencieusement → faux négatifs).
  - i18n : libellés via `t('profil.intraStatus'/'available'/'unavailableStatus')` — vérifier
    la présence des clés dans toutes les locales.
  - a11y : pastille colorée sans `aria-label`/`role="status"` explicite (couleur seule
    porte l'info en/hors ligne).
- **Fichiers concernés** : `apps/web/src/components/IntraStatusPill.tsx`,
  `apps/web/src/hooks/useLeagueData.tsx`, `OnlineBadge.tsx`.
- **Piste d'implémentation** : exposer le statut online dans les listes (icône), filtre
  « en ligne », `role="status"` + label, intervalle adaptatif.
- **Effort** M · **Priorité** basse.

---

## 14. Observabilité, audit & métriques
- **État actuel** : `AdminAuditLog` couvre les actions admin ; `AnalyticsEvent` journalise
  pageviews/événements. Mais le domaine social a peu de couverture.
- **Ce qui manque / problème** :
  - Aucune `AdminAction` pour les badges (cf. 1.3), ni pour le renommage forcé de duo.
  - Pas de métrique sur les follows (taux de réciprocité, top suivis), ni sur l'usage du
    H2H / GOAT.
  - `notifyFollowers` avale silencieusement les erreurs (`catch {}`, `:501`) → échecs de
    notif invisibles.
- **Fichiers concernés** : `apps/backend/src/index.ts:494`-`:504`, `prisma/schema.prisma:598`.
- **Piste d'implémentation** : logger les échecs `notifyFollowers`, ajouter actions d'audit
  ciblées, compteurs analytics social.
- **Effort** M · **Priorité** basse.

---

## 15. Tests manquants
- **État actuel** : la logique pure (ELO, rank, GOAT, titles) est testée dans
  `packages/shared`. Le domaine social côté backend/front l'est peu.
- **Ce qui manque / problème** (liste non exhaustive) :
  - `badgesFor` : dérivation `founder`/`admin`, dédoublonnage, multi-discipline (cf. 1.7).
  - `notifyFollowers` : respect des prefs, `notifyTrophy` (une fois branché, cf. 1.4).
  - `palmaresFor` : tri, multi-jeux (cf. 9.2).
  - `anonymizeAccount` : **nullification firstName/lastName**, purge follows/badges
    (cf. 5.1) — test de non-régression RGPD **prioritaire**.
  - Clôture de saison : snapshot par discipline, badge champion multi-jeux, reset ELO/GM
    (`:1744`-`:1855`).
  - `/users/:login` : W/L carrière vs 50 derniers (cf. 4.3), rang par mode (cf. 4.2).
  - `/teams/leaderboard` : exclusion des membres hors-jeu (cf. 8.3).
  - H2H : symétrie A/B, comptage nuls, deltas (`H2HPage` logique).
- **Fichiers concernés** : `apps/backend/test/*` (ou itests), `packages/shared/src/*.test.ts`.
- **Piste d'implémentation** : tests d'intégration backend (les itests utilisent
  `prisma db push`, cf. mémoire), + tests unitaires des helpers extraits.
- **Effort** L · **Priorité** moyenne (haute pour le test RGPD d'anonymisation).

---

## 16. i18n manquant / en dur
- **État actuel** : i18n via `useT`/`i18n.tsx`. Plusieurs textes du domaine social restent
  **en dur en français**.
- **Ce qui manque / problème** :
  - `FollowLists.tsx` : libellés « Following »/« Followers », états vides
    (« Tu ne suis personne… », « Personne ne te suit encore. ») et « Chargement… »
    (`:51`-`:68`) **non internationalisés**.
  - `Badges.tsx` : « Badges · N », `aria-label="Fermer"` (`:223`, `:228`) en dur.
  - `badges.ts` : labels/descriptions de badges en dur (pas de clés i18n).
  - Notifs serveur : titres/bodies en dur français (`:519`, `:1858`-`:1861`, etc.) — pas de
    localisation par destinataire.
- **Fichiers concernés** : `apps/web/src/components/FollowLists.tsx`, `Badges.tsx`,
  `apps/web/src/lib/badges.ts`, `apps/backend/src/index.ts` (textes de `notify`).
- **Piste d'implémentation** : passer ces chaînes par les locales ; pour le backend,
  émettre des clés + params plutôt que des phrases.
- **Effort** M · **Priorité** basse.

---

## 17. Accessibilité (a11y)
- **État actuel** : composants riches en animation (badges sheen, anneau gemme, pastille
  ping). Couverture a11y partielle.
- **Ce qui manque / problème** :
  - `Avatar` : `alt`=login technique, placeholder sans label (cf. 6.3).
  - `IntraStatusPill` : info portée par la couleur seule, pas de `role="status"` (cf. 13).
  - `Badges` : pastilles `motion.button` (focus/clavier OK), mais animation continue sans
    respect de `prefers-reduced-motion` (sheen + ping permanents).
  - Scatter ELO non décrit (cf. 10.2).
  - Modale badges : `role="dialog"`/`aria-modal` présents (bien), mais piège-focus à vérifier.
- **Fichiers concernés** : `Avatar.tsx`, `IntraStatusPill.tsx`, `Badges.tsx`,
  `LeaderboardScatter.tsx`.
- **Piste d'implémentation** : `prefers-reduced-motion` pour couper sheen/ping, labels
  ARIA, descriptions alternatives.
- **Effort** M · **Priorité** basse.

---

## 18. Divergences desktop / mobile
- **État actuel** : profil, leaderboard et équipe ont des variantes dédiées
  (`ProfilDesktop`/`ProfilMobile`, `LeaderboardDesktop`/`Mobile`,
  `TeamProfileDesktop`/`Mobile`, `MyTeamsDesktop` vs `mobile/MyTeamsSection`).
- **Ce qui manque / problème** :
  - Risque de **dérive fonctionnelle** : une section ajoutée à une variante et oubliée à
    l'autre (ex. bannière équipée, encart rivalité, palmarès multi-jeux). À auditer
    section par section.
  - Logique partiellement dupliquée (`useProfilLogic` partagé, mais rendu divergent).
  - `FollowLists` est partagé (bien) mais d'autres blocs sociaux ne le sont pas.
- **Fichiers concernés** : `apps/web/src/pages/profil/ProfilDesktop.tsx`,
  `ProfilMobile.tsx`, `profil/shared/*`, `profil/mobile/*`,
  `apps/web/src/pages/leaderboard/*`, `apps/web/src/pages/team/*`.
- **Piste d'implémentation** : extraire les blocs sociaux en composants partagés (façon
  `FollowLists`/`IntraStatusPill`), réserver aux variantes la seule mise en page.
- **Effort** M · **Priorité** moyenne.

---

## 19. Dette technique & cohérence du modèle
- **État actuel** : modèle riche mais quelques asymétries.
- **Ce qui manque / problème** :
  - `badgesFor` renvoie `string[]` et perd `game`/`seasonId` (cf. 1.7) → impossible de
    distinguer/dater les badges côté front.
  - `founder` dérivé à la volée vs `season_champion` stocké : deux régimes de badge.
  - `SeasonStanding` a un `game` mais `palmaresFor` le fige à babyfoot (cf. 9.2) — donnée
    produite et jamais lue.
  - `Notification.type` est un `String` libre (`schema.prisma:159`) sans enum partagé : les
    types `follow_top3`, `new_player`, `badge`, etc. ne sont pas centralisés → risque de
    typo silencieuse (front filtre/colore selon ce string).
  - `BabyfootTeam` n'a pas de saison ni d'archivage (cf. 8.3/8.6).
  - `/users/:login` fait plusieurs requêtes séquentielles (badges, palmares, cosmetics) hors
    du `Promise.all` initial (`:1433`, `:1441`-`:1442`) → latences cumulées sur une page très
    visitée.
  - `notifyFollowers`/`maybeNotifyTop3` avalent toutes les erreurs (`catch {}`) → dette
    d'observabilité (cf. 14).
- **Fichiers concernés** : `apps/backend/src/index.ts` (`:532`, `:546`, `:1433`-`:1442`,
  `:494`-`:528`), `prisma/schema.prisma` (`Notification`, `BabyfootTeam`, `UserBadge`,
  `SeasonStanding`).
- **Piste d'implémentation** : enum partagé des `Notification.type` ; enrichir `badgesFor` ;
  paralléliser les requêtes de `/users/:login` ; harmoniser le régime des badges.
- **Effort** M · **Priorité** moyenne.
