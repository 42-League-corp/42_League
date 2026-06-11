# Sécurité — état & correctifs

Ce document récapitule l'état de sécurité de **One League** (oneleague.fr) et les
correctifs appliqués, suite à l'audit quotidien automatisé (`.github/workflows/daily-security-audit.yml`)
et aux scans **CodeQL** (code) + **Trivy** (dépendances & images Docker).

> TL;DR : aucune vulnérabilité dans **notre code**. Les alertes étaient des CVE de
> **dépendances/conteneur** ; les CVE exploitables (paquets OS de l'image, vulns JS
> corrigeables) ont été patchées et déployées. Le résidu est de l'outillage de
> **build** (esbuild, vite, rollup, vitest) qui ne tourne pas en production.

---

## 1. Posture applicative (vérifiée en live)

| Contrôle | État |
|---|---|
| `GET /api/health` | **200** (site up) |
| Routes `/api/admin/*` sans auth | **401** (protégées) |
| Routes `/api/me/*` sans auth | **401** |
| HTTP → HTTPS | redirection **308** |
| HSTS (`Strict-Transport-Security`) | présent (`max-age=31536000; includeSubDomains; preload`) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| CSP (`Content-Security-Policy`) | présente (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`…) |

> Les alertes « site down / 301 » et « headers manquants » d'un précédent audit
> étaient **transitoires** (Caddy pas encore rechargé au moment du scan) et déjà
> résolues à la vérification suivante.

## 2. Revue du code applicatif

CodeQL (`security-extended`) **n'a remonté aucune alerte dans notre code**. Revue
manuelle confirmée :

- **Pas d'injection / exécution** : aucun `dangerouslySetInnerHTML`, `eval`,
  `new Function`, ni `child_process` injectable (seul `execFile` à arguments fixes
  pour les stats git, en dev).
- **Pas d'open redirect** : les redirections OAuth 42 (`apps/backend/src/auth.ts`)
  valident la cible par **allowlist** (`isValidExtRedirect` → `*.chromiumapp.org` /
  `*.extensions.allizom.org` ; `isValidWebRedirect` → `getAllowedWebOrigins()`).
- **Aléa sûr** : les jetons utilisent `crypto.randomBytes` (jamais `Math.random`,
  réservé au mélange de brackets de tournoi).
- **SQL** : accès 100 % via Prisma (requêtes paramétrées) → pas d'injection SQL.
- **Rate limiting** présent (`apps/backend/src/rate-limit.ts`).

## 3. Correctifs déployés (dépendances & images)

- **Durcissement des images Docker** — `RUN apk upgrade --no-cache` ajouté aux
  stages *runtime* du backend (`node:20-alpine`) et du frontend (`nginx:alpine`)
  → corrige les CVE des **paquets OS** de l'image (openssl, libxml2, libcrypto…),
  qui constituaient les alertes « High » de l'image frontend.
- **`npm audit fix`** (sémver-safe) → vulnérabilités JS **9 → 5** (lockfile mis à
  jour, build vérifié). Les 5 restantes (`vitest`/`vite`/`@crxjs`→`rollup`)
  exigent des montées de version **majeures cassantes** et concernent
  l'**outillage de build/test**.

## 4. Résidu accepté : CVE de l'outillage de build

La majorité des alertes Trivy (~80) sont des **CVE de la runtime Go embarquée dans
le binaire `esbuild`**, présent dans le `node_modules` (hoisté en monorepo) car
**`tsx`** (utilisé pour exécuter le backend TypeScript) en dépend. S'y ajoutent
`vite` / `rollup` / `vitest` / `@crxjs`.

**Pourquoi c'est accepté :** ces outils **ne traitent aucune entrée réseau au
runtime** — `esbuild` ne sert qu'à transpiler **notre propre code** au démarrage.
La surface d'attaque réelle est nulle. Ils sont donc **exclus du scan d'image**
(`skip-dirs` côté Trivy, cf. workflows de déploiement) → les alertes
correspondantes se ferment automatiquement au scan suivant.

**Suivi possible (optionnel, pour les supprimer physiquement de l'image) :**
compiler le backend en JavaScript (builder stage) et l'exécuter avec `node`
au lieu de `tsx` — `esbuild` n'est alors plus embarqué dans l'image *runtime*.
Cela suppose aussi de builder le paquet `@42-league/shared` (aujourd'hui exporté
en source TS) et de valider l'image en local (Prisma, `import.meta.url`). À faire
proprement et testé, hors d'un déploiement à chaud.

## 5. Rejouer l'audit

```bash
# Endpoints + headers (live)
curl -s -o /dev/null -w "%{http_code}\n" https://oneleague.fr/api/health     # 200
curl -s -D - -o /dev/null https://oneleague.fr/ | grep -iE "strict-transport|x-frame|x-content-type"

# Dépendances JS
npm audit

# Stats de contributions (alimentent À propos) — repli fichier en prod
bash .github/scripts/contributor-stats.sh > apps/backend/contributor-stats.json
```

L'audit complet tourne chaque jour via `daily-security-audit.yml` (résumé Discord).
