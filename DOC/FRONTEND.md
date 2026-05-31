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
| `/trophies` | `TropheesPage` | oui |
| `/profile` | `ProfilPage` | oui |
| `/player/:login` | `PlayerPage` | oui |
| `/history` | `HistoriquePage` | oui |
| `/settings` | `ReglagesPage` | oui |
| `/GOD` | `GODPage` | **ADMIN/SUPERADMIN** |
| `/`, `*` | redirige vers `/challenges` | oui |

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

Le bouton **GOD** (zone admin) n'apparaît dans la nav que si `me.role` est ADMIN/SUPERADMIN
(`DesktopShell` sidebar / `MobileHeader`). C'est de l'UX, pas de la sécurité — le contrôle réel est
backend (voir [SECURITY.md §3](./SECURITY.md)).

Le **GOD panel** (`pages/GODPage.tsx`) regroupe les onglets de modération (users, audit log, matchs
litigieux, suspicion anti-triche, idées). Un onglet **Pending**, visible **SUPERADMIN uniquement**,
ajoute la gestion forte de la ligue : forcer/annuler un match en attente, forcer un résultat, créer ou
supprimer un faux joueur, et le reset complet (phrase de confirmation). Chaque onglet se rafraîchit en
temps réel via `useServerEvents(['data:update', 'panel:update'])` (rechargement silencieux quand un
autre admin agit). Les appels correspondants sont les méthodes `admin*` de `lib/api.ts` (voir §6).

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
| `useServerEvents` | Abonnement SSE **local** à un sous-ensemble d'événements (hors `useLeagueData`), avec debounce. Utilisé par le GOD panel pour rafraîchir chaque onglet en silence. Détails dans [REALTIME.md §6](./REALTIME.md). |

---

## 6. Client API — `lib/api.ts`

Objet `api` singleton. `request<T>(path, init, {auth})` :
- injecte `Authorization: Bearer <token>` (depuis `localStorage`) si `auth` ;
- pose `content-type: application/json` si body ;
- `401` → `AuthError` (purge token + logout en amont) ; non-2xx → `Error` avec status + body.

Il couvre tous les endpoints du backend (voir [API.md](./API.md)) : `me`, `leaderboard`,
matchs (`declareMatch`, `confirmMatch`, `rejectMatch`), `challenges` (`create/accept/decline/record`),
`ops`, `tournaments` (CRUD + record/confirm + `addTournamentPlayer`), profils, `locations`,
et les routes admin (`adminUsers`, `adminSetStats`, `adminBan/Unban`, `adminDeleteMatch`,
`adminEditMatch`, `adminRejectedMatches`, `adminSuspicious`, `adminAuditLog`), `featureRequests`.

**Actions SUPERADMIN** (ajoutées avec le GOD panel renforcé) : `adminCreateUser(login, opts?)`,
`adminDeleteUser(login)` (faux comptes `ftId === null` uniquement), `adminResetDatabase(confirm)`,
`adminForceResult(playerA, playerB, scoreA, scoreB)`, `adminForceConfirmMatch(id)`,
`adminForceCancelMatch(id)`. Le type `AdminUser.ftId` est `number | null` (`null` = faux compte).

### Flux OAuth (web)
1. « Se connecter avec 42 » → `GET {API_BASE}/auth/web/login?return_to={ORIGIN}/auth/return`.
2. Backend → OAuth intra → retour sur `/auth/return?login=...#token=...`.
3. Le token est dans le **fragment** (`#`) — non transmis au serveur, absent des logs (RGPD Art. 32).
4. `AuthReturnPage` l'extrait, le stocke dans `localStorage`, nettoie l'URL, redirige vers `/challenges`.

Clés `localStorage` : `league:token`, `league:login`, `league:lang`, `league:api_base_override`.

---

## 7. i18n — `lib/i18n.tsx`

**Trois** dictionnaires en dur : **fr**, **en** et **es** (`type Lang = 'fr' | 'en' | 'es'`).
`I18nProvider` stocke `lang` (persisté dans `localStorage['league:lang']`). À défaut de préférence
stockée, détection navigateur : `es*` → espagnol, `fr*` → français, sinon **anglais** (défaut).
`useI18n()` / `t(key)` renvoie la chaîne traduite (fallback fr si clé absente).

---

## 8. Composants notables (`src/components/`)

| Catégorie | Composants |
|---|---|
| Layout | `Layout`, `Panel` |
| UI | `Button`, `Pills`, `Avatar`, `Spinner`, `Toast` |
| Données | `StatCard`, `TrophiesSection` (classement des plus titrés + tri par catégorie/joueur), `EloChart`, `WinRateBar` (jauge victoires/défaites responsive façon OP.GG — variantes `full`/`compact`) |
| Match UX | `ContestModal` (litige : `never_played`/`wrong_score` + message), `OutcomeButton`, `AbacusSlider` (score), `TimePicker` |
| Statut | `OnlineBadge`, `NotifBanner` (bannière temps réel des matchs à confirmer), `PlayerLink` |
| Divers | `ErrorBoundary`, `FeatureRequestBox`, `Tooltip` (infobulle au survol) |

La page **Leaderboard** propose deux vues commutables (`RankingViewToggle`) : la liste classique et
`LeaderboardScatter` — un **nuage de points** zoomable/pannable (ELO en ordonnée, matchs joués en
abscisse, chaque avatar cliquable mène au profil).

Primitives mobiles dans `src/mobile/primitives/` (`BottomSheet`, `MobileTabBar`, `FAB`,
`PullToRefresh`, `SwipeableCard`, `Skeleton`, `MetalFrame`/`RivetCorners` pour l'esthétique RPG…)
et système d'animation dans `src/mobile/motion/` (`MotionProvider` respecte `prefers-reduced-motion`,
`PageTransition`, `StaggerList`, `presets`).

---

## 9. PWA & offline

- Manifest `public/manifest.webmanifest` : `standalone`, icônes 192/512 (+ maskable), raccourcis.
- Service worker (workbox) : assets JS/CSS/HTML/fonts en cache (offline), Google Fonts en
  StaleWhileRevalidate, avatars CDN 42 en CacheFirst (30 j). **Les appels API sont exclus du cache**
  (données live authentifiées). Auto-update silencieux au reload.
- `useViewport().isStandalone` détecte le mode PWA installé.
