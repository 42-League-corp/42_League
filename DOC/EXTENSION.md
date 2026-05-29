# Extension navigateur — 42 League

Extension **MV3** (Chrome/Firefox) qui injecte 42 League directement dans l'intra 42.
Code : `apps/extension`. Build : Vite 5 + `@crxjs/vite-plugin`.

---

## 1. Manifest (`manifest.config.ts`)

Manifest V3, généré à partir d'un fichier TS (typé), puis patché pour Firefox par `patch-manifest.js`
(ajout de `background.scripts` + `data_collection_permissions`).

- **permissions** : `storage` (token + config), `identity` (`launchWebAuthFlow`), `tabs`.
- **host_permissions** : `https://intra.42.fr/*`, `https://*.intra.42.fr/*`, `https://api.intra.42.fr/*`,
  le backend prod (`http://163.172.141.178:3000/*`), et en dev `localhost:3000` / `localhost:5173`.
- **content_scripts** :
  - `src/content/intra.ts` sur `intra.42.fr` (+ sous-domaines campus) — widget de matchs/défis.
  - `src/content/intra-profile.ts` sur `profile.intra.42.fr/users/*` — badge ELO + carte skill babyfoot.
- **background.service_worker** : `src/background/index.ts` (module ES) — OAuth + proxy API.
- **action** (popup) : `src/popup/index.html` + `index.ts`.
- **web_accessible_resources** : icônes injectées dans l'intra.
- **Firefox** : id `42league@42league.fr`, min 140.0, `data_collection_permissions: none`.

Build sur le port dev **5180** (ne collisionne pas avec le site sur 5173), sortie `dist/`,
sourcemaps activées.

---

## 2. Background service worker (`src/background/index.ts`)

Seul composant autorisé à appeler le backend (les content scripts passent par lui). Gère :
- `auth:login` → construit `chrome.identity.getRedirectURL()` comme `ext_redirect`, appelle
  `{backend}/auth/extension/login?ext_redirect=...`, lance `chrome.identity.launchWebAuthFlow({interactive:true})`,
  extrait `token` + `login` de l'URL de retour, les stocke dans `chrome.storage.local`.
- `auth:logout`, `auth:status`.
- `api:proxy` → exécute la requête HTTP réelle pour le content script et renvoie la réponse.

> Le token est un **Bearer HMAC-SHA256** émis par le backend (TTL 30 j) — même mécanisme que le site
> (voir [SECURITY.md §7](./SECURITY.md)). Pas de refresh automatique ; un `401` purge le token.

---

## 3. Client API (`src/lib/api.ts`)

Objet `api` typé couvrant les mêmes endpoints que le site (matchs, défis, ops, tournois, profils,
leaderboard…). Détecte s'il tourne dans un content script (page http) → **proxy via le background**
(`api:proxy`) ; sinon (popup/background) appelle directement avec le Bearer depuis le storage.
`401` → `AuthError` + purge.

Base URL : `chrome.storage.local['league_api_base']` (configurable), défaut `DEFAULT_API_BASE_URL`
(`config.ts` : env `VITE_API_BASE_URL` ou IP prod).

> ⚠️ L'extension est **auto-suffisante** : elle **ne** dépend **pas** de `@42-league/shared`. Les types
> sont redéfinis dans `lib/api.ts` (contrainte de bundling CRXJS / contexte module navigateur).

---

## 4. Content script intra (`src/content/intra.ts`)

Le gros morceau (~1400 lignes). Injecte un widget dans la page intra, ancré dans la section
« évaluations à venir » (sinon non rendu — dégradation gracieuse). Sections :
1. **Défis** (⚔️) : reçus (accepter/refuser), envoyés (annuler), acceptés (saisir le score).
2. **Scores à confirmer** : inputs pré-remplis du score déclaré, valider (ressaisie) ou contester.
3. **Matchs pending** : « en attente adversaire » (lecture seule) quand c'est moi qui ai déclaré.
4. **Bannière de notif** : fixée en haut-droite, pulse, quand ≥1 match attend ma confirmation.

Détails : tooltips joueurs au survol (ELO, rang, W/L, titre, ops) via `lib/tooltip.ts`, dialogues de
contestation via `lib/confirm.ts`, toasts inline. **Polling toutes les 30 s** (`me`, `challenges`,
`pendingMatches`, `playedMatches`, `leaderboard`, `ops`). Styles injectés dans le `<head>`
(`src/content/styles.ts`, thème clair teal/or/rouge pour matcher l'intra — **pas** de Shadow DOM).
Un `MutationObserver` réinjecte le widget après les navigations pjax/turbolinks de l'intra.

---

## 5. Content script profil (`src/content/intra-profile.ts`)

Sur `profile.intra.42.fr/users/<login>` : extrait le login de l'URL, fetch `userProfile(login)` +
`leaderboard`, puis injecte :
- un **badge ELO** « ⚔ 42 League · 1250 ELO » près du nom (lien vers la page joueur du site) ;
- une **carte skill « Babyfoot 42 League »** dans la section Skills (barre de progression style intra,
  rang, W/L, titre). Échoue silencieusement si non authentifié. Re-run sur navigation pjax.

---

## 6. Popup (`src/popup/`)

Petit panneau de l'icône d'extension. 3 modes : `anon`, `connecting`, `connected`. Affiche avatar,
login, ELO (si connecté). Boutons : ouvrir le site (focus l'onglet existant ou en ouvre un), se
connecter / se déconnecter, ouvrir l'intra. Affiche l'URL du site configurée + erreurs éventuelles.

---

## 7. Librairies partagées (`src/lib/`)

| Fichier | Rôle |
|---|---|
| `storage.ts` | `getToken/setToken/clearToken/getLogin` (clés `league_token`, `league_login`). |
| `config.ts` | `getApiBase/setApiBase/resetApiBase` (URL backend configurable). |
| `auth-bridge.ts` | IPC content↔background : `login()`, `logout()`, `status()`. |
| `api.ts` | Client API + `AuthError` + types. |
| `tooltip.ts` | Carte joueur au survol (positionnement dynamique). |
| `confirm.ts` | Dialog de confirmation générique (Enter/Escape, backdrop). |

---

## 8. État restant (voir `pending.md`)

- [ ] Auto-complétion du login adversaire (DOM intra).
- [ ] Optimiser `42_league.png` (générer 16/32/48/128 séparément ; l'actuel fait ~2.4 MB).
- [ ] Tester sur Firefox (`browser.identity.launchWebAuthFlow`).
