# Tests — 42 League

Deux niveaux de tests, tournés avec **Vitest**.

| Niveau | Où | DB ? | Commande |
|---|---|---|---|
| **Unitaires** | `packages/shared/src/*.test.ts`, `apps/backend/src/*.test.ts` | non | `npm test` (racine, tous les workspaces) |
| **Intégration HTTP** | `apps/backend/test/*.itest.ts` | oui (Postgres de test) | `npm run test:integration -w @42-league/backend` |

Les unitaires ne touchent aucune infra et tournent partout (CI incluse). Les tests d'intégration
appellent les vraies routes Hono contre une vraie base Postgres jetable.

---

## 1. Tests unitaires

- **`packages/shared`** : cœur métier sans I/O.
  - `elo.test.ts` — matrice de cas du calcul ELO (somme nulle, marges, upsets, bornes).
  - `anti-farming.test.ts` — bornes de la fenêtre glissante, quota par paire.
  - `schemas.test.ts` — validation Zod exhaustive (formats login, scores, refines).
- **`apps/backend`** : helpers purs, sans DB.
  - `tokens.test.ts` — émission/vérification HMAC, expiration, `timingSafeEqual`.
  - `whitelist.test.ts`, `admins.test.ts` — gating.
  - `cors-origins.test.ts` — origines autorisées.
  - `sse.test.ts` — registre, emit/broadcast.

Lancer : `npm test` à la racine (délègue à chaque workspace via `--workspaces --if-present`).
À ce jour : **261 tests shared + 104 tests backend** au vert.

---

## 2. Tests d'intégration HTTP

Valident le comportement réel des routes (auth, permissions, validation, transitions d'état,
validation bilatérale, anti-farming, dodge) **bout en bout contre Postgres**.

### Config — `apps/backend/vitest.integration.config.ts`
- `include: ['test/**/*.itest.ts']`.
- `globalSetup: ['./test/global-setup.ts']` → applique le schéma via `prisma migrate deploy`.
- `fileParallelism: false` (une seule DB partagée ; chaque test fait un `TRUNCATE` en `beforeEach`).
- Variables d'env de test injectées : `NODE_ENV=test` (empêche `index.ts` de démarrer le serveur HTTP
  + les timers de fond), `ALLOW_DEV_LOGIN=true` (auth de test via `x-dev-login`),
  `SESSION_SECRET=...`, `DATABASE_URL` (défaut `postgresql://test:test@localhost:55432/league_test`).

### Harness — `apps/backend/test/helpers.ts`
- `resetDb()` — `TRUNCATE ... RESTART IDENTITY CASCADE` sur toutes les tables (isolation entre tests).
- `seedUser(login, opts)` — crée un user directement en DB (avec `imageUrl` pour éviter le fetch 42 en
  arrière-plan). `seedUsers(...)` pour plusieurs.
- `api(method, path, { login, body, headers })` — appelle `app.request(...)` ; `login` pose l'en-tête
  `x-dev-login`. Raccourcis : `get`, `post`, `put`, `del`. `futureISO(min)` pour les `scheduledAt`.

L'app est importée **sans démarrer de serveur** (`app.request()` de Hono) — d'où `NODE_ENV=test`.

### Fichiers de test
- `test/smoke.itest.ts` — valide l'infra (health, auth `x-dev-login`, isolation `resetDb`).
- `test/matches.itest.ts` — déclaration (auth/self/score/ban), confirmation (404/403, miroir → ELO,
  mismatch → 409 + pending supprimé), rejet, **anti-farming** (3ᵉ match non compté).
- `test/challenges.itest.ts` — create/accept/decline/record, permissions, transitions (409),
  **dodge** (pénalité ELO sur défi accepté).

À ce jour : **29 tests d'intégration** au vert.

---

## 3. Lancer la base de test (local)

Un conteneur Postgres jetable sur le port **55432** (distinct du Postgres de dev sur 5432) :

```bash
docker run -d --name league-test-db \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=league_test \
  -p 55432:5432 postgres:16-alpine
# (s'il existe déjà : docker start league-test-db)

npm run test:integration -w @42-league/backend
```

`global-setup.ts` applique les migrations (idempotent). Si le schéma Prisma change, les migrations
sont rejouées automatiquement au prochain run.

> Piège classique : si `tsc`/Vitest se plaint de types Prisma manquants (ex. un champ récent comme
> `anonymizedAt`), lance `npm run db:generate -w @42-league/backend` pour régénérer le client.

---

## 4. État & pistes (voir `pending.md`)

- [x] Tests d'intégration HTTP (déclaration, confirmation, anti-farming, défis).
- [ ] Couvrir les **tournois** et les routes **admin** en intégration.
- [ ] **Rate-limiting** + tests associés.
- [ ] CI : lint + typecheck + tests (unitaires) sur PR ; brancher un service Postgres pour l'intégration.
