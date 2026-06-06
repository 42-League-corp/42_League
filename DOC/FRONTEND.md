# Frontend (site web) — 42 League

Architecture de l'app React (`apps/web`). Cible : un dev qui veut ajouter une page ou comprendre
le flux de données sans tout relire.

- **Stack** : React 18 + react-router-dom 6, Vite 5, TailwindCSS 3, framer-motion 11, lucide-react,
  @use-gesture/react, PWA (vite-plugin-pwa + workbox). Voir [STACK.md §2](./STACK.md).
- **Client HTTP** : `fetch` natif (pas d'axios/react-query).
- **Pas de CSS global** : tout en utilitaires Tailwind.

---

## 1. Point d'entrée & providers

`src/main.tsx` monte l'app dans `#root` et empile les providers (du plus externe au plus interne) :
```
MotionProvider → I18nProvider → AuthProvider → FlashProvider → ConfirmProvider → BrowserRouter → App
```
En production, le service worker PWA est enregistré (`registerSW({ immediate: true })`, auto-update silencieux).

`src/App.tsx` gère le routage et les gardes (auth + rôle). Les routes authentifiées sont **lazy-loaded**
(code-splitting) avec un `Suspense` + skeleton ; un `prefetchRouteChunks()` précharge les chunks après
le premier fetch pour éviter les suspensions pendant la navigation animée.

Côté build, `vite.config.ts` isole les grosses dépendances dans des **chunks vendor** dédiés
(`manualChunks` : `vendor-react` = react/react-dom/react-router-dom, `vendor-motion` = framer-motion) —
ils sont mis en cache long terme et ne sont plus réinvalidés à chaque changement de code applicatif.

`src/lib/config.ts` : `getApiBase()` (override possible via `localStorage['league:api_base_override']`,
sinon `VITE_API_BASE_URL`, défaut `http://localhost:3000`), `APP_VERSION`, `APP_BUILD_DATE`.

---

## 2. Routage

| Path | Page | Auth |
|---|---|---|
| `/login` | `LoginPage` | non |
| `/auth/return` | `AuthReturnPage` (callback OAuth, lit le token dans le fragment `#`) | non |
| `/about` | `AboutPage` (règles + RGPD Art. 13, accessible pré-auth) | conditionnel |
| `/challenges` | `DefisPage` | oui |
| `/tournaments` | `TournoisPage` | oui |
| `/tournaments/:id` | `TournoiDetailPage` | oui |
| `/leaderboard` | `LeaderboardPage` | oui |
| `/goat` | `GoatPage` (Greatest Of All Time — palmarès & saisons) | oui |
| `/grades` | `GradesPage` (barème ELO illustré + grade Grand Master) | oui |
| `/trophies` | `TropheesPage` | oui |
| `/shop` | `ShopPage` (boutique League Coin) | oui |
| `/shop-god` | `ShopGODPage` (édition du catalogue cosmétique) | **ADMIN/SUPERADMIN** |
| `/profile` | `ProfilPage` | oui |
| `/player/:login` | `PlayerPage` | oui |
| `/h2h` | `H2HPage` (Head-to-Head : confrontation directe entre deux joueurs) | oui |
| `/history` | `HistoriquePage` | oui |
| `/settings` | `ReglagesPage` | oui |
| `/GOD` | `GODPage` | **ADMIN/SUPERADMIN** |
| `/`, `*` | redirige vers `/challenges` | oui |

> Les routes admin (`/GOD`, `/shop-god`) ne sont pas gardées par un élément de route dédié : leur
> bouton n'apparaît dans la nav que pour ADMIN/SUPERADMIN (UX) et le backend reste l'autorité réelle.

Les routes authentifiées sont **lazy-loaded**. `/about` est aussi accessible **avant** auth (route
dédiée non authentifiée) pour montrer règles + RGPD + onglet Technique avant de se connecter.

**Garde auth** : `AuthProvider` lit le token dans `localStorage['league:token']`. Présent → shell
authentifié ; absent → `/login`. Une réponse `401` purge le token et relance l'auth.

---

## 3. Découpage desktop / mobile

Le repo a une **UI desktop et une UI mobile distinctes**, choisies à l'exécution (pas par route).

- `useViewport()` (`hooks/useViewport.ts`) expose `isMobile` (largeur `< 1024px` = breakpoint `lg`),
  `isTablet`, `isStandalone` (PWA), `orientation`, etc. (via `useSyncExternalStore`).
- `shell/AppShell.tsx` → `ViewportSwitch` → `DesktopShell` (sidebar 264 px) **ou** `MobileShell`
  (header sticky + contenu scrollable + tabbar bas).
- **Pattern par feature** : `XxxPage.tsx` (wrapper) → `pages/xxx/index.tsx` → `ViewportSwitch(mobile, desktop)`
  → `XxxDesktop.tsx` / `XxxMobile.tsx`, avec la logique partagée dans `pages/xxx/shared/useXxxLogic.ts`.
  Exemple : `defis/` a `index.tsx`, `DefisDesktop.tsx`, `DefisMobile.tsx`, `shared/useDefisLogic.ts`,
  et des sous-composants `mobile/` (sheets, cards, FAB menu).

**Défis (`defis/`)** : le formulaire desktop est aligné sur la sheet mobile — **set complet** (format
**Bo3/Bo5**, games du perdant, vies du gagnant en Smash) et **picker de persos** (`CharPicker`) avec les
favoris épinglés puis les **plus joués en tête** (`mostPlayedChars` sur l'historique). La carte de défi
sélectionnée s'anime via un morph **`layoutId`** (bouton ↔ carte) ; **Échap referme** la carte
(intercepté pour ne pas remonter). À la contestation, l'overlay **« rage »** (`ContestRageOverlay`)
s'affiche des deux côtés (déclencheur local côté contesteur, SSE côté contesté — voir
[REALTIME.md](./REALTIME.md)).

**Matchmaking** : `useMatchmaking` (provider monté au-dessus de l'`AppShell`, survit aux navigations)
gère le « match aléatoire » **indépendant par mode** via **polling** de `GET /queue/status` (2,5 s) — ce
n'est PAS du SSE. Le bouton `MatchmakingButton` emprunte la **palette du mode** (`GAME_META[game].button`),
les cases « en recherche » restent lisibles (libellé + logo + spinner aux couleurs du mode). Un
appariement ouvre l'overlay **VERSUS** (`MatchmakingOverlay`) quelle que soit la page.

**Tournois** : la page détail (`TournoiDetailPage`) ne **recharge plus tout l'écran** (refresh silencieux
piloté SSE — voir [REALTIME.md](./REALTIME.md)) et enchaîne plusieurs cinématiques plein écran montées en
portal : **écran VERSUS** (`tournois/VersusOverlay`, déclenché quand `tournament.activeMatchId` change),
**tirage au sort** / cérémonie de lancement (`TournamentLaunchCeremony`, défilé des inscrits), **pile-ou-face**
plein écran (`CoinFlipOverlay`), et l'**avancée animée du bracket** (`BracketTree`, cartes plus grandes).
Sur un tournoi **en cours** (`status === 'in_progress'`), un onglet **« Parier »** (`tournois.tab.bets`)
remplace le bracket par `TournamentBets` : un pari **sur le vainqueur du tournoi** (un seul pari, ouvert
seulement au début tant qu'aucun résultat n'est tombé, réservé aux non-inscrits) — cf. §9.

Le bouton **GOD** (zone admin) n'apparaît dans la nav que si `me.role` est ADMIN/SUPERADMIN
(`DesktopShell` sidebar / `MobileHeader`). C'est de l'UX, pas de la sécurité — le contrôle réel est
backend (voir [SECURITY.md §3](./SECURITY.md)).

Le **GOD panel** (`pages/GODPage.tsx`) regroupe les onglets de modération (users, audit log, matchs
litigieux, suspicion anti-triche, idées), un onglet **All History** (historique unifié défis / matchs /
rejets / OPS, filtrable, avec **édition/suppression inline par ligne** et **sélection multi-lignes**
pour les actions de masse), et un **sélecteur de saison** (créer / clôturer une saison — aussi dispo
sur mobile). Un onglet **Pending**, visible **SUPERADMIN uniquement**, ajoute la gestion forte de la
ligue : forcer/annuler un match en attente, forcer un résultat, créer ou supprimer un faux joueur, et
le reset complet. Les actions destructrices passent par un **mode sudo** + des confirmations soignées
(phrase exacte pour le reset). Chaque onglet se rafraîchit en temps réel via
`useServerEvents(['data:update', 'panel:update'])` (rechargement silencieux quand un autre admin agit).
Les appels correspondants sont les méthodes `admin*` de `lib/api.ts` (voir §6). Un onglet **tournois**
(god) regroupe la gestion forte des tournois (forcer un résultat / dérouler un bracket) et écoute en
plus `tournament:update`.

**TesterSwitch** (`components/TesterSwitch.tsx`) : bascule « tester en mode user » réservée — sur
**staging uniquement** — aux logins **`throbert` / `jagharra`** (liste blanche en dur, miroir du
backend). Elle échange le token de l'admin contre celui du compte générique `tester` (rôle USER, jamais
un joueur réel — `POST /admin/impersonate-tester`) pour vivre l'app en joueur lambda, puis le restaure
sans repasser par OAuth. Desktop → bouton flottant bas-gauche ; mobile → icône dans le header ; le
retour d'impersonation affiche une bannière flottante quel que soit le viewport.

---

## 4. État & données — `useLeagueData` (`hooks/useLeagueData.tsx`)

Contexte React qui centralise **toutes** les données de la ligue. Charge en parallèle au montage :
`me`, `matches`, `pending`, `challenges`, `leaderboard`, `tournaments`, `opsMe`, `allOps`, `locations`.

Expose `{ ...données, loading, error, refresh() }`. Sur `401`, déclenche un `signOut()`.
`locations` est re-poll toutes les **5 min** (badge « en ligne sur tel host »).

### Temps réel
Ouvre un `EventSource` sur `GET /events?token=...` (token en query car `EventSource` ne peut pas
envoyer d'en-tête `Authorization`). À chaque événement, il marque « sales » les domaines concernés
(mapping `EVENT_DOMAINS`) et **re-fetch uniquement ces domaines** après un **debounce de 250 ms**
(absorbe les rafales). Pas de spinner global : refresh partiel. Détails dans [REALTIME.md](./REALTIME.md).

---

## 5. Autres hooks / contextes

| Hook | Rôle |
|---|---|
| `useAuth` | `authenticated`, `login`, `startLogin()` (→ `/auth/web/login?return_to=`), `signOut()`, `refreshSession()`. Écoute les `storage` events (multi-onglets). |
| `useFlash` | Toasts (auto-dismiss 3 s) : `.show(msg, 'info'\|'error')`. |
| `useConfirm` | Dialog de confirmation : `.confirm({ title, message, warning?, danger? }) → Promise<bool>`. |
| `useViewport` | État viewport (responsive, standalone). |
| `useSafeArea` | Variables CSS `env(safe-area-inset-*)` (notchs). |
| `useHaptic` (`mobile/feedback`) | Vibration tactile mobile. |
| `useServerEvents` | Abonnement SSE **local** à un sous-ensemble d'événements (hors `useLeagueData`), avec debounce. Obtient son propre token de stream éphémère (`api.streamToken`). Utilisé par le GOD panel (rafraîchir chaque onglet) et la cloche `NotificationBell` (écoute `notification`). Détails dans [REALTIME.md §6](./REALTIME.md). |

---

## 6. Client API — `lib/api.ts`

Objet `api` singleton. `request<T>(path, init, {auth})` :
- injecte `Authorization: Bearer <token>` (depuis `localStorage`) si `auth` ;
- pose `content-type: application/json` si body ;
- `401` → `AuthError` (purge token + logout en amont) ; non-2xx → `Error` avec status + body.

Il couvre tous les endpoints du backend (voir [API.md](./API.md)) : `me`, `leaderboard`,
matchs (`declareMatch`, `confirmMatch`, `rejectMatch`, `cancelMatch`), `challenges`
(`create/accept/decline/record`), `ops`, `tournaments` (CRUD + record/confirm + `addTournamentPlayer`),
profils, `locations`, et les routes admin (`adminUsers`, `adminSetStats`, `adminBan/Unban`,
`adminDeleteMatch`, `adminEditMatch`, `adminRejectedMatches`, `adminSuspicious`, `adminAuditLog`),
`featureRequests`.

**Notifications / suivi / saisons** : `notifications()`, `markNotificationsRead(ids?)`,
`follow/unfollow/updateFollowPrefs`, `seasons/currentSeason/seasonStandings/createSeason/closeSeason`.
**Modération de l'historique** : `adminAllHistory(filters?)`, `adminDelete{Challenge,PendingMatch,RejectedMatch,Ops,Tournament}(id)`.
**Actions SUPERADMIN** : `adminCreateUser(login, opts?)`, `adminDeleteUser(login)` (faux comptes
`ftId === null` uniquement), `adminResetDatabase(confirm)`, `adminForceResult(...)`,
`adminForceConfirmMatch(id)`, `adminForceCancelMatch(id)`. Le type `AdminUser.ftId` est `number | null`.

**Token de stream** : `streamToken()` (→ `GET /auth/stream-token`) renvoie un token éphémère (scope
SSE, TTL ~60 s) que `useLeagueData` / `useServerEvents` passent en `?token=` à chaque (re)connexion
`EventSource` — le Bearer 30 j n'est jamais mis en query string (voir [REALTIME.md](./REALTIME.md)).

### Flux OAuth (web)
1. « Se connecter avec 42 » → `GET {API_BASE}/auth/web/login?return_to={ORIGIN}/auth/return`.
2. Backend → OAuth intra → retour sur `/auth/return?login=...#token=...`.
3. Le token est dans le **fragment** (`#`) — non transmis au serveur, absent des logs (RGPD Art. 32).
4. `AuthReturnPage` l'extrait, le stocke dans `localStorage`, nettoie l'URL, redirige vers `/challenges`.

Clés `localStorage` : `league:token`, `league:login`, `league:lang`, `league:api_base_override`.

---

## 7. i18n — `lib/i18n.tsx`

**Trois** dictionnaires en dur : **fr**, **en** et **es** (`type Lang = 'fr' | 'en' | 'es'`), composés à
partir de modules par domaine dans `lib/locales/` (`economy.ts` pour boutique/coins/paris/quêtes,
`leaderboard.ts`, `tournois.ts`, `defis.ts`, `profil.ts`, `pages.ts`…). `I18nProvider` stocke `lang`
(persisté dans `localStorage['league:lang']`). À défaut de préférence stockée, détection navigateur :
`es*` → espagnol, `fr*` → français, sinon **anglais** (défaut). `useI18n()` / `t(key)` renvoie la chaîne
traduite (fallback fr si clé absente). Les nouveaux écrans (boutique, G.O.A.T, grades, paris, quêtes,
matchmaking, cinématiques de tournoi) sont traduits dans les **trois** langues.

---

## 8. Composants notables (`src/components/`)

| Catégorie | Composants |
|---|---|
| Layout | `Layout`, `Panel`, `PanelAccent` |
| UI | `Button`, `Pills`, `Avatar`, `Spinner`, `Toast`, `RollingNumber`, `TiltCard` |
| Données | `StatCard`, `TrophiesSection`, `EloChart`, `WinRateBar` (jauge W/L façon OP.GG, variantes `full`/`compact`), `Palmares` (classements par saison), `Badges` (rendu animé des badges, catalogue `lib/badges.ts`), `RankedBadge`, `RankBadge` (pastille de grade ELO + couronne Grand Master) |
| Match UX | `ContestModal` (litige : `never_played`/`wrong_score` + message), `OutcomeButton`, `AbacusSlider` (score), `TimePicker`, `MatchScore`/`GamePill` (pastille colorée par discipline via `GAME_META`) |
| Coins / boutique | `CoinCount` (solde animé : bulle « +N » au gain, glyphe ∞ lemniscate pour les comptes fondateurs), `bets/BetPrimitives`, `shop/CosmeticForm` |
| Statut | `OnlineBadge`, `NotifBanner` (bannière des matchs à confirmer), `NotificationBell` (cloche : centre de notifs in-app, badge non-lues, SSE `notification`), `PlayerLink`, `PlayerHoverCard` (carte joueur au survol) |
| Tournoi / OPS | `TournamentCup` (coupe / case carrée d'un tournoi avec image de couverture), `OpsRevealOverlay` (révélation cinématique de la cible d'un OPS), `tournois/VersusOverlay`, `tournois/CoinFlipOverlay`, `tournois/TournamentLaunchCeremony`, `tournois/BracketTree`, `tournois/TournamentBets` (voir §11) |
| Cinématiques (montées haut, hors page) | `MatchmakingOverlay` (VERSUS du match aléatoire), `ContestRageOverlay` (overlay « rage » à la contestation) |
| Divers | `ErrorBoundary`, `FeatureRequestBox`, `BugReportBox`, `Tooltip` (infobulle au survol), `TesterSwitch` (voir §3) |

La page **Leaderboard** est **par discipline** (le classement, les tournois et les stats suivent le
mode de jeu courant — cf. `useGameMode`/`GAME_META`) et propose **trois** vues commutables
(`RankingViewToggle`) : la **liste** classique, le **nuage de points** (`LeaderboardScatter` — variante
*beeswarm* zoomable/pannable, ELO en ordonnée, chaque avatar cliquable mène au profil) et la vue
**G.O.A.T** inline (cf. §10, masquée tant que la saison consultée n'a aucun match). Un bouton
**« Où suis-je ? »** recentre/zoome chaque vue sur le joueur courant (le nuage l'expose via un handle
impératif). Chaque ligne porte sa **pastille de grade** (`RankBadge`) ; le top N de la discipline
décroche le grade **Grand Master** (couronne) — grade *positionnel*, superposé au barème ELO de
`/grades`. Un **sélecteur de saison** (dispo aussi sur mobile) consulte les classements figés des
saisons passées ; en babyfoot un onglet **équipes** s'ajoute. Le **podium** desktop/mobile applique le
`useFlickSpin` aux avatars (rotation 3D « pièce ») et un reflet diagonal qui balaie les marches.

Autres pages notables : **`H2HPage`** (`/h2h`) — confrontation directe entre deux joueurs (bilan,
historique des duels) ; **`GoatPage`** (`/goat`, voir §10) — palmarès all-time et saisons ;
**`GradesPage`** (`/grades`) — barème ELO illustré, frise des paliers terminée par la bande Grand
Master positionnelle. Le profil joueur (`PlayerPage`) affiche badges, palmarès et un bouton **suivre /
préférences de notif**. Le **profil** (`ProfilPage`) fait tourner sa photo en 3D façon pièce de monnaie
(`useFlickSpin`) et son graphe ELO (`EloChart`) teinte la ligne/les points selon l'**amplitude du
delta** (jaune quand ça stagne → vert/rouge plus saturé sur les gros écarts). Les matchs récents
affichent une **victoire en VERT** (`accent`) / une **défaite en ROUGE** (`red`), quel que soit le
thème du mode.

Primitives mobiles dans `src/mobile/primitives/` (`BottomSheet`, `MobileTabBar`, `FAB`,
`PullToRefresh`, `SwipeableCard`, `Skeleton`, `MetalFrame`/`RivetCorners` pour l'esthétique RPG…)
et système d'animation dans `src/mobile/motion/` (`MotionProvider` respecte `prefers-reduced-motion`,
`PageTransition`, `StaggerList`, `presets`).

---

## 9. Économie de League Coin — boutique, paris, quêtes

Monnaie virtuelle « League Coin ». Le solde vit dans `me.coins` (donc rafraîchi avec le domaine `me`)
et s'affiche partout via **`CoinCount`** (`components/CoinCount.tsx`) :
- **animation « +N »** : le composant détecte chaque *augmentation* du solde et fait monter une bulle
  dorée « +montant » (ignore le montage initial et les baisses → feedback seulement au gain) ;
- **glyphe ∞** : pour les comptes à solde illimité (set `INFINITE_COIN_LOGINS` = `abidaux`, `throbert`),
  le nombre est remplacé par une **lemniscate** animée (ruban dégradé, glints, points en orbite) au lieu
  d'un chiffre.

**Boutique (`/shop`, `ShopPage`)** : carte **solde** en tête, puis le guide **« comment gagner des
coins »** (`EarnGuide`) en **3 méthodes** — *match* (≈ 20–50 / partie), *quêtes* (jusqu'à 850) et *paris*
(×2) — chacune avec son accent de couleur. En dessous, un **filtre par catégorie** (barre d'onglets
`all` + catégories réellement présentes) et la grille d'items avec **rareté déduite du prix**
(common/rare/epic/legendary) et aperçu visuel. Les catégories sont **`title` / `banner` / `badge`** : la
catégorie « cosmétique » générique a été **retirée** (`ShopCategory = 'title' | 'banner' | 'badge'`).
Acheter (`api.buyShopItem`) met à jour le solde et déclenche un `refresh()` ; les items équipables
(titre/bannière/badge) s'équipent/déséquipent (`api.equipItem`).

**ShopGOD (`/shop-god`, `ShopGODPage`)** : éditeur du catalogue cosmétique réservé ADMIN/SUPERADMIN
(formulaire `shop/CosmeticForm`), pour créer/retirer les items vendus en boutique.

**Quêtes hebdo** (`profil/QuestsPanel`) : liste des quêtes de la semaine (`api` → `QuestsResponse`),
chacune avec sa barre de progression `progress/target` et sa récompense en coins.

**Paris** (`profil/BetsPanel` côté joueur — mes paris en cours ; `tournois/TournamentBets` côté tournoi)
: l'onglet **« Parier »** d'un tournoi en cours est décrit en §3 (pari sur le **vainqueur**, ouvert au
début uniquement). Le solde se rafraîchit après résolution d'un pari via le domaine `me` (et le signal
ciblé `panel:update` côté GOD panel) — voir [REALTIME.md](./REALTIME.md).

---

## 10. G.O.A.T (`/goat` + vue inline du classement)

Le **G.O.A.T** (`pages/GoatPage.tsx`) classe les joueurs sur un **Score G.O.A.T** agrégeant plusieurs
mesures pondérées (`lib/goat.ts`, `GOAT_WEIGHTS`). Il existe en **page autonome** (`/goat`, conservée
pour les liens directs) **et** en **vue inline** du classement (`RankingViewToggle`, onglet couronne).

- **En-tête explicatif** (`GoatHeader`) toujours visible : titre + baseline disent ce qu'est la page,
  un bouton « ? » libellé ouvre l'aide (survol = aperçu de la répartition des poids).
- **Modale d'aide** rendue en **portal** (`createPortal` en `fixed inset-0`, toujours centrée),
  fermable par la croix, le fond ou **Échap** ; case « ne plus montrer » (mémorisée dans le storage,
  l'intro ne s'affiche qu'au tout premier passage).
- **Scope saison** : `GoatView` accepte des overrides `leaderboard` / `matches` scopés saison
  (snapshot) ; à défaut il prend les données live. La vue inline est masquée tant que la saison
  consultée n'a aucun match rattaché (`seasonHasMatches`).
- Le G.O.A.T est consultable comme l'une des **vues « nuage »** du classement (cf. §8).

---

## 11. PWA & offline

- Manifest `public/manifest.webmanifest` : `standalone`, icônes 192/512 (+ maskable), raccourcis.
- Service worker (workbox) : assets JS/CSS/HTML/fonts en cache (offline), Google Fonts en
  StaleWhileRevalidate, avatars CDN 42 en CacheFirst (30 j). **Les appels API sont exclus du cache**
  (données live authentifiées). Auto-update silencieux au reload.
- `useViewport().isStandalone` détecte le mode PWA installé.
