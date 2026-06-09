# Stack technique — 42 League

Document de référence. Décrit toute la stack : front, back, base de données, Docker, déploiement. Chaque info est explicite.

---

## 1. Vue d'ensemble

42 League est une application de ligue multi-disciplines (défis, matchs, classement ELO, tournois).
Les disciplines sont définies dans `packages/shared/src/games.ts` (`GAMES`) : **Babyfoot**, **Smash**,
**Échecs**, **Street Fighter** et **Fléchettes** (cette dernière multijoueur, 2 à 8, 301/501). Chaque
discipline a son propre rating ELO, ses compteurs et son branding ; le babyfoot est la valeur par défaut.

Le dépôt est un **monorepo npm workspaces**. Node.js `>=20`. TypeScript `^5.6` partout.

Workspaces :
- `apps/web` — front React (le site).
- `apps/backend` — API HTTP (Hono).
- `apps/extension` — extension navigateur (Chrome/Firefox).
- `packages/shared` — code partagé front/back (schémas Zod + calcul ELO).

Le `package.json` racine expose : `npm run build`, `npm run test`, `npm run typecheck` (chacun délègue à tous les workspaces via `--workspaces --if-present`).

---

## 2. Frontend (`apps/web`)

- **Framework** : React 18 + react-router-dom 6.
- **Build** : Vite 5. Script `build` = `tsc -b && vite build`.
- **Découpage des bundles (perf)** : `vite.config.ts` isole les grosses dépendances dans des
  **chunks vendor** via `build.rollupOptions.output.manualChunks` : `vendor-react`
  (`react`, `react-dom`, `react-router-dom`) et `vendor-motion` (`framer-motion`). Ces chunks,
  rarement modifiés, restent en cache navigateur entre les déploiements et allègent le bundle applicatif.
- **CSS** : TailwindCSS 3 (+ PostCSS, autoprefixer).
- **Animations** : framer-motion 11.
- **Icônes** : lucide-react.
- **Gestes tactiles** : @use-gesture/react.
- **PWA** : vite-plugin-pwa + workbox-window. Un service worker est généré au build (`dist/sw.js`).
- **Sortie du build** : fichiers statiques dans `apps/web/dist`.

Communication avec l'API :
- Client HTTP : `fetch` natif (pas d'axios, pas de react-query). Fichier `apps/web/src/lib/api.ts`.
- URL de base de l'API : variable `VITE_API_BASE_URL`, injectée **au moment du build** (build-time). Fichier `apps/web/src/lib/config.ts`. Défaut local : `http://localhost:3000`.
- Auth : un token (Bearer) est stocké dans `localStorage` et envoyé dans l'en-tête `Authorization`.
- Données de la ligue : centralisées dans le contexte React `useLeagueData` (`apps/web/src/hooks/useLeagueData.tsx`).

Temps réel :
- Le front ouvre un `EventSource` (SSE) sur `GET /events?token=...` (le token passe en query car `EventSource` ne peut pas envoyer d'en-tête `Authorization`).
- À chaque événement reçu, le front re-fetch uniquement la tranche de données concernée (mapping `EVENT_DOMAINS`).
- `EventSource` se reconnecte automatiquement.

---

## 3. Backend (`apps/backend`)

- **Framework** : Hono 4, servi par `@hono/node-server`.
- **Runtime** : `tsx`. Le code TypeScript est exécuté directement, **sans étape de compilation**. Pas de dossier `dist` backend.
- **Validation** : Zod (schémas partagés depuis `@42-league/shared`).
- **Port** : `3000` (variable `PORT`).
- **Point d'entrée** : `apps/backend/src/index.ts`.

Scripts (`apps/backend/package.json`) :
- `dev` : `tsx watch --env-file=../../.env src/index.ts`.
- `start` : `tsx --env-file=../../.env src/index.ts`.
- `db:migrate`, `db:reset`, `db:seed`, `db:studio`, `db:generate` : commandes Prisma (lisent `.env` racine via `dotenv-cli`).
- `db:add-players` : ajoute 8 faux joueurs de test (idempotent ; `db:add-players:prod` sans `dotenv`). Voir [DATABASE.md §4](./DATABASE.md).

Authentification (42 OAuth) — routes sous `/auth` (`apps/backend/src/auth.ts`) :
- `GET /auth/login` — démarre le flux OAuth intra 42.
- `GET /auth/callback` — retour OAuth ; crée/maj l'utilisateur.
- `GET /auth/web/login` — flux pour le site web.
- `GET /auth/extension/login` — flux pour l'extension.
- `POST /auth/logout`.
- Deux mécanismes de session acceptés : token signé en en-tête `Bearer` **ou** cookie de session signé (`httpOnly`, `SameSite=Lax`). Secret : `SESSION_SECRET`.

Temps réel (SSE) — `apps/backend/src/sse.ts` + endpoint `GET /events` :
- Registre en mémoire : `login` → connexions SSE actives.
- `emit([logins], event)` : envoi ciblé à des joueurs précis.
- `broadcast(event)` : envoi à tous les clients connectés.
- Événements ciblés : `match:*`, `challenge:*`, `ops:update` (émis dans les handlers).
- Événements globaux diffusés à tous : `leaderboard:update`, `tournament:update`, `data:update`.
- Ping keep-alive toutes les 25 s.
- Expiration des ops : timers serveur (`setTimeout`) qui émettent `ops:update` à l'expiration et à la fin du cooldown ; ré-armés au démarrage du serveur.

API externe :
- Appels à l'API intra 42 (`apps/backend/src/ft-api.ts`) pour récupérer profils et images.

---

## 4. Package partagé (`packages/shared`)

- Importé sous le nom `@42-league/shared` par le front et le back.
- Consommé **en source** : `main`/`types` pointent vers `./src/index.ts` (pas de build dédié).
- Contenu : schémas Zod (validation des payloads) + logique ELO (`calculateBabyfootElo`, `shouldCountForElo`,
  `estimatedEloLoss`) + constantes OPS partagées (`OPS_DURATION_MS` = 24 h, `OPS_FORCED_MATCHES` = 3,
  `OPS_REFUSE_MULTIPLIER` = 3).

---

## 5. Base de données

- **SGBD** : PostgreSQL 16 (image `postgres:16-alpine`).
- **ORM** : Prisma 5 (`@prisma/client`).
- **Connexion** : variable `DATABASE_URL`. En conteneur : `postgresql://league:league@postgres:5432/league?schema=public`.
- **Schéma** : `apps/backend/prisma/schema.prisma`.
- **Génération du client** : `prisma generate`. Obligatoire avant typecheck/exécution (sinon les types Prisma sont `any`).
- **Migrations** : dossier `apps/backend/prisma/migrations`. Appliquées en prod par `prisma migrate deploy` (lancé au démarrage du conteneur backend).

Modèles (tables) :
- `User`, `Challenge`, `PendingMatch`, `PlayedMatch`, `RejectedMatch`.
- `Tournament`, `TournamentEntry`, `TournamentMatch`.
- `Ops`, `FeatureRequest`, `AdminAuditLog`.
- `Notification`, `UserBadge`, `Follow`, `Season`, `SeasonStanding` (centre de notifs, badges, suivi, saisons).
- `PendingFfa`/`PlayedFfa` (+ participants) et `BabyfootTeam` (FFA Smash, modes 2v2).
- `ShopItem`, `ShopInventory`, `WeeklyQuestProgress`, `Bet`, `MatchmakingQueue` (économie League Coins, quêtes, paris, file de matchmaking).
- Enums : `Role` (`USER`, `MODERATOR`, `ADMIN`, `SUPERADMIN`), `AdminAction`.

Identifiants Postgres (dev et conteneur) : user `league`, mot de passe `league`, base `league`.

---

## 6. Docker

Trois fichiers compose, pour trois usages.

### `docker-compose.yml` — développement local
- Lance **uniquement** Postgres (image `postgres:16-alpine`).
- Port exposé : `5432`.
- Volume : `league_pgdata`.
- Le front et le back tournent en local (hors Docker) via npm.

### `docker-compose.prod.yml` — build local + run
- `postgres` : Postgres 16, volume `league_pgdata`, `restart: always`.
- `backend` : **construit** depuis `apps/backend/Dockerfile`. Lit `.env`. `DATABASE_URL` et `PORT=3000` en variables. Démarre après que Postgres soit `healthy`.
- `frontend` : **construit** depuis `apps/web/Dockerfile`. `VITE_API_BASE_URL` passé en build-arg (`https://oneleague.fr/api`).
- `caddy` : image `caddy:alpine`. Ports `80` et `443`. Monte `./Caddyfile`. Volumes `caddy_data`, `caddy_config`.

### `docker-compose.registry.yml` — déploiement serveur (images pré-construites)
- Identique à `prod`, mais `backend` et `frontend` utilisent des **images GHCR** au lieu d'être construits :
  - `ghcr.io/42-league-corp/42_league-backend:latest`
  - `ghcr.io/42-league-corp/42_league-frontend:latest`
- `caddy` expose `80`, `443` et `3000`.
- C'est ce fichier qui tourne en production.

> **Images de base via le miroir AWS ECR Public.** Les deux Dockerfiles tirent leurs images de base
> depuis `public.ecr.aws/docker/library/...` (`node:20-alpine`, `nginx:alpine`) plutôt que depuis le
> Docker Hub. **Pourquoi** : `registry-1.docker.io` impose des *rate-limits* anonymes qui font
> échouer le build CI par intermittence (`dial tcp ... i/o timeout` sur `node:20-alpine`). ECR Public
> est un miroir officiel du Docker Hub, sans ces limites. **Où** : `apps/backend/Dockerfile` et
> `apps/web/Dockerfile` (les `FROM`), introduit dans le commit *images de base via miroir AWS ECR Public*.

### Dockerfile frontend (`apps/web/Dockerfile`)
- Étape 1 (`public.ecr.aws/docker/library/node:20-alpine`) : `npm install`, puis `npm run build -w @42-league/web`. `VITE_API_BASE_URL`, `APP_BUILD` (= nombre de commits git) et `APP_DATE` injectés en build-arg.
- Étape 2 (`public.ecr.aws/docker/library/nginx:alpine`) : copie `dist` dans `/usr/share/nginx/html`. Config Nginx (`apps/web/nginx.conf`) avec fallback SPA (`try_files ... /index.html`) + en-têtes de cache (assets hashés immuables 1 an, `index.html`/`sw.js` revalidés). Écoute le port `80`.

### Dockerfile backend (`apps/backend/Dockerfile`)
- Étape 1 (`public.ecr.aws/docker/library/node:20-alpine`) : installe `openssl`+`libc6-compat`, `npm install`, `prisma generate`.
- Étape 2 (`public.ecr.aws/docker/library/node:20-alpine`) : réinstalle `openssl`+`libc6-compat`, copie `node_modules`, `packages`, `apps/backend`. Reçoit `CONTRIBUTOR_STATS` (JSON des stats git, cf. CI §8) en build-arg → variable d'env. **Tourne en `USER node`** (non-root, cache npm/npx redirigé vers `/tmp`). Écoute le port `3000`.
- Démarrage : `prisma migrate deploy && tsx src/index.ts` (migration auto puis lancement).

---

## 7. Reverse proxy (Caddy)

Fichier `Caddyfile` :
```
oneleague.fr {
    reverse_proxy /api/* backend:3000
    reverse_proxy frontend:80
}
```
- Domaine : `oneleague.fr`. Caddy gère le **TLS automatiquement** (Let's Encrypt) sur `443`.
- Les requêtes `/api/*` vont au conteneur `backend` sur `3000`.
- Tout le reste va au conteneur `frontend` sur `80` (le site).

⚠️ Point d'attention explicite : `reverse_proxy /api/*` **ne retire pas** le préfixe `/api` avant de transmettre. Le backend reçoit donc `/api/...`. Or les routes backend sont définies à la racine (`/me`, `/events`, etc.), sans préfixe `/api`. Pour que ça fonctionne, il faut soit utiliser `handle_path /api/*` (qui retire le préfixe), soit préfixer les routes backend. À vérifier sur l'environnement déployé.

---

## 8. Déploiement (CI/CD)

Serveur de prod : `163.172.141.178`, utilisateur SSH `root`, dossier `/opt/42_league`.

Registre d'images : GitHub Container Registry (`ghcr.io/42-league-corp/...`).

Deux environnements isolés : **prod** (`main` → `:main`, `/opt/42_league`) et **staging**
(`develop` → `:develop`, `/opt/42_league_staging`). Détail complet de l'architecture dans
[architecture-ci-cd.md](./architecture-ci-cd.md).

### Workflow `.github/workflows/deploy-prod.yml`
Déclenché sur :
- `push` sur `main`.
- `workflow_dispatch` manuel (input `deploy_only`, défaut `true` = déployer les images `:main` existantes sans rebuild).

Jobs :
1. **`changes`** : `dorny/paths-filter` détermine si `backend` et/ou `frontend` ont changé (`apps/backend/**`, `apps/web/**`, `packages/**`).
2. **`build-backend`** / **`build-frontend`** (sautés si `deploy_only=true`) :
   - Login GHCR.
   - **Contributor git stats** : `bash .github/scripts/contributor-stats.sh` calcule les lignes ajoutées/supprimées des founders (groupées par e-mail, `--no-merges`) et l'injecte en build-arg `CONTRIBUTOR_STATS` dans l'image backend (la prod n'a ni `.git` ni binaire `git` ; lu par l'endpoint `/contributors/stats`). Le checkout se fait en `fetch-depth: 0` (historique complet, aussi pour le numéro de build front).
   - `docker/build-push-action` : build + push, tags `:main`, `:latest` et `:${sha}`. Images de base via le miroir AWS ECR Public (cf. §6).
   - Le front reçoit `VITE_API_BASE_URL` depuis `secrets.VITE_API_BASE_URL` + `APP_BUILD`/`APP_DATE` au build.
   - Scan de sécurité **Trivy** (`aquasecurity/trivy-action@v0.24.0`), sévérités `CRITICAL,HIGH`, en `continue-on-error`. Résultats SARIF envoyés dans l'onglet Security GitHub.
3. **`deploy`** :
   - `scp` de `docker-compose.registry.yml`, `Caddyfile`, `Makefile.server` vers `/opt/42_league/` sur le serveur.
   - `ssh` : login GHCR, renomme `Makefile.server` en `Makefile`, **valide le `Caddyfile`** dans un conteneur jetable (zéro downtime : un Caddyfile invalide abort le deploy), nettoie le disque, puis `docker compose -f docker-compose.registry.yml pull` et `up -d --remove-orphans`, recrée Caddy, puis `docker image prune -af`.

Secrets GitHub utilisés : `GITHUB_TOKEN` (push GHCR), `SSH_PRIVATE_KEY` (accès serveur), `VITE_API_BASE_URL` (build front).

> Les actions GitHub utilisées sont sur le **runtime Node 24** (checkout v5, setup-node v5, codeql v4,
> paths-filter v4, docker login v4 / build-push v7).

### Autres workflows
- `deploy-staging.yml` : même pipeline, déclenché sur `push` sur `develop` → images `:develop`/`:dev-<sha>` (front baké avec `https://staging.oneleague.fr/api`), déployé dans `/opt/42_league_staging`.
- `force-build-deploy.yml` : rebuild forcé des deux images (sans paths-filter) + redéploiement prod (`workflow_dispatch`).
- `ci.yml` : lint / typecheck / tests (unitaires + intégration) sur PR.
- `build.yml` : build/push manuel des images (`workflow_dispatch`, choix backend/frontend/both).
- `codeql.yml` : analyse statique CodeQL.
- `dependency-audit.yml` : audit des dépendances.
- `security-alerts.yml` : alertes de sécurité ponctuelles + résumé.
- `daily-security-audit.yml` : rapport sécurité quotidien consolidé → Discord (tests + npm audit + sondes live + CodeQL).

---

## 9. Variables d'environnement (`.env` racine)

Modèle : `.env.example`. Copier en `.env`.

| Variable | Rôle |
|---|---|
| `FT_OAUTH_UID` | ID app OAuth intra 42. |
| `FT_OAUTH_SECRET` | Secret app OAuth intra 42. |
| `FT_OAUTH_REDIRECT_URI` | URL de callback OAuth (ex. `http://localhost:3000/auth/callback`). |
| `PORT` | Port du backend (`3000`). |
| `WEB_APP_URLS` | Origines autorisées (CORS + `redirect_to`), séparées par des virgules. |
| `SESSION_SECRET` | Secret de signature des tokens et cookies de session. |
| `DATABASE_URL` | URL de connexion PostgreSQL. |
| `ACCOUNT_GRACE_DAYS` | Période de grâce avant anonymisation d'un compte supprimé (RGPD Art. 17). Optionnel, **défaut 30**. |

---

## 10. Flux d'une requête en production

1. Le navigateur charge le site depuis `https://oneleague.fr` → Caddy → conteneur `frontend` (Nginx) → fichiers statiques React.
2. Le front appelle l'API sur `https://oneleague.fr/api/...` → Caddy (`/api/*`) → conteneur `backend` (Hono, port 3000).
3. Le backend lit/écrit dans PostgreSQL via Prisma.
4. Le front maintient une connexion SSE (`/events`) ; le backend pousse les changements ; le front re-fetch la donnée concernée.

---

## 11. Démarrage local (résumé)

1. `cp .env.example .env` puis remplir les valeurs.
2. `npm install` (à la racine).
3. `docker compose up -d` (lance Postgres).
4. `npm run db:generate -w @42-league/backend` puis `npm run db:migrate -w @42-league/backend`.
5. `npm run dev -w @42-league/backend` (API sur `:3000`).
6. `npm run dev -w @42-league/web` (site sur `:5173`).
