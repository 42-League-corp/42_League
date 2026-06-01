# Architecture CI/CD — 42 League

> Mise en place : 2026-06-01. Document pédagogique : ce qui a été fait, pourquoi,
> comment une requête circule, et comment travailler avec Git désormais.

---

## 1. Le problème de départ et la décision clé

L'objectif annoncé était de « migrer vers une CI/CD GitHub Actions + reverse-proxy
**Nginx** pour séparer Staging et Production ».

En auditant le repo, deux faits ont changé le plan :

1. **La CI/CD vers GHCR existait déjà** pour la prod (`deploy.yml` buildait sur
   GitHub Actions, poussait sur GHCR, déployait en SSH). Il ne restait donc pas à
   « tout migrer », mais à **ajouter le staging** et à **proprifier le versioning
   des images**.
2. **Caddy faisait déjà tout ce que Nginx était censé apporter** : TLS automatique
   (Let's Encrypt), headers de sécurité, routage `/api`. Et le conteneur frontend
   **embarque déjà un Nginx interne** pour servir le SPA.

### Pourquoi on a abandonné Nginx (et gardé Caddy seul)

L'archi « Nginx → Caddy » demandée aurait créé **trois reverse-proxies empilés**
(Nginx edge → Caddy → Nginx du conteneur frontend) et un **conflit TLS** : il aurait
fallu *désactiver* l'auto-HTTPS de Caddy (sa meilleure fonction) pour laisser Nginx
gérer les certificats à la main (certbot + cron de renouvellement).

> **Règle d'or DevOps : moins de pièces mobiles = moins de pannes.**

On a donc choisi **un seul Caddy comme reverse-proxy edge**, qui gère les **deux
domaines** :

| Besoin | Solution Nginx (abandonnée) | Solution Caddy (retenue) |
|---|---|---|
| TLS prod + staging | certbot manuel + renouvellement | **automatique**, multi-domaine |
| Auth du staging | fichier `.htpasswd` | directive `basic_auth` native |
| Headers sécurité | à réécrire dans Nginx | **déjà** dans le Caddyfile |
| Flux SSE (`/api/events`) | `proxy_buffering off` à régler | `flush_interval -1` déjà en place |
| Pièces à maintenir | Nginx + Caddy + certbot | **un seul Caddyfile** |

---

## 2. L'architecture cible (ce qui tourne maintenant)

```
                          Internet (HTTPS :443)
                                   │
                 ┌─────────────────┴──────────────────┐
                 │   CADDY edge (stack prod)           │
                 │   TLS auto · headers · 1 par domaine│
                 └───────┬──────────────────────┬──────┘
        42league.fr      │                      │   staging.42league.fr
                         │                      │   (+ basic_auth admin)
              ┌──────────▼─────────┐  ┌─────────▼───────────┐
   réseau     │  /opt/42_league/   │  │ /opt/42_league_     │   réseau
   "default"  │  (PROD, tag :main) │  │ staging/ (:develop) │   "default"
   (prod)     │                    │  │                     │   (staging)
              │  backend  :3000    │  │  league-stg-backend │
              │  frontend :80      │  │  league-stg-frontend│
              │  postgres (volume  │  │  postgres (volume   │
              │   league_pgdata)   │  │   league_stg_pgdata)│
              └────────────────────┘  └─────────────────────┘
                         ▲                      ▲
                         └───── réseau Docker partagé ──────┘
                                   "league_edge"
                     (seul le Caddy edge + les conteneurs
                      staging y sont attachés)
```

Points importants :

- **Deux bases de données totalement isolées.** La prod (`league_pgdata`) et le
  staging (`league_stg_pgdata`) sont sur des volumes Docker distincts, dans des
  projets compose distincts. Le Postgres staging **n'est pas** sur `league_edge` :
  il est injoignable depuis l'extérieur de sa stack. **La DB prod n'est jamais
  touchée par le staging.**
- **Le Caddy edge vit dans la stack prod** et rejoint le réseau `league_edge` pour
  atteindre les conteneurs staging par leur nom (`league-stg-backend`, etc.).
- **Versioning des images par branche** : `main` → image `:main`, `develop` →
  image `:develop`. Fini le `:latest` ambigu (on le garde en alias le temps de la
  transition).

---

## 3. Cheminement complet d'une requête HTTP

### a) Un visiteur ouvre `https://42league.fr` (PRODUCTION)

1. **DNS** : `42league.fr` → `163.172.141.178` (le VPS).
2. **TLS** : la connexion arrive sur le port 443 du **Caddy edge**, qui présente le
   certificat Let's Encrypt qu'il a obtenu et renouvelle **tout seul**.
3. **Routage par domaine** : Caddy voit l'en-tête `Host: 42league.fr` → bloc prod.
4. **Headers** : Caddy ajoute HSTS, X-Frame-Options, nosniff, etc.
5. **Routage par chemin** :
   - `GET /api/...` → Caddy retire le préfixe `/api`, transmet à `backend:3000`
     (Node/Express). Pour `/api/events` (SSE), `flush_interval -1` désactive le
     buffering → les événements arrivent en temps réel.
   - tout le reste → `frontend:80` (le Nginx **interne** au conteneur frontend, qui
     sert le SPA React et applique le fallback `index.html`).
6. La réponse remonte par le même chemin jusqu'au navigateur.

### b) Un visiteur ouvre `https://staging.42league.fr` (STAGING)

Identique, **à deux différences près** :

- **Mur d'authentification** : Caddy exige un login/mot de passe HTTP Basic
  (`basic_auth`) *avant* de proxifier quoi que ce soit. Sans les identifiants → 401.
- **Cibles** : les requêtes partent vers `league-stg-backend:3000` et
  `league-stg-frontend:80` (les conteneurs staging), atteints via le réseau
  partagé `league_edge`.

Le frontend staging a été **buildé avec `VITE_API_BASE_URL=https://staging.42league.fr/api`**,
donc il tape bien l'API staging et jamais la prod.

---

## 4. Le pipeline CI/CD (ce que font les robots)

### Fichiers concernés (`.github/workflows/`)

| Workflow | Déclencheur | Rôle |
|---|---|---|
| `ci.yml` | toute PR / push hors `main` | Garde-fou : typecheck + tests + tests d'intégration. |
| `deploy-prod.yml` | push sur **`main`** | Build images `:main` → push GHCR → **valide le Caddyfile** → déploie `/opt/42_league`. |
| `deploy-staging.yml` | push sur **`develop`** | Build images `:develop` → push GHCR → déploie `/opt/42_league_staging`. |
| `force-build-deploy.yml` | manuel | Rebuild forcé + redéploiement prod (dépannage). |
| `build.yml` | manuel | Rebuild des images sans déployer. |

### Le garde-fou « zéro downtime » (important)

Avant de redéployer la prod, `deploy-prod.yml` exécute :

```bash
docker run --rm -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" \
  --env-file caddy.env caddy:alpine caddy validate --config /etc/caddy/Caddyfile
```

Si le Caddyfile est invalide (ex. : hash basic-auth manquant), `set -e` **abort le
déploiement** et les conteneurs **actuels continuent de tourner intacts**. La prod
ne tombe jamais à cause d'une config cassée.

### Où sont les secrets

Rien de sensible n'est dans le repo. Tout passe par :

- **GitHub Actions Secrets** : `SSH_PRIVATE_KEY`, `VITE_API_BASE_URL` (prod),
  `GITHUB_TOKEN` (auto), `DISCORD_SECURITY_WEBHOOK_URL`.
- **Fichiers serveur, jamais commités** (`.gitignore`) :
  - `/opt/42_league/.env` — secrets prod (OAuth 42, SESSION_SECRET…).
  - `/opt/42_league/caddy.env` — **uniquement** le hash bcrypt du basic-auth staging.
  - `/opt/42_league_staging/.env` — secrets staging (OAuth dédié, SESSION_SECRET…).

---

## 5. Ton nouveau workflow de développement

Avant : tu bossais et tu poussais sur `main`, qui partait direct en prod. Désormais
tu as un **filet de sécurité** : `develop` (staging) avant `main` (prod).

```
   feature/ma-fonctionnalite      (tu codes ici)
            │  PR + CI verte
            ▼
        develop  ───────────────►  build :develop  ──►  https://staging.42league.fr
            │  tu testes en conditions réelles            (privé, basic-auth)
            │  PR develop → main
            ▼
          main   ───────────────►  build :main     ──►  https://42league.fr
                                                          (PRODUCTION)
```

### En pratique

1. **Une fonctionnalité = une branche** depuis `develop` :
   ```bash
   git switch develop && git pull
   git switch -c feat/ma-fonctionnalite
   # ... tu codes, tu commits ...
   git push -u origin feat/ma-fonctionnalite
   ```
   → `ci.yml` vérifie automatiquement (typecheck + tests).

2. **Tester sur le staging** : ouvre une PR vers `develop` et merge-la (ou pousse
   sur `develop`). Le staging se met à jour seul. Tu valides sur
   `https://staging.42league.fr` — c'est **exactement** l'environnement prod, mais
   isolé et avec sa propre base.

3. **Mettre en production** : quand le staging est validé, PR `develop → main`.
   Le merge déclenche le déploiement prod automatique.

> **Règle de discipline** : on ne pousse plus jamais directement sur `main` sans être
> passé par `develop`. Le staging est là pour attraper les bugs *avant* tes
> utilisateurs. Les **migrations Prisma** sont jouées d'abord sur la base staging
> (au démarrage du conteneur backend) : tu vois donc une migration foireuse sur le
> staging, pas en prod.

---

## 6. Annexe — préparation serveur (faite une seule fois)

Ces étapes créent l'environnement staging sur le VPS (voir le détail commandé
fourni séparément) :

1. **DNS** : enregistrement A `staging.42league.fr` → `163.172.141.178`.
2. `docker network create league_edge` (réseau partagé).
3. Générer le hash bcrypt et le mettre dans `/opt/42_league/caddy.env` :
   ```bash
   docker run --rm caddy:alpine caddy hash-password --plaintext 'TON_MOT_DE_PASSE'
   # → coller le résultat :
   #   echo 'STAGING_BASICAUTH_HASH=<le_hash>' > /opt/42_league/caddy.env
   ```
4. Créer `/opt/42_league_staging/.env` (copie du `.env` prod, adaptée :
   `FT_OAUTH_REDIRECT_URI=https://staging.42league.fr/auth/callback`,
   `WEB_APP_URLS=https://staging.42league.fr`, un `SESSION_SECRET` **différent**).
5. Premier déploiement : push sur `develop` → le pipeline fait le reste.

> Le fichier legacy `docker-compose.prod.yml` (build sur le serveur) n'est plus
> utilisé : la prod tire ses images depuis GHCR via `docker-compose.registry.yml`.
