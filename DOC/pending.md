# À faire

> Backlog court (vue rapide). Pour l'analyse **détaillée et exhaustive** des manques
> (8 domaines, ~320 entrées avec pistes d'implémentation), voir [`manques/`](./manques/README.md).

## Backend / logique
- [x] **Défis (Challenges)** : entité + endpoints (create/list/accept/decline/record). Le record crée un PendingMatch existant
- [x] **Matchmaking** : file d'attente « match aléatoire » + pairing backend (`matchmaking_queue`), overlay VERSUS
- [x] **Saisons** : `Season` (une active), reset/archive (`SeasonStanding` + badge champion), leaderboard/nuage/GOAT scopés saison, `POST /seasons/:id/activate`
- [x] **Multi-disciplines** : Smash, Échecs, Street Fighter, fléchettes (301/501, 2–8 j), babyfoot 2v2 — game registry partagé (`packages/shared/src/games.ts`), colonnes ELO/compteurs par jeu
- [x] **Économie League Coin** : gains de match (+20 joué / +50 victoire, classé only), quêtes hebdo (`/quests`), boutique + Shop GOD
- [x] **Paris** : pari unique sur le **vainqueur du tournoi** (cote ×2), ouvert avant le 1er résultat, verrou permanent `betsLockedAt`, remboursement aux suppressions en masse
- [x] **Grades** : barème ELO (Étain→Diamant) + **Grand Master positionnel** (top 5 par discipline)
- [x] **Tests d'intégration HTTP** sur les endpoints (déclaration, confirmation, anti-farming) avec une vraie DB de test — `test/matches.itest.ts` + `test/challenges.itest.ts` (29 tests, `npm run test:integration`)
- [x] **Rate-limiting / abuse protection** sur les endpoints publics (rate-limit + body-limit 1 Mo + plafond SSE 5/login ; admins exemptés)
- [x] **Annulation / refus** d'un match pending par l'adversaire (`POST /matches/:id/reject`)
- [x] **Annulation par le déclarant** de sa propre déclaration tant que non confirmée (`POST /matches/:id/cancel`)
- [x] **Validation symétrique du score** : l'adversaire ressaisit son score à la confirmation ; mismatch → 409 (corriger ou refuser)
- [ ] **Minimum hebdo** : X matchs/semaine sinon malus / dégradation ELO (les quêtes hebdo récompensent l'activité, mais pas de malus d'inactivité)
- [ ] **Expiration** des matchs pending non confirmés (auto-purge après N jours ?)
- [ ] **Tournoi fléchettes** : non supporté (multijoueur incompatible bracket binaire) — à concevoir s'il est voulu
- [ ] **Normalisation des colonnes par-jeu** en table `PlayerGameStat` (préparée par le game registry, pas encore migrée)
- [ ] **Plomberie contributor-stats** : le module est commité et boote, mais le script + Dockerfile + workflows + page About restent à livrer

## Extension navigateur
- [x] Squelette MV3 + Vite + TS (`apps/extension`, build OK)
- [x] Content-script injecté dans `intra.42.fr` — widget en Shadow DOM, ancré après la section "évaluations à venir" (fallback bottom-right)
- [x] Flow OAuth depuis l'extension via `chrome.identity.launchWebAuthFlow` → backend `/auth/extension/login` → token bearer HMAC stocké dans `chrome.storage.local`
- [x] UI : déclarer un match, confirmer, voir leaderboard (top 5), pending propres à l'utilisateur
- [x] Icône extension (`icons/42_league.png` aux 4 tailles, mais 2.4 MB — à redimensionner plus tard)
- [x] Animations : spinner connexion, fade-in panneau, checkmark validation match, pulse avatar
- [x] Bascule visuelle connecté/déconnecté (bordure 42 + avatar + ELO en header une fois loggé, carte dashed monochrome sinon)
- [x] Page Options (`options_ui` dans manifest) — profil, stats (ELO/win rate/Δ), historique 50 matchs, URL backend configurable, changer compte / logout
- [x] **Firefox** : builds Chrome/Firefox séparés (Firefox refuse `background.scripts`), login via redirect `allizom`, URLs prod, `gecko.data_collection_permissions`
- [x] **Token OAuth lu dans le fragment (`#`)** au lieu de la query string (correctif d'audit — évite la fuite dans les logs/Referer)
- [ ] Auto-complétion login adversaire (lister users / piocher depuis le DOM de l'intra)
- [ ] Optimiser `42_league.png` (1254×1254 → générer 16/32/48/128 séparément)

## Déploiement
- [x] Hébergement : serveur dédié, stack Docker Compose (front nginx + backend Hono + Postgres + Caddy), images poussées sur GHCR
- [x] **Staging + prod** : `develop` → `staging.42league.fr`, `main` → `42league.fr` (déploiement auto, cf. `architecture-ci-cd.md` / `GUIDE-GIT.md`)
- [x] Postgres conteneurisé (mot de passe paramétrable, non exposé)
- [x] Variables d'env en prod/staging (dont `PROD_READONLY_URL` pour la synchro ELO)
- [x] URLs de prod/staging dans les redirect URIs de l'app OAuth intra
- [x] CI (lint + typecheck + tests + CodeQL + Trivy + npm audit) ; deploy exige build-backend ET build-frontend verts
- [x] **Images de base via miroir AWS ECR Public** (`public.ecr.aws/docker/library/*`) — contourne le rate-limit / timeout Docker Hub en CI
- [ ] **Rotate les secrets OAuth** (`FT_OAUTH_UID` / `FT_OAUTH_SECRET`) — déplacé en Sécurité ci-dessous

## Sécurité
- [ ] **Rotate les secrets OAuth** (`FT_OAUTH_UID` / `FT_OAUTH_SECRET`) — les valeurs actuelles sont apparues dans une conversation Claude → **action manuelle sur l'intra** (profile.intra.42.fr → OAuth applications → regénérer le secret), puis mettre à jour `.env` local + prod
- [x] Cookie `Secure` en prod — `COOKIE_SECURE = NODE_ENV==='production'` appliqué aux cookies session + state (`auth.ts`), `NODE_ENV=production` ajouté au backend dans `docker-compose.prod.yml`
- [x] **Audit cyber 2026-06-05** : 16 failles confirmées toutes corrigées (cf. `AUDIT_CYBER_2026-06-05.md` + `security-patches.md`) — plafond SSE, body-limit, `toPublicUser` (PII), anti-spoof `X-Forwarded-For`, CSP, `USER node`, intégrité économie
- [x] **Backdoor `x-dev-login`** neutralisée en dur en prod (`NODE_ENV !== 'production'`)
- [x] **Intégrité économie** : anti-farming étendu aux coins + quêtes, interdiction de parier sur un tournoi où l'on joue, verrou de marché des paris
- [ ] **Re-tester sur Firefox** les correctifs de tap mobile (couches compositeur) après l'audit
- [ ] **Suivre les alertes CodeQL/Trivy/npm audit** remontées sur Discord (rapport quotidien consolidé) et traiter les nouvelles entrées
