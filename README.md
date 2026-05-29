# 42 League — Babyfoot Ranked

<div align="center">

## Jouer maintenant

### [http://163.172.141.178](http://163.172.141.178)

<br/>

### Installer l'extension

[![Installer sur Chrome](https://img.shields.io/badge/Chrome-Installer_l'extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/TODO)
&nbsp;&nbsp;
[![Installer sur Firefox](https://img.shields.io/badge/Firefox-Installer_l'extension-FF7139?style=for-the-badge&logo=firefox-browser&logoColor=white)](https://addons.mozilla.org/fr/firefox/addon/TODO)

> L'extension s'injecte directement dans `intra.42.fr` pour déclarer tes matchs sans quitter l'intra.

</div>

---

## C'est quoi ?

Une ligue compétitive de babyfoot **1v1** entre étudiants 42 :

- Connexion via **OAuth intra 42**
- Système **ELO** + classement en temps réel
- **Double confirmation** des scores (les deux joueurs valident)
- **Anti-farming** : max 2 matchs comptés par paire sur 7 jours glissants
- Tournois, trophées, historique complet

## Stack

| Composant | Tech |
|---|---|
| Backend | Node 20 + TypeScript, Hono, Prisma, PostgreSQL |
| Web | React + Vite + Tailwind |
| Extension | Manifest V3, TypeScript, Vite |
| Infra | Docker Compose + Caddy |

## ELO

- Rating initial : **1000**
- K = **40** pendant les placements (10 premiers matchs), puis **20**
- Formule Elo standard 1v1 — premier à 10 buts, pas de match nul

## Structure du repo

```
.
├── apps/
│   ├── backend/       # API Hono + Prisma + PostgreSQL
│   ├── web/           # Site React (163.172.141.178:80)
│   └── extension/     # Extension Chrome/Firefox
├── packages/
│   └── shared/        # ELO, anti-farming, schémas Zod
└── docker-compose.prod.yml
```

## Dev local

```bash
# Prérequis : Node 20, Docker
cp .env.example .env   # remplir FT_OAUTH_UID, FT_OAUTH_SECRET, SESSION_SECRET

npm install
npm test               # tests ELO + anti-farming

# Lancer tout en local
docker compose up --build
# → frontend : http://localhost
# → backend  : http://localhost:3000
```

## Déploiement prod

```bash
# Sur le serveur (163.172.141.178)
docker compose -f docker-compose.prod.yml up -d --build
```

## Config OAuth 42

Créer une app sur https://profile.intra.42.fr/oauth/applications avec :
- **Redirect URI** : `http://163.172.141.178:3000/auth/callback`
- Renseigner `FT_OAUTH_UID` et `FT_OAUTH_SECRET` dans `.env`
