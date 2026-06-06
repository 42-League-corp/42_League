# Manques — Notifications & Temps réel

> Document d'audit des **manques, incomplétudes et améliorations** du domaine
> **Notifications in-app & Temps réel (SSE)** de 42 League. Ce document décrit
> **ce qui manque ou pose problème**, pas l'existant. L'existant de référence se
> trouve dans `DOC/REALTIME.md` (catalogue d'événements SSE, debounce, timers ops)
> et `DOC/API.md` (`GET /events`, `/notifications`, `/auth/stream-token`).
>
> Périmètre couvert : modèle `Notification` (types, `refId`, `read`, auto-lecture
> par `refId`), helpers `notify` / `notifyMany` / `notifyMatchResult` /
> `notifyFollowers` / `markNotifsReadByRef`, cloche front (`NotificationBell` :
> onglets À traiter / Inbox, polling 30 s, icônes & couleurs par type, badge
> non-lus), couche SSE (`apps/backend/src/sse.ts` : `emit` ciblé vs `broadcast`,
> plafond 5 flux/login, token de stream éphémère scope `sse`), catalogue
> d'événements (`match:*`, `challenge:*`, `ffa:*`, `darts:*`, `ops:update`,
> `tournament:*`, `leaderboard:update`, `data:update`, `panel:update`,
> `notification`), consommation front (`useServerEvents`, `useLeagueData`,
> debounce 250/300 ms), timers OPS (volatils au redémarrage), **absence** de push
> notifications (Web Push / PWA), préférences de notification, accessibilité,
> tests, i18n.
>
> Fichiers de référence principaux :
> - `apps/backend/src/sse.ts` (registre `Map<login, Set<stream>>`, `emit`,
>   `broadcast`, `registerSse`, plafond `MAX_SSE_PER_LOGIN = 5`)
> - `apps/backend/src/index.ts` :
>   - helpers notif ~370-528 (`notify`, `notifyMany`, `markNotifsReadByRef`,
>     `notifyMatchResult`, `announceNewPlayer`, `notifyFollowers`, `maybeNotifyTop3`)
>   - endpoint SSE `/events` ~1290-1317, `/auth/stream-token` ~1281-1288
>   - endpoints notif `/notifications` ~1526-1537, `/notifications/read` ~1540-1551
>   - middleware `broadcastOnMutation` ~868-888
>   - timers OPS `scheduleOpsTimers` / `rescheduleOpsTimers` ~5576-5602
>   - purges quotidiennes `purgeStalePendingMatches` ~8223, `purgeOldAuditLogs` ~8210
> - `apps/backend/prisma/schema.prisma` (`model Notification` ~156-180, prefs
>   `Follow.notify*` ~124-127)
> - `apps/web/src/components/NotificationBell.tsx` (cloche, 289 lignes)
> - `apps/web/src/hooks/useServerEvents.ts` (consommateur SSE local + reconnexion)
> - `apps/web/src/hooks/useLeagueData.tsx` (consommateur global, `EVENT_DOMAINS`)
> - `apps/web/src/lib/api.ts` (`AppNotification` ~733-743, `notifications()`,
>   `markNotificationsRead()` ~921-925, `streamToken()`)

---

## Table des matières

1. [Push & hors-onglet (Web Push / PWA)](#1-push--hors-onglet-web-push--pwa)
   - 1.1 [Aucune notification hors de l'onglet ouvert](#11-aucune-notification-hors-de-longlet-ouvert)
   - 1.2 [Pas de Service Worker ni de PWA installable](#12-pas-de-service-worker-ni-de-pwa-installable)
   - 1.3 [Pas de notifications natives du navigateur (Notifications API)](#13-pas-de-notifications-natives-du-navigateur-notifications-api)
   - 1.4 [Pas d'e-mail / digest de secours](#14-pas-de-mail--digest-de-secours)
2. [Préférences de notification](#2-préférences-de-notification)
   - 2.1 [Aucune préférence fine par type pour MES propres notifs](#21-aucune-préférence-fine-par-type-pour-mes-propres-notifs)
   - 2.2 [Préférences followers limitées à 4 booléens, non extensibles](#22-préférences-followers-limitées-à-4-booléens-non-extensibles)
   - 2.3 [Pas de mode « ne pas déranger » / mute par discipline](#23-pas-de-mode-ne-pas-déranger--mute-par-discipline)
   - 2.4 [Annonce « nouveau joueur » diffusée à TOUS, non désactivable](#24-annonce-nouveau-joueur-diffusée-à-tous-non-désactivable)
3. [Couverture des types de notification](#3-couverture-des-types-de-notification)
   - 3.1 [Aucune notif pour les gains/pertes de coins](#31-aucune-notif-pour-les-gainspertes-de-coins)
   - 3.2 [Aucune notif pour les quêtes hebdomadaires](#32-aucune-notif-pour-les-quêtes-hebdomadaires)
   - 3.3 [Aucune notif de fin de saison aux non-champions](#33-aucune-notif-de-fin-de-saison-aux-non-champions)
   - 3.4 [Badges débloqués non notifiés (hors champion de saison)](#34-badges-débloqués-non-notifiés-hors-champion-de-saison)
   - 3.5 [Types backend sans icône/couleur front (désynchronisation)](#35-types-backend-sans-icônecouleur-front-désynchronisation)
   - 3.6 [Pas de notif d'expiration imminente d'un match en attente](#36-pas-de-notif-dexpiration-imminente-dun-match-en-attente)
4. [Fiabilité & cohérence (events perdus)](#4-fiabilité--cohérence-events-perdus)
   - 4.1 [Aucune garantie de livraison : un SSE manqué hors-ligne est perdu](#41-aucune-garantie-de-livraison--un-sse-manqué-hors-ligne-est-perdu)
   - 4.2 [Pas de `Last-Event-ID` ni de replay au reconnect](#42-pas-de-last-event-id-ni-de-replay-au-reconnect)
   - 4.3 [Le plafond 5 flux/login peut tuer un onglet actif silencieusement](#43-le-plafond-5-fluxlogin-peut-tuer-un-onglet-actif-silencieusement)
   - 4.4 [Création de notif best-effort : échec base = notif perdue sans trace](#44-création-de-notif-best-effort--échec-base--notif-perdue-sans-trace)
5. [Timers volatils au redémarrage](#5-timers-volatils-au-redémarrage)
   - 5.1 [Timers OPS = `setTimeout` en mémoire, ré-armés mais fragiles](#51-timers-ops--settimeout-en-mémoire-ré-armés-mais-fragiles)
   - 5.2 [Expiration des matchs en attente : purge quotidienne seulement](#52-expiration-des-matchs-en-attente--purge-quotidienne-seulement)
   - 5.3 [Aucune notification à l'expiration d'une invitation de tournoi](#53-aucune-notification-à-lexpiration-dune-invitation-de-tournoi)
6. [Scalabilité SSE (un seul process)](#6-scalabilité-sse-un-seul-process)
   - 6.1 [Registre en mémoire : impossible de scaler horizontalement](#61-registre-en-mémoire--impossible-de-scaler-horizontalement)
   - 6.2 [`broadcast` itère sur toutes les connexions à chaque mutation](#62-broadcast-itère-sur-toutes-les-connexions-à-chaque-mutation)
   - 6.3 [Pas de métriques / observabilité sur le canal SSE](#63-pas-de-métriques--observabilité-sur-le-canal-sse)
   - 6.4 [Polling 30 s de la cloche en plus du SSE (double charge)](#64-polling-30-s-de-la-cloche-en-plus-du-sse-double-charge)
7. [Historique & gestion de la cloche](#7-historique--gestion-de-la-cloche)
   - 7.1 [Historique borné à 40 notifs, sans pagination](#71-historique-borné-à-40-notifs-sans-pagination)
   - 7.2 [Pas de purge / TTL des vieilles notifications](#72-pas-de-purge--ttl-des-vieilles-notifications)
   - 7.3 [« Tout marquer lu » uniquement dans la cloche, pas de page dédiée](#73-tout-marquer-lu-uniquement-dans-la-cloche-pas-de-page-dédiée)
   - 7.4 [Impossible de supprimer / archiver une notification](#74-impossible-de-supprimer--archiver-une-notification)
   - 7.5 [Pas de déduplication / regroupement des notifs répétées](#75-pas-de-déduplication--regroupement-des-notifs-répétées)
8. [Accessibilité](#8-accessibilité)
   - 8.1 [Aucune annonce ARIA live des nouvelles notifications](#81-aucune-annonce-aria-live-des-nouvelles-notifications)
   - 8.2 [Couleur seule porte le sens (discipline/type)](#82-couleur-seule-porte-le-sens-disciplinetype)
   - 8.3 [Pas de son / vibration optionnels](#83-pas-de-son--vibration-optionnels)
9. [Tests](#9-tests)
   - 9.1 [`sse.test.ts` couvre `emit`/`broadcast` mais pas l'endpoint `/events`](#91-ssetest-couvre-emitbroadcast-mais-pas-lendpoint-events)
   - 9.2 [Aucun test du plafond 5 flux/login ni de l'éviction du plus ancien](#92-aucun-test-du-plafond-5-fluxlogin-ni-de-léviction-du-plus-ancien)
   - 9.3 [Aucun test des helpers `notify*` ni de l'auto-lecture par `refId`](#93-aucun-test-des-helpers-notify-ni-de-lauto-lecture-par-refid)
   - 9.4 [Aucun test front de `NotificationBell` / `useServerEvents`](#94-aucun-test-front-de-notificationbell--useserverevents)
10. [i18n](#10-i18n)
    - 10.1 [Titres & corps des notifs codés en dur en français côté backend](#101-titres--corps-des-notifs-codés-en-dur-en-français-côté-backend)
    - 10.2 [La cloche est i18n côté UI mais le contenu ne l'est pas](#102-la-cloche-est-i18n-côté-ui-mais-le-contenu-ne-lest-pas)

---

## 1. Push & hors-onglet (Web Push / PWA)

### 1.1 Aucune notification hors de l'onglet ouvert
- **État actuel** (`apps/backend/src/index.ts:390-411`, `apps/web/src/components/NotificationBell.tsx:121`)
  Le seul canal temps réel est SSE (`emit([to], { type: 'notification' })`),
  consommé par un `EventSource` vivant uniquement tant qu'un **onglet est ouvert**.
  À la fermeture de l'onglet (ou veille prolongée du mobile), plus aucun signal
  n'arrive ; on ne « retrouve » les notifs qu'au prochain chargement de la page.
- **Ce qui manque / problème**
  Un joueur défié, dont le score est en attente de validation, ou dont
  l'adversaire conteste, n'a **aucun moyen d'être prévenu** s'il n'a pas le site
  ouvert. Pour un produit dont le cœur est le « duel reçu » et le « score à
  valider », c'est le manque fonctionnel le plus structurant : la boucle de
  notification ne fonctionne que pour des utilisateurs déjà présents.
- **Fichiers concernés** `apps/backend/src/index.ts` (helpers `notify*`),
  `apps/web` (pas de Service Worker), `apps/backend/prisma/schema.prisma` (pas de
  table d'abonnement push).
- **Piste d'implémentation** Implémenter le **Web Push** (VAPID) : table
  `PushSubscription { login, endpoint, p256dh, auth, createdAt }`, endpoint
  `POST /push/subscribe` / `DELETE /push/unsubscribe`, et dans `notify`/`notifyMany`
  émettre **en plus** du SSE un push via une lib (`web-push`). Nécessite un
  Service Worker côté front (cf. 1.2) et un opt-in explicite (cf. 1.3).
- **Effort** L · **Priorité** Haute

### 1.2 Pas de Service Worker ni de PWA installable
- **État actuel** Aucun fichier `service-worker.*` / `manifest.webmanifest` /
  plugin PWA dans `apps/web` ; l'app est une SPA Vite classique.
- **Ce qui manque / problème** Sans Service Worker, ni Web Push ni notification
  en arrière-plan ne sont possibles (le push DOIT passer par un SW). Pas d'install
  « ajouter à l'écran d'accueil », pas de cache offline, pas de relance en
  arrière-plan. Le produit reste un onglet web volatil.
- **Fichiers concernés** `apps/web/vite.config.ts`, nouveau
  `apps/web/public/manifest.webmanifest`, nouveau Service Worker.
- **Piste d'implémentation** Ajouter `vite-plugin-pwa` (manifest + SW +
  `workbox`), enregistrer le SW au boot, gérer l'événement `push` → `showNotification`.
  Étape préalable indispensable à 1.1 et 1.3.
- **Effort** L · **Priorité** Moyenne

### 1.3 Pas de notifications natives du navigateur (Notifications API)
- **État actuel** Le badge rouge de la cloche est le **seul** indicateur visuel
  (`NotificationBell.tsx:157-161`). Aucun appel à `Notification.requestPermission()`
  ni à `new Notification(...)`.
- **Ce qui manque / problème** Même onglet **ouvert mais en arrière-plan** (autre
  onglet actif), l'utilisateur ne voit rien : pas de toast système, pas de mise à
  jour du titre d'onglet (`document.title = "(1) 42 League"`), pas de favicon
  badge. Un défi reçu pendant qu'on code dans un autre onglet passe inaperçu.
- **Fichiers concernés** `apps/web/src/components/NotificationBell.tsx`,
  `apps/web/src/hooks/useServerEvents.ts`.
- **Piste d'implémentation** Quick-win sans SW : sur réception d'un event
  `notification` alors que `document.visibilityState === 'hidden'`, mettre à jour
  `document.title` avec le compteur non-lu, et optionnellement
  `new Notification(title)` après opt-in. À combiner avec 1.1 pour le vrai hors-onglet.
- **Effort** S (titre d'onglet) à M (Notifications API + opt-in) · **Priorité** Moyenne

### 1.4 Pas d'e-mail / digest de secours
- **État actuel** Aucun envoi d'e-mail nulle part dans le backend ; pas de
  dépendance SMTP/transactionnel.
- **Ce qui manque / problème** Un utilisateur absent plusieurs jours ne reçoit
  **rien** (ni « tu as 3 défis en attente », ni « ton score expire dans 6 h »).
  Aucun canal de ré-engagement asynchrone.
- **Fichiers concernés** backend (nouveau module mailer), `schema.prisma` (prefs
  e-mail, `email` utilisateur si récupéré via 42).
- **Piste d'implémentation** Job cron quotidien qui agrège les notifs non-lues
  par utilisateur et envoie un digest (opt-in RGPD). Dépend de la disponibilité
  d'une adresse e-mail (API 42) et d'un consentement explicite.
- **Effort** L · **Priorité** Basse

---

## 2. Préférences de notification

### 2.1 Aucune préférence fine par type pour MES propres notifs
- **État actuel** (`apps/backend/prisma/schema.prisma:124-127`) Les seules
  préférences existantes (`notifyTournament`, `notifyTop3`, `notifyTrophy`,
  `notifyOps`) vivent sur le modèle **`Follow`** : elles règlent ce que JE reçois
  **au sujet des joueurs que je suis**, pas mes propres notifications d'activité.
- **Ce qui manque / problème** Impossible de désactiver une catégorie de notifs
  me concernant directement : `match_result`, `match_pending`, `challenge_received`,
  `new_player`, etc. arrivent toujours, sans réglage. Un joueur qui veut juste
  « les défis, pas les résultats » ne peut rien faier.
- **Fichiers concernés** `schema.prisma` (modèle `User` ou nouvelle table
  `NotificationPref`), `apps/backend/src/index.ts` (helpers `notify*` à filtrer),
  une page Réglages côté `apps/web`.
- **Piste d'implémentation** Table `NotificationPref { login, type, channel,
  enabled }` (ou JSON sur `User`), consultée dans `notify`/`notifyMany` avant
  insertion (ou au filtrage de lecture). Exposer une UI de réglages par catégorie.
- **Effort** M · **Priorité** Moyenne

### 2.2 Préférences followers limitées à 4 booléens, non extensibles
- **État actuel** (`schema.prisma:124-127`, `index.ts:492` `type FollowPref`)
  Exactement 4 colonnes booléennes en dur ; ajouter une 5e catégorie suivie =
  migration + modification du type `FollowPref` + des appels `notifyFollowers`.
- **Ce qui manque / problème** Modèle rigide : aucune granularité (ex. « top 3
  seulement pour le babyfoot »), pas de valeur « digest » vs « instantané », et
  toute nouvelle catégorie sociale impose une migration de schéma.
- **Fichiers concernés** `schema.prisma`, `index.ts:494-504` (`notifyFollowers`),
  `index.ts:1463-1466` & `2090-2093` (lecture/écriture des prefs).
- **Piste d'implémentation** Normaliser en table clé/valeur `FollowPref { followId,
  key, value }` ou en JSON typé, avec defaults appliqués à la lecture.
- **Effort** M · **Priorité** Basse

### 2.3 Pas de mode « ne pas déranger » / mute par discipline
- **État actuel** Aucun mécanisme de silence global ou par jeu. Toute notif est
  créée et signalée immédiatement.
- **Ce qui manque / problème** Un joueur multi-discipline ne peut pas dire « je ne
  joue qu'au babyfoot, ne me notifie pas le smash », ni couper les notifs sur une
  plage horaire. Le champ `game` existe déjà sur `Notification`
  (`schema.prisma:163`) et pourrait servir de clé de mute mais n'est exploité que
  pour la couleur/emoji.
- **Fichiers concernés** `schema.prisma` (`User.mutedGames` / DND window),
  `index.ts` (`notify*`), `NotificationBell.tsx`.
- **Piste d'implémentation** Réutiliser `Notification.game` : préférence
  `mutedGames: string[]` filtrée à la création. DND = fenêtre horaire vérifiée
  dans `notify`.
- **Effort** M · **Priorité** Basse

### 2.4 Annonce « nouveau joueur » diffusée à TOUS, non désactivable
- **État actuel** (`index.ts:474-489` `announceNewPlayer`) À chaque inscription,
  une notif `new_player` est insérée pour **tous** les utilisateurs visibles
  (`notifyMany` sur la league entière), sans préférence ni opt-out.
- **Ce qui manque / problème** Avec la croissance de la league, chaque inscription
  génère N notifs (N = taille de la league) — bruit pour tous, charge d'écriture
  en `O(N)`, et aucun moyen de couper. C'est aussi le plus gros générateur de
  volume notif après les matchs.
- **Fichiers concernés** `index.ts:474-489`, `schema.prisma`.
- **Piste d'implémentation** Soumettre à une préférence (cf. 2.1), ou remplacer
  par un fil d'activité tiré à la demande (pas de notif individuelle), ou regrouper
  (« 3 nouveaux joueurs cette semaine »).
- **Effort** S (opt-out) à M (refonte en feed) · **Priorité** Moyenne

---

## 3. Couverture des types de notification

### 3.1 Aucune notif pour les gains/pertes de coins
- **État actuel** (cf. `DOC/manques/03-economie.md` §1.4) Les gains de coins
  (per-match, quête, cash-prize, pari gagné) ne déclenchent qu'un `panel:update`
  ciblé pour rafraîchir le **solde** affiché (`index.ts:5147`, `5151`, `7834`,
  `8236`…). Aucune **notification** in-app (`notify`) n'est créée.
- **Ce qui manque / problème** Le joueur voit son solde bouger mais ne sait ni
  pourquoi ni de combien (« +12 coins : victoire babyfoot », « pari gagné : +40 »).
  Le feedback d'économie est muet — alors que l'infrastructure notif existe.
- **Fichiers concernés** `index.ts` (règlement paris ~4240-4370, gains per-match,
  quêtes), helpers `notify`.
- **Piste d'implémentation** Type `coins_earned` / `bet_won` / `bet_lost` avec
  `body` = montant + raison, `game` = discipline. Une icône `Coins` côté front
  (cf. 3.5).
- **Effort** S · **Priorité** Moyenne

### 3.2 Aucune notif pour les quêtes hebdomadaires
- **État actuel** Les quêtes (`WeeklyQuestProgress`) progressent et se complètent
  sans notification ; pas de type `quest_*` émis (`grep` ne trouve aucun
  `notify(... type: 'quest')`).
- **Ce qui manque / problème** Quête complétée → récompense créditée silencieusement.
  Aucune incitation, aucun rappel « 1 match pour compléter ta quête », aucun
  rappel de reset hebdo. Mécanique de rétention sous-exploitée.
- **Fichiers concernés** `index.ts` (logique quêtes), helpers `notify`,
  `NotificationBell.tsx` (icône).
- **Piste d'implémentation** Notif `quest_completed` à la complétion et
  éventuellement `quest_reminder` (cron) pour les quêtes presque finies avant le
  reset.
- **Effort** S/M · **Priorité** Basse

### 3.3 Aucune notif de fin de saison aux non-champions
- **État actuel** (`index.ts:1857-1865`) À la clôture d'une saison, **seul** le
  champion reçoit une notif `badge` (« 🏆 Champion de saison »). Les autres
  joueurs ne sont pas prévenus que la saison s'est terminée / qu'une nouvelle
  commence.
- **Ce qui manque / problème** Pour la masse des joueurs, la transition de saison
  est invisible (leur ELO/classement repart sans annonce). Pas de « la saison X
  est finie, tu finis #7 ». Faible sentiment de cycle.
- **Fichiers concernés** `index.ts:1851-1886`.
- **Piste d'implémentation** Après clôture, `notifyMany` aux joueurs ayant joué la
  saison avec leur rang final (type `season_ended`), en réutilisant le classement
  déjà calculé. Soumis à préférence (cf. 2.1).
- **Effort** S/M · **Priorité** Basse

### 3.4 Badges débloqués non notifiés (hors champion de saison)
- **État actuel** (`index.ts:532-539` `badgesFor`) Les badges sont dérivés à la
  lecture (founder, rôle) + stockés (`UserBadge`). Seul le badge « champion de
  saison » émet une notif. Les autres badges gagnés n'en émettent aucune.
- **Ce qui manque / problème** Débloquer un badge est un moment de gratification
  qui passe inaperçu. Le type `badge` existe et a une couleur front
  (`COLOR_BY_TYPE.badge`, `NotificationBell.tsx:43`) mais n'a **pas d'icône**
  dédiée (cf. 3.5) et n'est émis qu'une fois.
- **Fichiers concernés** `index.ts` (attribution des `UserBadge`), helpers `notify`.
- **Piste d'implémentation** Centraliser l'attribution de badge dans un helper
  `awardBadge(login, code)` qui crée la `UserBadge` ET émet une notif `badge`.
- **Effort** S/M · **Priorité** Basse

### 3.5 Types backend sans icône/couleur front (désynchronisation)
- **État actuel** (`NotificationBell.tsx:19-44`) `ICON_BY_TYPE` et `COLOR_BY_TYPE`
  sont des maps en dur. Le backend émet (entre autres) :
  `challenge_received`, `challenge_accepted`, `challenge_declined`, `matchmaking`,
  `match_pending`, `match_result`, `match_rejected`, `ffa_pending`, `ffa_result`,
  `ffa_contested`, `darts_pending`, `darts_result`, `darts_contested`,
  `tournament`, `tournament_invite`, `ops_targeted`, `new_player`, `badge`,
  `follow_top3`, `follow_tournament`, `follow_ops`.
- **Ce qui manque / problème** Plusieurs types n'ont **pas d'icône** dans
  `ICON_BY_TYPE` et retombent sur `Bell` par défaut (`NotificationBell.tsx:236`) :
  `darts_pending`, `darts_result`, `darts_contested`, `tournament_invite`,
  `badge`, `follow_top3`, `follow_tournament`, `follow_ops`. C'est un repli
  silencieux : la cloche affiche une cloche générique au lieu de l'icône
  signifiante, et rien n'empêche un nouveau type backend de ne jamais avoir
  d'icône. Aucune source de vérité partagée des types entre back et front.
- **Fichiers concernés** `apps/web/src/components/NotificationBell.tsx:19-44`,
  `apps/backend/src/index.ts` (sites d'émission), idéalement `packages/shared`.
- **Piste d'implémentation** Définir une **union de types de notif partagée** dans
  `packages/shared` (avec icône/couleur/jeu par défaut), importée des deux côtés ;
  ou au minimum compléter `ICON_BY_TYPE` pour tous les types émis. Un test de
  cohérence (snapshot de la liste des types) éviterait la dérive (cf. 9.3).
- **Effort** S (compléter la map) à M (type partagé) · **Priorité** Moyenne

### 3.6 Pas de notif d'expiration imminente d'un match en attente
- **État actuel** (`index.ts:8219-8242` `purgeStalePendingMatches`) Un match en
  attente trop vieux est **purgé** (et un `match:expired` émis) au passage de la
  purge quotidienne. Rien n'avertit **avant** l'expiration.
- **Ce qui manque / problème** Le joueur censé valider/contester un score n'a
  aucun rappel « ton score expire dans X h » : il découvre l'expiration une fois
  le match supprimé. Perte d'engagement et de matchs joués non comptabilisés.
- **Fichiers concernés** `index.ts` (nouveau cron de rappel), helpers `notify`.
- **Piste d'implémentation** Cron qui repère les pending à `PENDING_MATCH_TTL_HOURS
  - N` et émet une notif `match_expiring`. Soumis à dédup (ne pas spammer).
- **Effort** S/M · **Priorité** Basse

---

## 4. Fiabilité & cohérence (events perdus)

### 4.1 Aucune garantie de livraison : un SSE manqué hors-ligne est perdu
- **État actuel** (`sse.ts:50-60` `emit`) `emit` écrit dans les flux **présents au
  moment de l'émission**. Si l'utilisateur n'a aucun flux ouvert (offline, onglet
  fermé), le signal SSE est simplement **non envoyé** — aucune file d'attente.
- **Ce qui manque / problème** Pour les events de **données** (`leaderboard:update`,
  `tournament:update`, `match:confirmed`…), c'est acceptable car le re-fetch au
  retour rattrape l'état. Mais c'est fragile : la cohérence repose entièrement sur
  le re-fetch déclenché au focus/online (`useServerEvents` `fireOnReopen`,
  `useLeagueData`). Les **notifications** survivent (persistées en base + polling
  30 s), mais les events purement signalétiques sans backing store (ex.
  `ffa:progress`, overlays) sont perdus sans rattrapage.
- **Fichiers concernés** `sse.ts`, `useServerEvents.ts:104-141` (reopen),
  `useLeagueData.tsx`.
- **Piste d'implémentation** Documenter clairement la garantie « at-most-once +
  re-fetch idempotent » comme contrat, et s'assurer que chaque event a un
  re-fetch de rattrapage côté consommateur. Pour les overlays volatils, accepter
  la perte ou les baser sur un état persistant.
- **Effort** M · **Priorité** Basse

### 4.2 Pas de `Last-Event-ID` ni de replay au reconnect
- **État actuel** (`index.ts:1290-1317`) L'endpoint `/events` n'attribue **pas
  d'`id`** aux events SSE et n'exploite **pas** l'en-tête `Last-Event-ID` que le
  navigateur renverrait à la reconnexion. À l'ouverture, seul `connected` puis des
  `ping` sont envoyés — pas de rejeu des events ratés pendant la coupure.
- **Ce qui manque / problème** Le mécanisme natif de reprise SSE
  (`Last-Event-ID` → replay depuis le dernier id reçu) est inutilisé. Toute la
  reprise repose sur `useServerEvents` qui **rouvre et re-fetch** (cf. 4.1). C'est
  fonctionnel mais ne tire pas parti du standard et n'offre pas de rejeu ciblé.
- **Fichiers concernés** `index.ts:1290-1317`, `sse.ts`, `useServerEvents.ts`.
- **Piste d'implémentation** Conserver un buffer circulaire récent d'events par
  login, attribuer un `id` croissant, et rejouer depuis `Last-Event-ID` à la
  reconnexion. Coûteux ; à n'envisager que si la fiabilité event devient critique.
- **Effort** L · **Priorité** Basse

### 4.3 Le plafond 5 flux/login peut tuer un onglet actif silencieusement
- **État actuel** (`sse.ts:18-37`) Au-delà de `MAX_SSE_PER_LOGIN = 5`,
  `registerSse` **ferme la connexion la plus ancienne** (`oldest.close()`) pour
  faire de la place. Or chaque consommateur front ouvre **son propre** EventSource
  (`useLeagueData` + `NotificationBell` + GOD panel + `TournoiDetailPage` +
  `ContestRageOverlay`).
- **Ce qui manque / problème** Une **seule** page peut déjà ouvrir plusieurs flux
  simultanés (la cloche, le state global, l'overlay rage, et une page tournoi ou
  le GOD panel). Avec 2 onglets, on peut frôler/dépasser 5 et **évincer un flux
  actif** d'un autre onglet, qui se reconnecte alors en boucle (re-déclenche
  l'éviction). Le risque de battement (« connexion qui meurt sans `onerror`
  immédiat ») existe. Les admins sont exemptés (`unlimited`) mais pas les joueurs.
- **Fichiers concernés** `sse.ts:18-37`, tous les `useServerEvents`/`useLeagueData`.
- **Piste d'implémentation** **Mutualiser un seul EventSource par onglet**
  (BroadcastChannel + un hub d'événements interne) au lieu d'un flux par hook —
  réduit drastiquement le nombre de flux et le risque d'éviction. Sinon, relever
  prudemment le plafond ou compter par **onglet** plutôt que par hook.
- **Effort** M (mutualisation) · **Priorité** Moyenne

### 4.4 Création de notif best-effort : échec base = notif perdue sans trace
- **État actuel** (`index.ts:390-411`) `notify`/`notifyMany` sont **tolérants aux
  erreurs** : un `try/catch` avec `/* noop */`. Volontaire (une notif ratée ne
  doit pas casser l'action métier), mais une panne base = notif **silencieusement
  perdue**, sans log ni retry.
- **Ce qui manque / problème** Aucune observabilité : on ne saura jamais qu'un
  joueur n'a pas reçu son « défi reçu » si l'insert a échoué. Le `catch` vide
  masque aussi des bugs (ex. `refId` trop long, contrainte FK).
- **Fichiers concernés** `index.ts:390-429` (`notify`, `notifyMany`,
  `markNotifsReadByRef`).
- **Piste d'implémentation** Au minimum `console.warn` dans les `catch` (compteur
  d'échecs). Idéalement, une file de retry légère pour les notifs critiques (défi,
  score à valider).
- **Effort** S · **Priorité** Moyenne

---

## 5. Timers volatils au redémarrage

### 5.1 Timers OPS = `setTimeout` en mémoire, ré-armés mais fragiles
- **État actuel** (`index.ts:5576-5602`) `scheduleOpsTimers` arme des `setTimeout`
  qui émettent `ops:update` à l'expiration (24 h) et à la fin de cooldown (7 j).
  `rescheduleOpsTimers` les **ré-arme au démarrage** (sinon un reboot les perdrait).
  La lecture filtre toujours `expiresAt > now`, donc l'**état affiché reste
  correct** même si un timer est manqué.
- **Ce qui manque / problème** Le mécanisme est correct mais **fragile et
  implicite** : (a) si le process redémarre **juste après** l'expiration mais
  avant que le client n'ait re-fetch, l'event `ops:update` correspondant n'est
  **jamais ré-émis** (le re-scheduler ne ré-arme que le futur) — le client ne se
  rafraîchit qu'au prochain trigger / focus ; (b) les timers vivent en mémoire du
  **seul** process (cf. 6.1) ; (c) la durée 24 h est sous la limite `setTimeout`
  (~24,8 j) mais le cooldown 7 j aussi, ce qui masque la fragilité d'un éventuel
  timer plus long futur (au-delà de ~24,8 j, `setTimeout` déborde).
- **Fichiers concernés** `index.ts:5576-5602`.
- **Piste d'implémentation** Remplacer les `setTimeout` par un **balayage
  périodique** (cron toutes les N minutes qui émet `ops:update` pour les ops dont
  l'expiration/cooldown vient de passer et n'a pas encore été signalée), idempotent
  et robuste au reboot. Marquer en base l'émission (`expiredNotified`) pour ne pas
  re-signaler.
- **Effort** M · **Priorité** Moyenne

### 5.2 Expiration des matchs en attente : purge quotidienne seulement
- **État actuel** (`index.ts:8223` `purgeStalePendingMatches`) Les pending
  périmés sont nettoyés **une fois par jour** par la purge, qui émet alors
  `match:expired`.
- **Ce qui manque / problème** L'expiration réelle (TTL franchi) et la
  **notification** d'expiration sont décorrélées de jusqu'à 24 h : un match peut
  rester « en attente » bien après son TTL jusqu'au passage du cron, puis
  disparaître brusquement. Pas de rappel avant (cf. 3.6).
- **Fichiers concernés** `index.ts:8219-8242`.
- **Piste d'implémentation** Augmenter la fréquence du balayage (toutes les heures)
  ou armer des timers comme pour les OPS, avec re-scheduling au boot.
- **Effort** S/M · **Priorité** Basse

### 5.3 Aucune notification à l'expiration d'une invitation de tournoi
- **État actuel** Les invitations de tournoi émettent `tournament:invite` /
  `tournament:invite_declined` (`index.ts:4803`, `4897`, `6522`) mais aucun
  mécanisme d'**expiration** de l'invitation non répondue (pas de timer, pas de notif).
- **Ce qui manque / problème** Une invitation peut rester pendante indéfiniment ;
  ni l'invité ni l'organisateur ne sont relancés ou informés d'une péremption.
- **Fichiers concernés** `index.ts` (logique invitations tournoi), `schema.prisma`.
- **Piste d'implémentation** Si une politique d'expiration est souhaitée : TTL +
  balayage périodique + notif `tournament_invite_expired`. Sinon, documenter
  l'absence volontaire.
- **Effort** M · **Priorité** Basse

---

## 6. Scalabilité SSE (un seul process)

### 6.1 Registre en mémoire : impossible de scaler horizontalement
- **État actuel** (`sse.ts:9`) `const connections = new Map<string, Set<...>>()`
  vit dans la **mémoire du process backend**. `emit`/`broadcast` ne touchent que
  les flux connectés **à cette instance**.
- **Ce qui manque / problème** Le backend ne peut tourner qu'en **mono-process /
  mono-instance**. Dès qu'on met 2 réplicas derrière un load-balancer, un `emit`
  émis par l'instance A n'atteint pas un flux ouvert sur l'instance B → notifs et
  re-fetch temps réel manqués pour la moitié des utilisateurs. Idem pour les
  timers OPS (cf. 5.1) qui ne s'arment que sur l'instance qui a traité la requête.
- **Fichiers concernés** `sse.ts` (tout), `index.ts` (timers).
- **Piste d'implémentation** Bus de messages partagé (Redis Pub/Sub) : chaque
  instance publie ses events, toutes les instances relaient à leurs flux locaux.
  Indispensable avant tout scaling horizontal. À défaut, documenter explicitement
  la contrainte mono-instance comme limite d'architecture.
- **Effort** L · **Priorité** Basse (selon ambition de scaling)

### 6.2 `broadcast` itère sur toutes les connexions à chaque mutation
- **État actuel** (`sse.ts:44-46`, `index.ts:868-888`) `broadcast` =
  `emit([...connections.keys()], event)`, et le middleware `broadcastOnMutation`
  diffuse `tournament:update` / `data:update` / `panel:update` après **chaque**
  mutation 2xx sur les préfixes concernés.
- **Ce qui manque / problème** Un `broadcast` est en `O(connexions)` et part à
  **chaque** mutation, même quand un seul utilisateur est concerné. Avec beaucoup
  de connexions, `data:update` (qui re-fetch **tous** les domaines côté
  `useLeagueData`) provoque une tempête de re-fetch global chez tout le monde pour
  une action qui n'intéresse souvent qu'un admin. Pas de filtrage ni de coalescing
  côté serveur (seul le debounce 250 ms côté client amortit).
- **Fichiers concernés** `sse.ts:44-46`, `index.ts:868-888`,
  `useLeagueData.tsx` (`EVENT_DOMAINS`, `data:update` = tous domaines).
- **Piste d'implémentation** Cibler plus finement (qui est réellement concerné),
  remplacer `data:update` global par des events plus spécifiques, et/ou coalescer
  côté serveur (débit max par type).
- **Effort** M · **Priorité** Basse

### 6.3 Pas de métriques / observabilité sur le canal SSE
- **État actuel** Aucun compteur exposé : nombre de flux ouverts, events émis/s,
  évictions par plafond, échecs `writeSSE`, taille du registre. Le `catch`
  d'éviction de flux stale (`sse.ts:55-58`) est silencieux.
- **Ce qui manque / problème** Impossible de diagnostiquer une fuite de connexions,
  un pic de broadcast, un client qui se reconnecte en boucle (cf. 4.3), ou un
  plafond atteint anormalement. Pas de visibilité sur la santé temps réel.
- **Fichiers concernés** `sse.ts`, `index.ts:1290-1317`.
- **Piste d'implémentation** Compteurs in-memory (gauge connexions, counters
  emit/broadcast/eviction) exposés sur un endpoint `/admin/metrics` ou logués
  périodiquement.
- **Effort** S/M · **Priorité** Basse

### 6.4 Polling 30 s de la cloche en plus du SSE (double charge)
- **État actuel** (`NotificationBell.tsx:11`, `113-118`) La cloche fait
  `setInterval(load, 30_000)` **en plus** d'écouter le SSE `notification`.
- **Ce qui manque / problème** Le polling est un filet de sécurité (event SSE
  raté), mais il interroge `/notifications` toutes les 30 s **par onglet ouvert**
  même quand rien ne change et même quand le SSE fonctionne. Pour N utilisateurs ×
  M onglets, c'est une charge de lecture constante évitable. Pas de pause quand
  l'onglet est en arrière-plan.
- **Fichiers concernés** `NotificationBell.tsx:113-118`.
- **Piste d'implémentation** Allonger l'intervalle (60-120 s), suspendre le poll
  quand `document.visibilityState === 'hidden'`, ou s'appuyer davantage sur le
  re-fetch au focus (déjà géré par `useServerEvents` `fireOnReopen`) et ne poller
  que comme rare filet.
- **Effort** S · **Priorité** Basse

---

## 7. Historique & gestion de la cloche

### 7.1 Historique borné à 40 notifs, sans pagination
- **État actuel** (`index.ts:1526-1537`) `GET /notifications` renvoie les **40
  dernières** (`take: 40`) ; la cloche affiche l'onglet Inbox = `items` complet
  (`NotificationBell.tsx:163`) sans bouton « charger plus ».
- **Ce qui manque / problème** Au-delà de 40 notifs, l'historique est **tronqué et
  inaccessible**. Aucun curseur/pagination, aucune recherche, aucun filtre par
  type/jeu. L'Inbox n'est pas un vrai historique, juste une fenêtre glissante.
- **Fichiers concernés** `index.ts:1526-1537`, `api.ts:921`,
  `NotificationBell.tsx`.
- **Piste d'implémentation** Pagination par curseur (`createdAt`/`id`) sur
  `/notifications?before=...`, bouton « charger plus » dans l'Inbox. L'index
  `(recipientLogin, createdAt)` existe déjà (`schema.prisma:177`).
- **Effort** S/M · **Priorité** Basse

### 7.2 Pas de purge / TTL des vieilles notifications
- **État actuel** Les crons de purge concernent les audit logs (`purgeOldAuditLogs`,
  `index.ts:8210`) et les pending matchs, **pas** la table `notifications`.
- **Ce qui manque / problème** La table `notifications` croît indéfiniment
  (chaque match × chaque joueur, chaque `new_player` × toute la league…). Pas de
  rétention, donc croissance non bornée. Le `take: 40` masque le problème côté
  lecture mais pas côté stockage.
- **Fichiers concernés** `index.ts` (nouveau cron), `schema.prisma`.
- **Piste d'implémentation** Cron quotidien supprimant les notifs `read = true`
  plus vieilles que N jours (ou toutes au-delà de N jours). Index
  `(recipientLogin, createdAt)` exploitable.
- **Effort** S · **Priorité** Moyenne

### 7.3 « Tout marquer lu » uniquement dans la cloche, pas de page dédiée
- **État actuel** (`NotificationBell.tsx:138-142`, `181-189`) Le bouton « tout
  marquer lu » n'apparaît **que** dans l'en-tête de la cloche et **seulement si
  `unread > 0`**. `POST /notifications/read` (sans `ids`) marque tout lu côté API
  (`index.ts:1540-1551`).
- **Ce qui manque / problème** Pas de page « Notifications » plein écran (la cloche
  est un popover ancré, limité en hauteur `max-h-[60vh]`). Sur mobile, gérer un
  long historique dans un petit popover est inconfortable. L'action « tout lu »
  n'est pas accessible ailleurs (ex. depuis le profil/réglages).
- **Fichiers concernés** `NotificationBell.tsx`, `apps/web` (nouvelle route).
- **Piste d'implémentation** Une route `/notifications` réutilisant `api.notifications()`
  avec pagination (cf. 7.1) et les actions marquer-lu/supprimer.
- **Effort** M · **Priorité** Basse

### 7.4 Impossible de supprimer / archiver une notification
- **État actuel** L'API n'expose que lecture (`GET`) et marquage lu (`POST /read`).
  Aucun `DELETE /notifications/:id`.
- **Ce qui manque / problème** Une notif ne peut qu'être « lue », jamais
  supprimée/archivée par l'utilisateur. La cloche se de-emphase visuellement
  (`mix(base, DARK, 0.74)`, `NotificationBell.tsx:227`) mais l'élément reste dans
  l'Inbox indéfiniment (jusqu'à sortir des 40).
- **Fichiers concernés** `index.ts` (nouvel endpoint), `api.ts`, `NotificationBell.tsx`.
- **Piste d'implémentation** `DELETE /notifications/:id` (+ « tout effacer »),
  swipe-to-dismiss côté front.
- **Effort** S/M · **Priorité** Basse

### 7.5 Pas de déduplication / regroupement des notifs répétées
- **État actuel** Chaque appel `notify` crée une **ligne** ; rien ne fusionne les
  notifs similaires. `markNotifsReadByRef` (`index.ts:417-429`) marque lues par
  `refId` mais ne **dédoublonne** pas à la création.
- **Ce qui manque / problème** Plusieurs notifs du même type/`refId` peuvent
  coexister (ex. relances, multiples confirmations partielles FFA). Pas de
  regroupement « 3 défis reçus » ; l'Inbox peut être noyée de lignes répétitives,
  notamment après les broadcasts/annonces.
- **Fichiers concernés** `index.ts:390-429`.
- **Piste d'implémentation** Upsert par `(recipientLogin, type, refId)` qui
  rafraîchit `createdAt`/`read` plutôt que d'insérer, ou regroupement à
  l'affichage (compteur). L'index `(recipientLogin, refId)` existe déjà.
- **Effort** M · **Priorité** Basse

---

## 8. Accessibilité

### 8.1 Aucune annonce ARIA live des nouvelles notifications
- **État actuel** (`NotificationBell.tsx:144-289`) Le panneau a `role="dialog"`
  mais le badge de compteur et l'arrivée de nouvelles notifs ne sont **pas**
  annoncés : pas de région `aria-live`, pas de `aria-label` dynamique sur le bouton
  cloche reflétant le nombre de non-lus.
- **Ce qui manque / problème** Un utilisateur de lecteur d'écran ne sait pas qu'une
  notif vient d'arriver (le badge change visuellement uniquement). L'`aria-label`
  de la cloche est statique (`t('notif.title')`, ligne 149), sans le compte non-lu.
- **Fichiers concernés** `NotificationBell.tsx:147-161`.
- **Piste d'implémentation** Ajouter une région `aria-live="polite"` (off-screen)
  annonçant « N nouvelles notifications », et inclure le compteur dans l'`aria-label`
  du bouton.
- **Effort** S · **Priorité** Moyenne

### 8.2 Couleur seule porte le sens (discipline/type)
- **État actuel** (`NotificationBell.tsx:47-66`, `212-232`) La discipline/type
  d'une notif est encodée par la **couleur de fond** + emoji + icône Lucide.
  `textOn`/`mix` gèrent le contraste texte/fond, mais la **signification** de la
  couleur (quelle discipline) n'est pas exposée en texte.
- **Ce qui manque / problème** Pour un daltonien ou un lecteur d'écran, la
  distinction « babyfoot vs smash » repose sur couleur+emoji ; le titre ne nomme
  pas toujours la discipline. L'icône aide mais plusieurs types partagent la même
  (`challenge_received`/`accepted` = `Swords`).
- **Fichiers concernés** `NotificationBell.tsx`.
- **Piste d'implémentation** Ajouter un texte/`aria-label` nommant la discipline et
  le type (« Défi reçu · Babyfoot »), indépendant de la couleur.
- **Effort** S · **Priorité** Basse

### 8.3 Pas de son / vibration optionnels
- **État actuel** Aucun feedback audio/haptique à la réception d'une notif.
- **Ce qui manque / problème** Sur mobile notamment, une vibration courte
  (`navigator.vibrate`) ou un son discret renforcerait l'alerte d'un défi reçu —
  fonctionnalité standard absente.
- **Fichiers concernés** `NotificationBell.tsx`, `useServerEvents.ts`.
- **Piste d'implémentation** Option (opt-in, cf. préférences 2.x) déclenchant
  `navigator.vibrate` / un `Audio` court sur event `notification` au premier plan.
- **Effort** S · **Priorité** Basse

---

## 9. Tests

### 9.1 `sse.test.ts` couvre `emit`/`broadcast` mais pas l'endpoint `/events`
- **État actuel** (`apps/backend/src/sse.test.ts`) Bonne couverture unitaire de
  `registerSse` + `emit` + `broadcast` : ciblage/vie privée (un emit ne fuite pas
  vers un autre login), multi-onglets, cleanup idempotent, éviction de flux stale.
- **Ce qui manque / problème** **Rien** ne teste l'endpoint `/events` lui-même :
  l'auth via `getStreamLogin` (cookie / Bearer / `?token=` éphémère), l'event
  initial `connected`, le `ping` 25 s, le cleanup à l'abort, l'exemption admin
  (`unlimited`). Le contrat HTTP du flux n'est pas couvert.
- **Fichiers concernés** `apps/backend/src/sse.test.ts` (+ un itest),
  `index.ts:1290-1317`.
- **Piste d'implémentation** Itest ouvrant `/events` avec un stream-token valide /
  invalide / de mauvais scope, vérifiant `connected` et le rejet d'un token
  mutant.
- **Effort** M · **Priorité** Moyenne

### 9.2 Aucun test du plafond 5 flux/login ni de l'éviction du plus ancien
- **État actuel** (`sse.ts:18-37`) La logique d'éviction du **plus ancien** flux
  au-delà de `MAX_SSE_PER_LOGIN` et l'exemption `unlimited` ne sont **pas testées**
  (`sse.test.ts` n'enregistre jamais 6+ flux pour un même login).
- **Ce qui manque / problème** C'est une protection anti-DoS sensible (cf.
  `AUDIT_CYBER_2026-06-05`) et un point de battement potentiel (cf. 4.3) : son
  comportement exact mérite un test de non-régression.
- **Fichiers concernés** `sse.test.ts`, `sse.ts:18-37`.
- **Piste d'implémentation** Test : enregistrer 6 flux, vérifier que le 1er a été
  `close()` et retiré ; vérifier qu'avec `unlimited` aucun n'est évincé.
- **Effort** S · **Priorité** Moyenne

### 9.3 Aucun test des helpers `notify*` ni de l'auto-lecture par `refId`
- **État actuel** Pas de test sur `notify`/`notifyMany`/`notifyMatchResult`/
  `notifyFollowers`/`markNotifsReadByRef`. Le subtil suffixe `:result` sur le
  `refId` du résultat de match (`index.ts:458-460`, pour ne pas auto-marquer lu le
  résultat fraîchement créé) n'est couvert par aucun test.
- **Ce qui manque / problème** La logique d'auto-lecture par `refId` est délicate
  (un mauvais suffixe rendrait le résultat invisible ou laisserait des doublons
  non-lus). Le filtrage par préférence de `notifyFollowers` non plus n'est testé.
- **Fichiers concernés** `index.ts:390-528`, nouveaux tests.
- **Piste d'implémentation** Tests d'intégration vérifiant qu'un défi reçu puis
  accepté est marqué lu par `refId`, et qu'un `match_result` (`:result`) **n'est
  pas** marqué lu par l'auto-lecture du `refId` du pending.
- **Effort** M · **Priorité** Moyenne

### 9.4 Aucun test front de `NotificationBell` / `useServerEvents`
- **État actuel** Pas de test composant pour la cloche (badge non-lu, onglets,
  marquage lu optimiste, repli icône) ni pour `useServerEvents` (reconnexion avec
  token frais, backoff, `fireOnReopen`, filtrage par `types`).
- **Ce qui manque / problème** La logique de reconnexion `useServerEvents`
  (re-token à chaque coupure, backoff plafonné 30 s, reopen sur focus/online/
  pageshow) est non triviale et non testée ; une régression y casserait tout le
  temps réel front silencieusement.
- **Fichiers concernés** `apps/web/src/components/NotificationBell.tsx`,
  `apps/web/src/hooks/useServerEvents.ts`.
- **Piste d'implémentation** Tests avec un `EventSource` mocké + horloge fake
  (backoff/reconnect), et tests RTL de la cloche (état optimiste de `markAll`).
- **Effort** M · **Priorité** Basse

---

## 10. i18n

### 10.1 Titres & corps des notifs codés en dur en français côté backend
- **État actuel** (`index.ts:450-461`, `483-485`, `519-522`, `1860-1861`, etc.)
  `notifyMatchResult` génère « Victoire / Défaite / Match nul », « ELO mis à jour » ;
  `announceNewPlayer` « Nouveau joueur : @… a rejoint la league » ;
  `maybeNotifytop3` « entre dans le top 3 » ; champion « 🏆 Champion de saison ! »
  — tous en **français en dur**, persistés dans `Notification.title`/`body`.
- **Ce qui manque / problème** Le texte est figé à la langue du backend au moment
  de la création. Un utilisateur en anglais (l'UI a un `i18n.tsx`) reçoit quand
  même des notifs en français. Impossible de re-traduire a posteriori (le texte
  est stocké, pas une clé).
- **Fichiers concernés** `index.ts` (tous les `notify*`),
  `apps/web/src/lib/i18n.tsx`.
- **Piste d'implémentation** Stocker une **clé i18n + paramètres** (ex.
  `type: 'match_result', meta: { outcome, score }`) plutôt qu'un texte, et rendre
  le libellé côté front via `i18n`. Migration du modèle + des sites d'émission.
- **Effort** L · **Priorité** Basse

### 10.2 La cloche est i18n côté UI mais le contenu ne l'est pas
- **État actuel** (`NotificationBell.tsx`) Les libellés d'UI de la cloche
  (titre, onglets, « tout marquer lu », états vides, `ago()`) passent par `useT()`.
  Mais `n.title`/`n.body` viennent du backend en dur (cf. 10.1).
- **Ce qui manque / problème** Incohérence visible : le chrome de la cloche change
  de langue, le **contenu** des notifs non. Aucune clé `notif.*` n'existe pour le
  contenu des notifs (les clés i18n ne couvrent que l'UI de la cloche).
- **Fichiers concernés** `NotificationBell.tsx`, `i18n.tsx`, dépend de 10.1.
- **Piste d'implémentation** Voir 10.1 (rendu du contenu côté front à partir d'une
  clé + meta). Tant que 10.1 n'est pas fait, documenter la limite.
- **Effort** L (couplé à 10.1) · **Priorité** Basse

---

_Fin du document — audit des manques Notifications & Temps réel (SSE)._
