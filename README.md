# 42 League — Babyfoot Ranked

Extension navigateur + backend pour organiser des matchs ranked de babyfoot à l'école 42.

## Objectif

Créer une ligue compétitive de babyfoot **1v1** entre étudiants 42, avec :
- inscription à la league via OAuth intra,
- ELO + classement,
- matchmaking automatique,
- anti-farming hebdomadaire (max 2 matchs comptés par paire / 7 jours),
- minimum de matchs par semaine,
- saisons.

## Décisions structurantes

| Sujet | Choix |
|---|---|
| Format | 1v1 uniquement (MVP) |
| Validation match | Double confirmation (déclaration + confirmation adversaire) |
| Anti-farming | Les 3e, 4e… matchs entre A et B sur 7 jours glissants ne comptent **pas** pour l'ELO |
| Matchmaking | File d'attente + quota hebdo + saisons |
| Auth | OAuth2 intra 42 |
| Scope MVP | Un seul campus |
| Hébergement | Railway (cloud managé) |

## Stack

- **Backend** : Node 20 + TypeScript, Hono, Prisma, PostgreSQL
- **Extension** : Manifest V3, TypeScript, Vite, content-script injecté dans `intra.42.fr`
- **Code partagé** : `packages/shared` (Zod schemas + logique ELO + anti-farming)

## ELO

- Rating initial : **1000**
- K = **40** pendant les placements (10 premiers matchs)
- K = **20** après placements
- Formule Elo standard 1v1, pas de match nul (babyfoot = premier à 10 buts)

## Layout du repo

```
.
├── apps/
│   ├── backend/       # Hono + Prisma (in-memory pour l'instant)
│   └── extension/     # MV3 (à venir)
├── packages/
│   └── shared/        # ELO, anti-farming, schémas Zod
└── package.json       # workspace root
```

## Phases de build

1. Scaffold monorepo + logique ELO/anti-farming pure et testée — **en cours**
2. Backend skeleton (Hono + store in-memory) — endpoints déclaration / confirmation / leaderboard
3. Prisma + Postgres (Docker compose local)
4. OAuth 42 (nécessite la création d'une app intra)
5. Matchmaking + quotas hebdo + saisons
6. Déploiement Railway
7. Extension MV3 (injection intra)

## Pré-requis externes (plus tard)

- Créer une app OAuth sur https://profile.intra.42.fr/oauth/applications
- Compte Railway pour le déploiement Postgres + backend

## Dev local

```bash
npm install
npm test            # tests de la logique ELO + anti-farming
npm run dev:backend # lance le backend Hono (in-memory)
```
