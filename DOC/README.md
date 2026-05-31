# Documentation 42 League

Index de la documentation technique du projet. Cible : un dev qui reprend le repo et veut
comprendre n'importe quel aspect « de fond en comble ».

## Vue d'ensemble & stack
- [**STACK.md**](./STACK.md) — Stack complète : front, back, base de données, Docker, reverse proxy
  (Caddy), déploiement CI/CD (GitHub Actions, GHCR, Trivy), variables d'environnement, flux d'une
  requête en prod, démarrage local.

## Domaine & données
- [**DOMAIN.md**](./DOMAIN.md) — Logique métier : ELO (formule babyfoot exacte), anti-farming,
  cycle de vie d'un match, défis, tournois (élimination/poules, byes, privés), ops « chasse » (24 h,
  matchs forcés), saisons & reset ELO, badges, suivi, schémas Zod partagés, glossaire.
- [**DATABASE.md**](./DATABASE.md) — Schéma Prisma exhaustif : tous les modèles/champs/relations/enums
  (notifications, badges, follows, saisons inclus), migrations, seed, flux critiques (match → ELO,
  défi, tournoi, ops, clôture de saison).

## Surfaces applicatives
- [**API.md**](./API.md) — Référence de **tous** les endpoints HTTP : auth (token de stream éphémère),
  notifications, saisons, suivi, tournois, modération de l'historique, body/validation, réponses,
  codes d'erreur, événements SSE émis.
- [**FRONTEND.md**](./FRONTEND.md) — App React (`apps/web`) : routage (H2H, GOAT…), split desktop/mobile,
  état (`useLeagueData`), client API, OAuth, cloche de notifications, i18n, PWA, composants.
- [**EXTENSION.md**](./EXTENSION.md) — Extension MV3 (`apps/extension`) : manifest, service worker,
  content scripts intra, OAuth via `chrome.identity`, popup, proxy API.
- [**REALTIME.md**](./REALTIME.md) — Temps réel SSE : catalogue d'événements, ciblé vs broadcast,
  consommation front (mapping des domaines + debounce), timers ops.

## Qualité & sécurité
- [**TESTING.md**](./TESTING.md) — Tests unitaires + intégration HTTP : harness, DB de test, commandes.
- [**SECURITY.md**](./SECURITY.md) — Dispositif de sécurité applicative & CI/CD : Zod, OAuth 42,
  rôles, audit log, webhooks Discord, CodeQL, Trivy, npm audit, gating UI.

## Historique & post-mortems
- [**JOURNAL_DE_BORD.md**](./JOURNAL_DE_BORD.md) — Avancement complet du projet de 0 au déploiement,
  par phases : à chaque étape, le problème rencontré, ce qu'on a tenté, ce qui n'a pas marché et
  pourquoi, comment on a fixé. Reconstruit depuis l'historique git (25–31 mai 2026).
- [**POST_MORTEM_404_BUG.md**](./POST_MORTEM_404_BUG.md) — Analyse d'incident (bug 404).

---

> Voir aussi, à la racine du repo : `security-patches.md` (mémoire de sécurité, patches numérotés)
> et `pending.md` (backlog).
