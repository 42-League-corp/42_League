# Documentation 42 League

Index de la documentation technique du projet. Cible : un dev qui reprend le repo et veut
comprendre n'importe quel aspect « de fond en comble ».

## Vue d'ensemble & stack
- [**STACK.md**](./STACK.md) — Stack complète : front, back, base de données, Docker, reverse proxy
  (Caddy), déploiement CI/CD (GitHub Actions, GHCR, Trivy), variables d'environnement, flux d'une
  requête en prod, démarrage local.
- [**architecture-ci-cd.md**](./architecture-ci-cd.md) — Le pipeline en détail : staging vs prod,
  les deux environnements, circulation d'une requête, miroir d'images, comment travailler avec Git.

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
  rôles, plafond SSE, body-limit, `toPublicUser` (PII), verrou de marché des paris, audit log,
  webhooks Discord, CodeQL, Trivy, npm audit, gating UI.
- [**security-patches.md**](./security-patches.md) — Mémoire de sécurité du projet : threat model et
  patches numérotés, à compléter à chaque PR introduisant ou corrigeant une surface d'attaque.
- [**AUDIT_CYBER_2026-06-05.md**](./AUDIT_CYBER_2026-06-05.md) — Audit cyber multi-agents (8 zones,
  vérification adversariale) : 16 failles confirmées et leurs corrections (DoS SSE, PII, économie, infra).
- [**CONFORMITE_CGU_API_42.md**](./CONFORMITE_CGU_API_42.md) — Rapport de conformité aux CGU de l'API
  Intra 42 (version 08.01.2025) : traitement des données, OAuth, RGPD.

## Historique & post-mortems
- [**JOURNAL_DE_BORD.md**](./JOURNAL_DE_BORD.md) — Avancement complet du projet de 0 au déploiement,
  par phases : à chaque étape, le problème rencontré, ce qu'on a tenté, ce qui n'a pas marché et
  pourquoi, comment on a fixé. Reconstruit depuis l'historique git (25 mai – 6 juin 2026) : amorçage,
  prod, métier, durcissement, communauté, **multi-disciplines, économie & paris, refonte tournois,
  god/staging & audit**.
- [**POST_MORTEM_404_BUG.md**](./POST_MORTEM_404_BUG.md) — Analyse d'incident (bug 404).

## Manques & roadmap
- [**manques/**](./manques/README.md) — **Gap-analysis exhaustive** : tout ce qui n'est pas
  encore écrit, incomplet, buggé ou améliorable, sur 8 domaines (~6 400 lignes, ~320 manques),
  chacun au gabarit *État → Manque → Fichiers → Piste → Effort → Priorité*. L'index
  ([manques/README.md](./manques/README.md)) synthétise les **priorités transverses**
  (bugs, sécurité/RGPD, équilibrage, dette, tests). Va plus loin que `pending.md`.
- [**pending.md**](./pending.md) — Backlog historique court (coché/à faire) — vue rapide.

## Process & notes
- [**GUIDE-GIT.md**](./GUIDE-GIT.md) / [**WORKFLOW.md**](./WORKFLOW.md) — Modèle Git du projet :
  `develop` → staging, `main` → prod, déploiement automatique, comment promouvoir en prod.
- [**NOTES.md**](./NOTES.md) — Bugs/observations repérés en lisant le code (corrigés ou en attente).

---

> Voir aussi, dans `DOC/` : [security-patches.md](./security-patches.md) (mémoire de sécurité),
> [pending.md](./pending.md) (backlog) et [manques/](./manques/README.md) (gap-analysis détaillée).
