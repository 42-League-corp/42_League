# Manques — Frontend / UX / Mobile / i18n / Tests

> Document d'audit des **incomplétudes, bugs latents et améliorations** du domaine front
> (`apps/web`). Couvre : architecture front, PWA / offline / web push, responsive & mobile,
> i18n (fr/en/es), accessibilité, animations & perf, tests front, gestion erreurs/loading/empty,
> cohérence desktop ↔ mobile, SEO/meta.
>
> Chaque manque suit le gabarit : **État actuel** (fichier:ligne) · **Ce qui manque / problème** ·
> **Fichiers concernés** · **Piste d'implémentation** · **Effort** (S/M/L) · **Priorité**.
>
> _Établi par lecture du code au 2026-06-06. Les numéros de ligne sont indicatifs (le code bouge)._

---

## Table des matières

1. [Détection mobile & responsive](#1-détection-mobile--responsive)
   - 1.1 Détection mobile par largeur — casse en paysage / sur tablette
   - 1.2 Incohérence breakpoint code ↔ doc (`md` vs `lg`)
   - 1.3 `isTouch` calculé mais jamais utilisé pour décider du shell
   - 1.4 Orientation paysage non gérée pour les overlays plein écran
   - 1.5 Manifest verrouillé en `portrait` mais l'UI desktop existe
2. [PWA / offline / installation / web push](#2-pwa--offline--installation--web-push)
   - 2.1 Pas d'offline réel (aucun `navigateFallback`, pas de page offline)
   - 2.2 Aucune UI d'installation (pas de `beforeinstallprompt`)
   - 2.3 Pas de web push (notifications uniquement in-app + SSE)
   - 2.4 Mise à jour SW silencieuse — pas de toast « nouvelle version »
   - 2.5 Pas d'indicateur de perte de connexion (offline/online)
   - 2.6 Raccourcis manifest pointant vers des URLs inexistantes
3. [i18n (fr/en/es)](#3-i18n-fren-es)
   - 3.1 4 clés `shop.rarity.*` manquantes en espagnol
   - 3.2 Messages d'erreur backend en dur (FR) affichés tels quels
   - 3.3 Pas de système de pluriels ni d'interpolation typée
   - 3.4 `<html lang="fr">` figé, jamais synchronisé à la langue active
   - 3.5 Fallback silencieux fr → masque les trous de traduction
   - 3.6 Dates / nombres : `locale` exposé mais peu utilisé
   - 3.7 Pas de garde-fou (lint/test) sur la parité des dictionnaires
4. [Accessibilité (a11y)](#4-accessibilité-a11y)
   - 4.1 Focus visible supprimé sans style de remplacement
   - 4.2 Pas de skip-link ni de hiérarchie de landmarks
   - 4.3 Éléments cliquables non sémantiques (`div`/`span` + onClick)
   - 4.4 Images sans `alt` (10 sur 51)
   - 4.5 Pas de focus-trap ni de restauration de focus dans les modales/sheets
   - 4.6 Contrastes faibles (texte `muted` sur fond sombre)
   - 4.7 Annonces live regions manquantes (toasts, refresh SSE)
   - 4.8 `prefers-reduced-motion` partiel (Framer ok, CSS/JS animations non couvertes)
5. [Animations & performance](#5-animations--performance)
   - 5.1 `framer-motion` chargé en entier (pas de `LazyMotion`)
   - 5.2 Préchargement eager de TOUS les chunks de routes
   - 5.3 Images non optimisées (PNG lourds, pas de webp/avif, pas de lazy)
   - 5.4 `background-attachment: fixed` + grille `::before` = jank mobile
   - 5.5 Re-render global sur chaque resize (useSyncExternalStore)
   - 5.6 Pas de budget de bundle / analyse de taille en CI
6. [Tests front](#6-tests-front)
   - 6.1 Zéro test front (composant, hook, e2e)
   - 6.2 Pas de runner front configuré (ni Vitest web, ni Playwright)
   - 6.3 `TESTING.md` ne couvre que le backend
7. [Gestion erreurs / loading / empty states](#7-gestion-erreurs--loading--empty-states)
   - 7.1 `ErrorBoundary` en dur FR + un seul niveau
   - 7.2 États d'erreur réseau pauvres (toast brut, pas de retry ciblé)
   - 7.3 Empty states incomplets selon les pages
   - 7.4 Skeletons génériques (un seul `PageSkeleton` pour tout)
   - 7.5 Fallback splash à 4 s peut masquer une vraie panne
8. [Cohérence desktop ↔ mobile](#8-cohérence-desktop--mobile)
   - 8.1 Quêtes & Paris : onglets **mobile-only** (absents du profil desktop)
   - 8.2 Asymétries de features à auditer systématiquement
   - 8.3 Double maintenance Desktop/Mobile sans garde-fou
9. [SEO / meta / partage](#9-seo--meta--partage)
   - 9.1 Titre de page statique (pas de `document.title` par route)
   - 9.2 Pas d'Open Graph / Twitter Card
   - 9.3 Pas de pré-rendu / SSR (SPA pure, contenu auth-gated)
10. [Divers / dette UX](#10-divers--dette-ux)

---

## 1. Détection mobile & responsive

### 1.1 Détection mobile par largeur — casse en paysage / sur tablette
- **État actuel** : `apps/web/src/hooks/useViewport.ts:59` — `isMobile: w < BREAKPOINTS.md` (768 px).
  Le choix Mobile vs Desktop se fait **uniquement sur `window.innerWidth`**
  (`shell/ViewportSwitch.tsx:19-21`, `AppShell` → `DesktopShell`/`MobileShell`).
- **Ce qui manque / problème** :
  - Un **téléphone en paysage** (ex. iPhone 14 Pro Max paysage ≈ 932×430, Pixel paysage ≈ 915×412)
    dépasse 768 px → l'app bascule sur le **shell desktop** (sidebar 264 px) sur un vrai mobile.
    C'est le **bug de rotation paysage** identifié : l'UI desktop s'affiche sur un téléphone tenu
    horizontalement, avec une sidebar qui mange l'écran et des cibles tactiles pensées souris.
  - Inversement, une **tablette portrait** (768–1024) reçoit l'UI desktop alors que l'ergonomie
    tactile mobile serait souvent préférable.
  - La largeur seule ignore le **type de pointeur** : `isTouch` (`pointer: coarse`) est calculé
    (`useViewport.ts:50`) mais **n'entre pas** dans la décision de shell.
- **Fichiers concernés** : `hooks/useViewport.ts`, `shell/ViewportSwitch.tsx`, `shell/AppShell.tsx`.
- **Piste d'implémentation** : décider du shell par **combinaison** largeur + pointeur :
  `isMobile = (pointer: coarse && largeur du plus petit côté < seuil)` ou
  `w < md || (isTouch && min(w,h) < md)`. Alternative robuste : se baser sur la **plus petite
  dimension** (`Math.min(innerWidth, innerHeight)`) pour neutraliser la rotation, et ne passer en
  desktop que si `pointer: fine`. Ajouter un test de non-régression (cf. §6).
- **Effort** S · **Priorité** Haute (bug utilisateur réel, régression UX immédiate au pivot).

### 1.2 Incohérence breakpoint code ↔ doc (`md` vs `lg`)
- **État actuel** : le code utilise `BREAKPOINTS.md = 768` (`useViewport.ts:59-61`) ; la doc
  `DOC/FRONTEND.md:73` affirme « `isMobile` (largeur `< 1024px` = breakpoint `lg`) ».
- **Ce qui manque / problème** : la doc et le code **divergent** sur le seuil mobile. Quiconque se
  fie à la doc se trompe de 256 px. Par ailleurs `isDesktop: w >= md` (768) **chevauche** `isTablet`
  (768–1024) : une tablette est à la fois `isTablet` ET `isDesktop`, ce qui rend les futures
  branches « tablet-spécifiques » ambiguës.
- **Fichiers concernés** : `hooks/useViewport.ts:59-61`, `DOC/FRONTEND.md:73`.
- **Piste d'implémentation** : choisir **un** seuil (lié à 1.1), définir `isDesktop = w >= lg` et
  `isTablet = md <= w < lg` (mutuellement exclusifs), puis aligner la doc.
- **Effort** S · **Priorité** Moyenne.

### 1.3 `isTouch` calculé mais jamais utilisé pour décider du shell
- **État actuel** : `useViewport.ts:50` calcule `isTouch = matchMedia('(pointer: coarse)')`, exposé
  dans le `Viewport`, mais aucune décision de layout ne le consomme (`grep` : usages cosmétiques).
- **Ce qui manque / problème** : signal pertinent disponible mais inexploité — racine du 1.1.
- **Fichiers concernés** : `hooks/useViewport.ts`, consommateurs de `useViewport()`.
- **Piste** : l'intégrer dans la décision Mobile/Desktop (cf. 1.1).
- **Effort** S · **Priorité** Moyenne.

### 1.4 Orientation paysage non gérée pour les overlays plein écran
- **État actuel** : nombreux overlays plein écran montés en portal (VERSUS `MatchmakingOverlay`,
  `tournois/VersusOverlay`, `CoinFlipOverlay`, `TournamentLaunchCeremony`, `ContestRageOverlay`,
  `OpsRevealOverlay`, `SplashScreen`). `MobileShell` cale sa hauteur sur `window.innerHeight`
  (`shell/MobileShell.tsx:33,47`).
- **Ce qui manque / problème** : aucune adaptation explicite au paysage (peu de hauteur). Les
  cinématiques verticales (défilé d'inscrits, VERSUS empilé) risquent le **débordement / contenu
  coupé** en paysage ou sur petits écrans bas. Pas de media query `orientation: landscape`.
- **Fichiers concernés** : `components/MatchmakingOverlay.tsx`, `components/tournois/*Overlay*`,
  `components/OpsRevealOverlay.tsx`, `components/SplashScreen.tsx`.
- **Piste** : layouts responsives à l'`orientation` (déjà exposée par `useViewport`), tests visuels
  en paysage, `max-height`/scroll de secours.
- **Effort** M · **Priorité** Moyenne.

### 1.5 Manifest verrouillé en `portrait` mais l'UI desktop existe
- **État actuel** : `public/manifest.webmanifest:10` → `"orientation": "portrait"`.
- **Ce qui manque / problème** : l'app installée en PWA est **forcée en portrait**, ce qui entre en
  tension avec l'existence d'une UI desktop et le besoin (1.1/1.4) de gérer le paysage. Sur desktop
  installé (Chrome PWA), le verrou portrait est incohérent.
- **Fichiers concernés** : `public/manifest.webmanifest`.
- **Piste** : passer à `"any"` (ou retirer la clé) une fois le paysage géré, ou conditionner.
- **Effort** S · **Priorité** Basse.

---

## 2. PWA / offline / installation / web push

### 2.1 Pas d'offline réel (aucun `navigateFallback`, pas de page offline)
- **État actuel** : `vite.config.ts:70-98` — Workbox précache les assets (`globPatterns`), met en
  cache fonts + avatars CDN, et **exclut les `/api`** du cache (`navigateFallbackDenylist`). Mais
  **aucun `navigateFallback`** n'est défini et il n'existe **pas de page `offline.html`**
  (`public/offline.html` absent).
- **Ce qui manque / problème** : hors-ligne, le shell statique peut se charger depuis le cache, mais
  **toutes les données viennent de l'API** (non cachée) → l'app affiche au mieux des erreurs réseau
  brutes, au pire un écran cassé. Il n'y a **aucune expérience offline** (ni page dédiée, ni cache de
  lecture seule du dernier `leaderboard`/`me`). La section `FRONTEND.md §11` parle d'« offline » mais
  c'est en pratique limité au shell.
- **Fichiers concernés** : `vite.config.ts`, `public/` (page offline à créer),
  `hooks/useLeagueData.tsx`.
- **Piste** : ajouter `navigateFallback: '/index.html'` + une page/composant `Offline` ;
  optionnellement, un cache `NetworkFirst` court (TTL faible) sur quelques GET en lecture seule
  (leaderboard, me) pour un mode dégradé, en gardant les mutations interdites offline.
- **Effort** M · **Priorité** Moyenne.

### 2.2 Aucune UI d'installation (pas de `beforeinstallprompt`)
- **État actuel** : `grep` ne trouve **aucun** `beforeinstallprompt`, ni bouton « Installer l'app ».
  Le manifest est complet (icônes, maskable, shortcuts) mais l'installation est laissée au menu natif
  du navigateur.
- **Ce qui manque / problème** : pas de prompt d'installation déclenché par l'app (Android/desktop),
  pas d'instructions iOS (« Ajouter à l'écran d'accueil », non automatisable mais documentable).
  Adoption PWA sous-optimale pour un produit qui se veut mobile-first.
- **Fichiers concernés** : nouveau composant `InstallPrompt`, à monter dans le shell.
- **Piste** : capter `beforeinstallprompt`, stocker l'event, afficher un CTA discret ; bandeau
  d'aide iOS conditionné à `isStandalone === false && iOS`.
- **Effort** S/M · **Priorité** Basse/Moyenne.

### 2.3 Pas de web push (notifications uniquement in-app + SSE)
- **État actuel** : notifications via `NotificationBell` + SSE (`useServerEvents(['notification'])`).
  `grep` : aucun `PushManager`, `pushManager.subscribe`, `Notification.requestPermission`,
  `serviceWorker.ready`.
- **Ce qui manque / problème** : **aucune notification push système** (app fermée). Un défi reçu, un
  match à confirmer, le début d'un tournoi ne génèrent **aucune** notif quand l'app n'est pas ouverte
  — limitation forte pour un usage mobile « lance un duel à ton pote ». Nécessite aussi un backend
  VAPID (hors périmètre de ce doc, mais bloquant côté front).
- **Fichiers concernés** : SW (vite-plugin-pwa, ajout d'un handler push), `hooks/`,
  `components/NotificationBell.tsx`, backend.
- **Piste** : VAPID + `pushManager.subscribe`, endpoint d'enregistrement d'abonnement, `push`/
  `notificationclick` dans le SW, opt-in UX (pas de prompt au démarrage).
- **Effort** L · **Priorité** Moyenne (forte valeur produit, coût élevé).

### 2.4 Mise à jour SW silencieuse — pas de toast « nouvelle version »
- **État actuel** : `main.tsx:23` → `registerSW({ immediate: true })` ; `vite.config.ts:61`
  `registerType: 'autoUpdate'`. Mise à jour appliquée au prochain reload, **sans prompt**.
- **Ce qui manque / problème** : pas de feedback « une nouvelle version est dispo, recharger ? ».
  L'auto-update silencieux peut laisser un onglet long-vivant sur du code obsolète (incohérences
  front/back lors d'un déploiement) ; aucun moyen pour l'utilisateur de forcer le refresh.
- **Fichiers concernés** : `main.tsx`.
- **Piste** : utiliser le callback `onNeedRefresh` de `registerSW` pour afficher un toast/bouton
  « Mettre à jour » qui appelle `updateSW()`.
- **Effort** S · **Priorité** Basse.

### 2.5 Pas d'indicateur de perte de connexion (offline/online)
- **État actuel** : aucun écouteur `online`/`offline` ; `useLeagueData` gère le `401` mais pas la
  coupure réseau (l'`EventSource` SSE se reconnecte mais sans surface UI).
- **Ce qui manque / problème** : l'utilisateur ne sait pas qu'il est hors-ligne ; les actions
  échouent en silence (toast d'erreur générique). Aucune bannière « reconnexion… ».
- **Fichiers concernés** : `hooks/useLeagueData.tsx`, shell.
- **Piste** : hook `useOnlineStatus` (`navigator.onLine` + events), bannière non bloquante, mise en
  pause des polls/SSE en offline.
- **Effort** S · **Priorité** Basse/Moyenne.

### 2.6 Raccourcis manifest pointant vers des URLs inexistantes
- **État actuel** : `public/manifest.webmanifest:37-56` — shortcuts vers `/defis`, `/leaderboard`,
  `/tournois`. Or les routes réelles sont **`/challenges`**, `/leaderboard`, **`/tournaments`**
  (`App.tsx:205-208`). `/defis` et `/tournois` n'existent pas → catch-all `*` → redirection
  `/challenges`.
- **Ce qui manque / problème** : deux des trois raccourcis PWA atterrissent sur une **redirection**
  au lieu de la page visée (`/defis` → fallback ; `/tournois` → fallback). Incohérence
  fonctionnelle directe.
- **Fichiers concernés** : `public/manifest.webmanifest`.
- **Piste** : corriger en `/challenges` et `/tournaments`.
- **Effort** S · **Priorité** Moyenne (bug concret, correctif trivial).

---

## 3. i18n (fr/en/es)

### 3.1 4 clés `shop.rarity.*` manquantes en espagnol
- **État actuel** : dans `lib/i18n.tsx`, le bloc **es** ne contient **pas** `shop.rarity.common`,
  `shop.rarity.rare`, `shop.rarity.epic`, `shop.rarity.legendary` — présentes en `fr` (l.59-62) et
  `en` (l.263-266). Vérifié par diff automatique des clés sur tous les fichiers (`fr=1503`, `en=1503`,
  `es=1499` ; les 4 manquantes sont exactement ces `shop.rarity.*`).
- **Ce qui manque / problème** : un utilisateur **espagnol** voit la rareté des items boutique en
  **français** (fallback fr, cf. 3.5). Régression i18n visible.
- **Fichiers concernés** : `apps/web/src/lib/i18n.tsx` (bloc `es`, vers l.466).
- **Piste** : ajouter `'shop.rarity.common': 'Común'`, `'rare': 'Raro'`, `'epic': 'Épico'`,
  `'legendary': 'Legendario'`.
- **Effort** S · **Priorité** Moyenne.

### 3.2 Messages d'erreur backend en dur (FR) affichés tels quels
- **État actuel** : le backend renvoie des `message` **en français en dur** (ex.
  `apps/backend/src/index.ts:2123` « tu ne peux pas te suivre toi-même », `:4602` « tournoi privé —
  sur invitation uniquement », `:4704` « joueur déjà inscrit », `:5233` « tirage déjà effectué »…).
  Le front les affiche **bruts** dans un toast : `flash.show(err.message, 'error')` — pattern répété
  ~30+ fois (`PlayerPage.tsx:195/212/412`, `DefisDesktop.tsx:884/898/1385/1500`,
  `TournoiDetailPage.tsx:194/291/788/1040/1058`, `CreateTournamentPage.tsx:74`,
  `mobile/PendingMatchCard.tsx:100/121/141`, `ShopPage.tsx` partiellement…).
- **Ce qui manque / problème** : tous les utilisateurs **en/es voient des erreurs en français**.
  L'i18n front est contournée pour tout le chemin d'erreur métier (le plus visible en cas de
  problème). Aucune codification des erreurs (pas de `code` machine traduisible côté front).
- **Fichiers concernés** : `apps/backend/src/index.ts` (messages), `apps/web/src/lib/api.ts`
  (propagation), tous les `flash.show(err.message)` listés.
- **Piste** : faire renvoyer au backend un **code d'erreur** stable (`error.code`) + message par
  défaut ; côté front, mapper `code → t('error.<code>')` avec fallback sur le message serveur.
- **Effort** L (transverse front+back) · **Priorité** Moyenne/Haute.

### 3.3 Pas de système de pluriels ni d'interpolation typée
- **État actuel** : `t(key) = dict[key] ?? DICTS.fr[key] ?? key` (`i18n.tsx:690`). Interpolation
  faite à la main par `replace` de `{x}` dans certaines clés (ex. `pages.ts` « {updated} mis à
  jour »). Les pluriels sont gérés par **clés jumelles** ad hoc (`lb.win.full`/`lb.win.full1`,
  `lb.loss.full`/`lb.loss.full1`).
- **Ce qui manque / problème** : pas de gestion ICU des pluriels (es/en ont des règles différentes du
  fr) ; interpolation non typée (risque de `{var}` non remplacé) ; pas de paramètres typés sur `t`.
- **Fichiers concernés** : `lib/i18n.tsx`, tous les appelants `t(...)`.
- **Piste** : `t(key, params?)` avec interpolation centralisée + helper `plural(n, {one, other})` ;
  ou adopter une lib légère (intl-messageformat) si le volume le justifie.
- **Effort** M · **Priorité** Basse/Moyenne.

### 3.4 `<html lang="fr">` figé, jamais synchronisé à la langue active
- **État actuel** : `index.html:2` → `<html lang="fr">`. Le manifest a aussi `"lang": "fr"`
  (`manifest.webmanifest:14`). Le `I18nProvider` change la langue applicative mais **ne met jamais à
  jour** `document.documentElement.lang`.
- **Ce qui manque / problème** : un utilisateur **en/es** a un document déclaré `lang="fr"** →
  lecteurs d'écran lisent avec la mauvaise prononciation, SEO/accessibilité dégradés, césure/hyphen
  CSS incorrecte.
- **Fichiers concernés** : `lib/i18n.tsx` (effet à ajouter), `index.html`.
- **Piste** : dans `I18nProvider`, `useEffect(() => { document.documentElement.lang = lang; }, [lang])`.
- **Effort** S · **Priorité** Moyenne.

### 3.5 Fallback silencieux fr → masque les trous de traduction
- **État actuel** : `i18n.tsx:690` : `dict[key] ?? DICTS.fr[key] ?? key`. Toute clé manquante en
  en/es **retombe en français sans avertissement**.
- **Ce qui manque / problème** : les manques (ex. 3.1) sont **invisibles** en dev/CI ; on ne s'en
  aperçoit qu'à l'œil. Aucune télémétrie ni warning console sur clé absente.
- **Fichiers concernés** : `lib/i18n.tsx`.
- **Piste** : en dev, `console.warn` sur fallback ; et surtout un **test de parité** (3.7).
- **Effort** S · **Priorité** Moyenne.

### 3.6 Dates / nombres : `locale` exposé mais inégalement utilisé
- **État actuel** : `i18n.tsx:654` expose `locale` (`fr-FR`/`en-GB`/`es-ES`). À auditer : usage de
  `Intl.DateTimeFormat`/`Intl.NumberFormat` vs formats maison (`lib/format.ts`).
- **Ce qui manque / problème** : risque de dates/nombres non localisés (formats fr en dur) selon les
  pages. À vérifier composant par composant.
- **Fichiers concernés** : `lib/format.ts`, composants affichant dates/nombres.
- **Piste** : centraliser via `Intl` paramétré par `locale`.
- **Effort** M · **Priorité** Basse.

### 3.7 Pas de garde-fou (lint/test) sur la parité des dictionnaires
- **État actuel** : aucun test ne vérifie que fr/en/es ont **les mêmes clés**. La divergence 3.1 est
  passée inaperçue.
- **Ce qui manque / problème** : pas de filet ; toute nouvelle clé peut être oubliée dans une langue.
- **Fichiers concernés** : (test à créer), `lib/i18n.tsx`, `lib/locales/*`.
- **Piste** : test unitaire qui compare les ensembles de clés des trois dictionnaires fusionnés et
  échoue sur toute asymétrie (le script de cet audit peut servir de base).
- **Effort** S · **Priorité** Moyenne.

---

## 4. Accessibilité (a11y)

### 4.1 Focus visible supprimé sans style de remplacement
- **État actuel** : `index.css:166-168` → `:focus:not(:focus-visible){ outline: none; }`. C'est la
  **seule** règle de focus globale ; aucun `:focus-visible { outline/ring }` n'est défini au niveau
  base (les `focus:ring`/`focus-visible` Tailwind n'apparaissent que dans ~10 composants ponctuels :
  `GODPage`, `ShopGODPage`, `AbacusSlider`, `CosmeticForm`…).
- **Ce qui manque / problème** : la majorité des éléments interactifs n'ont **aucun indicateur de
  focus clavier visible**. Navigation au clavier quasi impossible à suivre visuellement.
- **Fichiers concernés** : `index.css`, l'ensemble des boutons/liens/inputs.
- **Piste** : règle globale `:focus-visible { outline: 2px solid <accent>; outline-offset: 2px }`
  (respectant le thème), + revue des composants custom.
- **Effort** M · **Priorité** Haute.

### 4.2 Pas de skip-link ni de hiérarchie de landmarks
- **État actuel** : `<main>` existe dans `MobileShell` et `LoginPage`, mais pas de **skip-link**
  (« aller au contenu »), pas de `role="navigation"`/`<nav>` systématique, pas de `<header>` ARIA
  cohérent. `grep` « skip » → aucun skip-link.
- **Ce qui manque / problème** : utilisateurs clavier/lecteur d'écran doivent tabuler toute la nav à
  chaque page ; structure de page peu navigable au lecteur d'écran.
- **Fichiers concernés** : `shell/DesktopShell.tsx`, `shell/MobileShell.tsx`,
  `mobile/primitives/MobileHeader.tsx`, `MobileTabBar.tsx`.
- **Piste** : skip-link en tête de shell, landmarks (`<nav>`, `<main>`, `<header>`) avec
  `aria-label`.
- **Effort** S/M · **Priorité** Moyenne.

### 4.3 Éléments cliquables non sémantiques (`div`/`span` + onClick)
- **État actuel** : ~7 fichiers avec `<div|span ... onClick>` (cibles cliquables sans rôle/`tabindex`/
  gestion clavier).
- **Ce qui manque / problème** : non focusables au clavier, non activables Entrée/Espace, pas annoncés
  comme boutons par les lecteurs d'écran.
- **Fichiers concernés** : à lister via `grep -rlE "<(div|span)[^>]*onClick"` ; convertir en `<button>`
  ou ajouter `role="button" tabIndex={0} onKeyDown`.
- **Piste** : préférer `<button type="button">` ; sinon kit a11y minimal.
- **Effort** S/M · **Priorité** Moyenne.

### 4.4 Images sans `alt` (10 sur 51)
- **État actuel** : 51 `<img>`, dont **41 seulement** avec `alt` → **10 sans `alt`**.
- **Ce qui manque / problème** : images décoratives devraient avoir `alt=""`, images informatives un
  texte. Sans `alt`, les lecteurs d'écran lisent l'URL.
- **Fichiers concernés** : à localiser (`grep -rL "alt=" ... | xargs grep "<img"`).
- **Piste** : `alt=""` (décoratif) ou texte pertinent (avatars : login du joueur).
- **Effort** S · **Priorité** Moyenne.

### 4.5 Pas de focus-trap ni de restauration de focus dans modales/sheets
- **État actuel** : `role="dialog"`/`aria-modal` présents (7 dialogs, 7 `aria-modal`), `useEscapeKey`
  gère Échap. Mais **aucun focus-trap** explicite (Tab peut sortir du dialog vers l'arrière-plan) ni
  **restauration du focus** à la fermeture (`BottomSheet`, `ConfirmProvider`, modales GOAT/Contest…).
- **Ce qui manque / problème** : focus qui fuit hors de la modale au clavier ; perte du point de focus
  après fermeture.
- **Fichiers concernés** : `mobile/primitives/BottomSheet.tsx`, `hooks/useConfirm.tsx`,
  `components/ContestModal.tsx`, modales `createPortal`.
- **Piste** : trap (mémoriser `document.activeElement`, focus 1er élément, boucler Tab, restaurer au
  close) — petit utilitaire partagé.
- **Effort** M · **Priorité** Moyenne.

### 4.6 Contrastes faibles (texte `muted` / `muted-2` sur fond sombre)
- **État actuel** : palette « salle RPG sombre » (`index.css`), textes secondaires `text-muted`,
  `text-muted-2` (ex. `ErrorBoundary` : `text-muted-2` mono très clair sur fond sombre).
- **Ce qui manque / problème** : risque de ratios de contraste sous **4.5:1** (AA) pour le texte
  secondaire et les sous-titres dorés `text-gold-deep`. Aucun audit de contraste documenté.
- **Fichiers concernés** : `tailwind.config.js` (définitions couleurs), composants.
- **Piste** : auditer (axe / Lighthouse), remonter les valeurs `muted` sous le seuil AA.
- **Effort** M · **Priorité** Moyenne.

### 4.7 Annonces live regions manquantes (toasts, refresh SSE)
- **État actuel** : 1 seul `role="status"` repéré. Les **toasts** (`Toast`/`useFlash`) et les mises à
  jour SSE silencieuses ne sont pas dans une **live region**.
- **Ce qui manque / problème** : un lecteur d'écran **n'annonce pas** les toasts (succès/erreur) ni
  les changements live (nouveau défi, résultat) → feedback critique invisible aux non-voyants.
- **Fichiers concernés** : `components/Toast.tsx`, `hooks/useFlash.tsx`, `NotifBanner.tsx`.
- **Piste** : conteneur `aria-live="polite"`/`"assertive"` pour toasts ; live region discrète pour
  les événements importants.
- **Effort** S · **Priorité** Moyenne.

### 4.8 `prefers-reduced-motion` partiel (Framer ok, autres animations non couvertes)
- **État actuel** : bien géré côté Framer (`MotionProvider` `reducedMotion: 'user'`), `StaggerList`,
  `PageTransition`, `useFlickSpin` (`hooks/useFlickSpin.ts:25` court-circuite), `ProfileHeroCard`,
  `GameTransitionOverlay` respectent la pref. **Mais** : les animations **CSS** (`@keyframes`,
  halos coniques, `animate-*` Tailwind, vignette, glints `CoinCount`) ne sont **pas** désactivées via
  un media query global `@media (prefers-reduced-motion: reduce)` dans `index.css` (aucune occurrence
  CSS).
- **Ce qui manque / problème** : les utilisateurs reduced-motion subissent encore les animations CSS
  continues (orbites de coins, dégradés animés) — gêne vestibulaire + batterie.
- **Fichiers concernés** : `index.css`, composants à animations CSS (`CoinCount`, halos).
- **Piste** : bloc CSS global `@media (prefers-reduced-motion: reduce){ *{animation-duration:.01ms!important;
  transition-duration:.01ms!important} }` + opt-out ciblé.
- **Effort** S · **Priorité** Moyenne.

---

## 5. Animations & performance

### 5.1 `framer-motion` chargé en entier (pas de `LazyMotion`)
- **État actuel** : `MotionProvider.tsx:12-14` documente le **choix assumé** de ne pas utiliser
  `LazyMotion` (pour garder `motion.*` au lieu de `m.*`). framer-motion est dans son propre chunk
  vendor (`vite.config.ts:129`).
- **Ce qui manque / problème** : `motion` complet = **bundle plus lourd** (plusieurs dizaines de Ko
  gz évitables). Sur une app mobile-first, c'est du poids au premier chargement.
- **Fichiers concernés** : `MotionProvider.tsx`, tous les `motion.*`.
- **Piste** : `LazyMotion` + `domAnimation`/`domMax` + migration `motion.*` → `m.*` (codemod). Trade-off
  reconnu ; à arbitrer.
- **Effort** L · **Priorité** Basse.

### 5.2 Préchargement eager de TOUS les chunks de routes
- **État actuel** : `App.tsx:27-38,169-173` — `prefetchRouteChunks()` importe **toutes** les pages
  secondaires dès que les données sont prêtes (pour éviter les suspensions pendant la navigation
  animée).
- **Ce qui manque / problème** : le code-splitting est en grande partie **neutralisé** au runtime :
  on télécharge ~toutes les pages juste après le 1er fetch, y compris celles jamais visitées (GOD,
  ShopGOD, H2H, GoatPage…). Sur mobile/réseau lent, ça consomme de la bande passante inutilement.
- **Fichiers concernés** : `App.tsx`.
- **Piste** : précharger seulement les routes **probables** (challenges/leaderboard/profil), et
  précharger les autres **au hover/focus** de la nav (idée déjà notée dans le code `App.tsx:43`), ou
  en `requestIdleCallback` priorisé.
- **Effort** M · **Priorité** Moyenne.

### 5.3 Images non optimisées (PNG lourds, pas de webp/avif, pas de lazy)
- **État actuel** : `public/sf/*` (~90 persos) et `public/smash/*` (~75 persos) en **PNG**, certains
  > 300 Ko (ex. `smash/ganondorf.png` 332 Ko, `bowser.png` 328 Ko). **Aucun** `.webp`/`.avif`.
  Sur 51 `<img>` du code, seulement **2** en `loading="lazy"` et **2** avec `decoding`, **2** avec
  dimensions explicites.
- **Ce qui manque / problème** : poids d'images élevé (rosters complets), pas de format moderne, pas
  de lazy-loading généralisé → **CLS** (pas de width/height) et bande passante mobile gaspillée. Le
  preload de 4 logos d'univers (`index.html:31-34`) est ok mais ponctuel.
- **Fichiers concernés** : `public/sf/*`, `public/smash/*`, composants `SfCharIcon`,
  `SmashCharIcon`, `Avatar`.
- **Piste** : conversion webp/avif (gros gain), `loading="lazy"` + `width`/`height` (ou
  `aspect-ratio`) systématiques, sprite/atlas pour les icônes de persos.
- **Effort** M/L · **Priorité** Moyenne.

### 5.4 `background-attachment: fixed` + grille `::before` = jank mobile
- **État actuel** : `index.css:119` `background-attachment: fixed` sur `body` + `body::before` grille
  technique fixe + vignettes radiales par mode. Commentaire l.95-99 indique déjà des soucis
  standalone iOS.
- **Ce qui manque / problème** : `background-attachment: fixed` est **notoirement coûteux** sur
  mobile (repaint au scroll) et mal supporté → jank/scintillement. Plusieurs couches de gradients
  superposées.
- **Fichiers concernés** : `index.css`.
- **Piste** : remplacer par un élément `fixed` en arrière-plan (déjà fait pour la vignette mobile
  `MobileShell.tsx:50`) plutôt que `background-attachment: fixed` sur `body` ; mesurer le repaint.
- **Effort** S/M · **Priorité** Basse/Moyenne.

### 5.5 Re-render global sur chaque resize
- **État actuel** : `useViewport` via `useSyncExternalStore` recompute sur **chaque** `resize`/
  `orientationchange` (`useViewport.ts:95-109`). Le fingerprint inclut `width x height`
  (`:74`) → toute variation de hauteur (barre d'URL mobile qui s'ouvre/ferme) change le snapshot et
  **re-render tous les consommateurs** de `useViewport()` (dont `ViewportSwitch`, `MobileShell`).
- **Ce qui manque / problème** : sur mobile, le scroll fait apparaître/disparaître la barre d'URL →
  `innerHeight` change en continu → cascades de re-renders pendant le scroll (coût + jank possible).
- **Fichiers concernés** : `hooks/useViewport.ts`, `shell/MobileShell.tsx`.
- **Piste** : exposer des sélecteurs granulaires (`useIsMobile` ne devrait dépendre que de la
  largeur, pas de la hauteur) ; débouncer le resize ; ne ré-émettre `isMobile` que quand le booléen
  change réellement.
- **Effort** S/M · **Priorité** Moyenne.

### 5.6 Pas de budget de bundle / analyse de taille en CI
- **État actuel** : `sourcemap: true` en build (`vite.config.ts:121`), `manualChunks` vendor, mais
  **aucun** rollup-plugin-visualizer, ni budget de taille, ni mesure en CI.
- **Ce qui manque / problème** : aucune visibilité sur la croissance du bundle ; régressions de poids
  non détectées (cf. 5.1).
- **Fichiers concernés** : `vite.config.ts`, CI.
- **Piste** : `rollup-plugin-visualizer` + seuil d'alerte de taille en CI.
- **Effort** S · **Priorité** Basse.

---

## 6. Tests front

### 6.1 Zéro test front (composant, hook, e2e)
- **État actuel** : aucun fichier de test sous `apps/web` (la recherche `*.test.*`/`*.spec.*` ne
  trouve que `packages/shared/*` et `apps/backend/*`). Logique front non triviale **non testée** :
  `useViewport` (décision mobile, 1.1), `i18n` (parité, 3.7), `useLeagueData` (debounce SSE,
  re-fetch ciblé), hooks de gestes (`useHorizontalSwipe`, `useFlickSpin`), `useHistoriqueLogic`,
  `useDefisLogic`.
- **Ce qui manque / problème** : aucune protection contre les régressions UI/logique ; bugs comme la
  détection paysage (1.1) auraient été attrapés par un test de `readViewport`.
- **Fichiers concernés** : tout `apps/web/src`.
- **Piste** : Vitest + Testing Library (jsdom) pour hooks/composants critiques ; commencer par
  `useViewport`, `i18n` (parité), `format`.
- **Effort** M · **Priorité** Haute.

### 6.2 Pas de runner front configuré (ni Vitest web, ni Playwright)
- **État actuel** : seul `apps/backend/vitest.integration.config.ts` existe ; pas de config Vitest
  pour `apps/web`, pas de `playwright`/`cypress` (recherche négative).
- **Ce qui manque / problème** : aucune infrastructure de test front, donc aucun e2e (parcours login
  → défi → confirmation, install PWA, navigation desktop/mobile).
- **Fichiers concernés** : `apps/web` (config à créer), CI.
- **Piste** : Vitest (jsdom) pour l'unitaire/composant ; Playwright pour 2-3 parcours e2e clés
  (auth, déclaration de match, bascule mobile/desktop, paris).
- **Effort** M/L · **Priorité** Moyenne/Haute.

### 6.3 `TESTING.md` ne couvre que le backend
- **État actuel** : `DOC/TESTING.md` documente unitaires shared/backend + intégration HTTP ; **rien**
  sur le front (l'absence n'est même pas signalée comme trou). `pending.md` ne liste pas de tests
  front.
- **Ce qui manque / problème** : la doc laisse croire que la stratégie de test est complète alors que
  **tout le front est non testé**.
- **Fichiers concernés** : `DOC/TESTING.md`, `DOC/pending.md`.
- **Piste** : ajouter une section « Tests front (à mettre en place) » + entrée pending.
- **Effort** S · **Priorité** Basse.

---

## 7. Gestion erreurs / loading / empty states

### 7.1 `ErrorBoundary` en dur FR + un seul niveau
- **État actuel** : `components/ErrorBoundary.tsx` — textes **« Erreur de rendu »**, **« Réessayer »**
  en **français en dur** ; affiche `error.message` brut (mono) y compris en prod. Une seule instance
  enveloppe les routes (`App.tsx:201`).
- **Ce qui manque / problème** : non traduit (en/es) ; expose le message d'erreur technique en prod ;
  granularité faible (une erreur dans une page casse toute la zone routée). Pas de reporting (Sentry).
- **Fichiers concernés** : `components/ErrorBoundary.tsx`, `App.tsx`.
- **Piste** : traduire via `t()`, message générique en prod (stack en dev), boundaries plus fins
  autour des sections lourdes, hook de reporting optionnel.
- **Effort** S/M · **Priorité** Moyenne.

### 7.2 États d'erreur réseau pauvres (toast brut, pas de retry ciblé)
- **État actuel** : `useLeagueData` expose `error` (string) affiché en bandeau rouge (`App.tsx:193`),
  sinon les erreurs d'action passent par `flash.show(err.message)` (cf. 3.2). Pas de bouton retry
  contextuel, pas de distinction réseau/permission/validation.
- **Ce qui manque / problème** : feedback peu actionnable, messages techniques, pas de re-tentative
  ciblée par domaine.
- **Fichiers concernés** : `hooks/useLeagueData.tsx`, `lib/api.ts`, appelants.
- **Piste** : typer les erreurs (réseau vs métier), composant d'erreur avec retry par domaine.
- **Effort** M · **Priorité** Moyenne.

### 7.3 Empty states incomplets selon les pages
- **État actuel** : empty states **présents** pour beaucoup d'écrans (`defis.empty`, `lb.empty`,
  `history.empty(.mine)`, `shop.empty`, `tournois.empty.*`, `team.empty.*`, `notif.empty.*`). Mais à
  auditer : H2H sans confrontation, GoatPage saison vide, recherche joueur sans résultat, profil
  joueur sans match.
- **Ce qui manque / problème** : couverture **inégale** ; certains écrans secondaires affichent
  probablement du vide brut.
- **Fichiers concernés** : `pages/H2HPage.tsx`, `pages/GoatPage.tsx`, `pages/PlayerPage.tsx`,
  `pages/teams/TeamsPage.tsx`.
- **Piste** : passer chaque page en revue, ajouter un composant `EmptyState` réutilisable (icône +
  titre + CTA), traduit.
- **Effort** M · **Priorité** Moyenne.

### 7.4 Skeletons génériques (un seul `PageSkeleton` pour tout)
- **État actuel** : `App.tsx:199,202` utilise **`PageSkeleton`** (mobile/primitives/Skeleton) comme
  fallback **unique** pour le loading global ET le `Suspense` de **toutes** les routes.
- **Ce qui manque / problème** : le squelette ne ressemble pas à la page cible (classement = table,
  profil = hero + graphe…) → flash de layout incohérent à l'arrivée sur chaque page.
- **Fichiers concernés** : `App.tsx`, `mobile/primitives/Skeleton.tsx`.
- **Piste** : skeletons par page (au moins pour leaderboard/profil/historique).
- **Effort** M · **Priorité** Basse.

### 7.5 Fallback splash à 4 s peut masquer une vraie panne
- **État actuel** : `App.tsx:115-119` — après la fin de l'animation, un `setTimeout(4000)` force
  `appReady`, « évite un splash infini si la requête bloque ».
- **Ce qui manque / problème** : si l'API est down, après 4 s on **entre dans l'app sans données**
  (le bandeau d'erreur peut s'afficher, mais l'expérience est confuse). Pas d'écran « impossible de
  charger, réessayer ».
- **Fichiers concernés** : `App.tsx`, `AuthenticatedShell`.
- **Piste** : distinguer « lent » (continuer) de « échec » (écran retry) selon l'`error` de
  `useLeagueData`.
- **Effort** S · **Priorité** Basse/Moyenne.

---

## 8. Cohérence desktop ↔ mobile

### 8.1 Quêtes & Paris : onglets **mobile-only** (absents du profil desktop)
- **État actuel** : `pages/profil/ProfilMobile.tsx:14-15,62-69` importe et affiche **`QuestsPanel`**
  et **`BetsPanel`** via un `SegmentedControl` (onglets *profile / quests / bets*, deep-link
  `?tab=bets`). `pages/profil/ProfilDesktop.tsx` ne référence **ni** quêtes **ni** paris **ni** coins
  (recherche `quest|bet|coin|pari` → aucun résultat pertinent). `QuestsPanel`/`BetsPanel` ne sont
  importés **que** par `ProfilMobile`.
- **Ce qui manque / problème** : **asymétrie de feature majeure** — sur **desktop**, l'utilisateur
  **n'a aucun accès** à ses **quêtes hebdomadaires** ni à ses **paris en cours** depuis son profil.
  Tout un pan de l'économie (gains, suivi des paris) est invisible au clavier/souris. C'est l'exemple
  type du « panneau mobile-only » à corriger.
- **Fichiers concernés** : `pages/profil/ProfilDesktop.tsx`, `pages/profil/QuestsPanel.tsx`,
  `pages/profil/BetsPanel.tsx`, `pages/profil/index.tsx`.
- **Piste** : intégrer Quêtes/Paris dans `ProfilDesktop` (onglets ou colonne dédiée) en réutilisant
  les panels existants (déjà découplés du shell).
- **Effort** M · **Priorité** Haute.

### 8.2 Asymétries de features à auditer systématiquement
- **État actuel** : pattern `XxxDesktop`/`XxxMobile` partout (`defis`, `tournois`, `historique`,
  `leaderboard`, `profil`, `team`). La logique partagée est dans `shared/useXxxLogic.ts` pour
  certains, mais **pas garantie** pour tous → risque de divergence (un côté a une action que l'autre
  n'a pas, ex. 8.1).
- **Ce qui manque / problème** : pas d'inventaire des fonctionnalités par viewport ; les divergences
  se découvrent à l'usage.
- **Fichiers concernés** : tous les couples `*Desktop.tsx`/`*Mobile.tsx`.
- **Piste** : audit feature-par-feature (tableau « action × desktop × mobile »), factoriser le
  maximum de logique dans `shared/`, ne laisser au split que la **présentation**.
- **Effort** M · **Priorité** Moyenne.

### 8.3 Double maintenance Desktop/Mobile sans garde-fou
- **État actuel** : chaque feature = deux arbres de rendu distincts (cf. `FRONTEND.md §3`).
- **Ce qui manque / problème** : toute évolution doit être portée **deux fois** ; pas de test
  garantissant la parité (lié à §6). Coût de maintenance et source de bugs d'asymétrie (8.1).
- **Fichiers concernés** : architecture `pages/*/`.
- **Piste** : maximiser les composants partagés rendus dans les deux shells ; tests de présence des
  actions clés sur les deux variantes.
- **Effort** M · **Priorité** Moyenne.

---

## 9. SEO / meta / partage

### 9.1 Titre de page statique (pas de `document.title` par route)
- **État actuel** : `index.html:59` `<title>42 League</title>` fixe ; aucun `document.title`
  dynamique ni `<Helmet>` (recherche négative).
- **Ce qui manque / problème** : toutes les routes ont **le même titre** d'onglet ; mauvais pour
  l'historique du navigateur, les onglets multiples, l'accessibilité (annonce de page).
- **Fichiers concernés** : pages, ou hook `useDocumentTitle`.
- **Piste** : hook `useDocumentTitle(t('panel.xxx.title'))` par page.
- **Effort** S · **Priorité** Basse/Moyenne.

### 9.2 Pas d'Open Graph / Twitter Card
- **État actuel** : `index.html` n'a que `description`/`theme-color` ; **aucune** balise `og:*` /
  `twitter:*` (recherche négative).
- **Ce qui manque / problème** : un lien partagé (Discord/Slack 42) n'affiche **aucune carte riche**
  (titre/image/description) → moins engageant.
- **Fichiers concernés** : `index.html`.
- **Piste** : `og:title`, `og:description`, `og:image` (logo wordmark), `twitter:card`.
- **Effort** S · **Priorité** Basse.

### 9.3 Pas de pré-rendu / SSR (SPA pure, contenu auth-gated)
- **État actuel** : SPA Vite pure, contenu derrière auth ; `robots.txt` `Allow: /` (mais rien à
  indexer). Pas de SSR/prerender.
- **Ce qui manque / problème** : l'`/about` public et la landing `/login` ne sont pas pré-rendus
  (référencement faible, premier paint JS-dépendant). Acceptable pour un outil interne, mais à noter.
- **Fichiers concernés** : build, `public/robots.txt`.
- **Piste** : prerender statique de `/login` et `/about` si le SEO compte ; sinon, laisser tel quel.
- **Effort** M · **Priorité** Basse.

---

## 10. Divers / dette UX

- **Détection langue navigateur incomplète** : `i18n.tsx:660-665` ne gère que `es`/`fr` → défaut
  `en` ; pas de prise en compte de `navigator.languages` (ordre de préférence). **Effort** S ·
  **Priorité** Basse.
- **`format-detection: telephone=no`** ok, mais `viewport-fit=cover` + safe-area gérés via
  `useSafeArea`/CSS — vérifier que **toutes** les barres fixes (tabbar, header, FAB, overlays)
  respectent `env(safe-area-inset-*)` sur iPhone à encoche (la tabbar le fait `MobileShell.tsx:61`,
  auditer le reste). **Effort** S · **Priorité** Basse.
- **Haptique limitée à `navigator.vibrate`** (`mobile/feedback/useHaptic.ts`) : **ignorée sur iOS
  Safari** (documenté dans le fichier). Pas d'alternative (le retour « tactile » iOS repose sur le
  visuel). Rien à corriger côté API, mais à garder en tête pour l'UX iOS. **Effort** — ·
  **Priorité** Basse.
- **Toasts non empilables / file** : `useFlash` auto-dismiss 3 s — vérifier le comportement en cas de
  toasts rapprochés (écrasement ?). **Effort** S · **Priorité** Basse.
- **Pas de gestion d'erreur d'image** (`onError` / fallback avatar) systématique : un avatar 42 cassé
  ou un PNG perso 404 laisse un trou. À auditer dans `Avatar`, `SfCharIcon`, `SmashCharIcon`.
  **Effort** S · **Priorité** Basse/Moyenne.
- **Analytics sans bannière de consentement dédiée** : `lib/analytics.ts` envoie de la télémétrie
  produit (best-effort). Vérifier l'articulation avec `ConsentGate` (RGPD) — la télémétrie ne doit
  partir qu'après consentement. **Effort** S · **Priorité** Moyenne (conformité).
- **`sourcemap: true` en prod** (`vite.config.ts:121`) : expose le code source (debug facilité mais
  surface d'analyse). Choix à confirmer. **Effort** S · **Priorité** Basse.

---

### Synthèse des priorités hautes
1. **Détection mobile par largeur** (1.1) — bug paysage/tablette réel, UI desktop sur téléphone.
2. **Focus visible global manquant** (4.1) — navigation clavier inutilisable.
3. **Quêtes & Paris absents du profil desktop** (8.1) — pan d'économie invisible sur desktop.
4. **Zéro test front** (6.1) — aucune protection contre régressions (dont 1.1).
5. **Erreurs backend FR en dur** (3.2) — toute la couche erreur non traduite en/es.

Manques i18n concrets immédiats : **4 clés `shop.rarity.*` ES** (3.1), **`<html lang>` non
synchronisé** (3.4), **shortcuts manifest cassés** `/defis` `/tournois` (2.6).
