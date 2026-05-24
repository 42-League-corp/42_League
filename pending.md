# À faire

## Backend / logique
- [x] **Défis (Challenges)** : entité + endpoints (create/list/accept/decline/record). Le record crée un PendingMatch existant
- [ ] **Matchmaking** : file d'attente, suggérer un adversaire (proche en ELO, dispo, hors anti-farming)
- [ ] **Saisons** : reset/archive périodique, leaderboard par saison
- [ ] **Minimum hebdo** : X matchs/semaine sinon malus / dégradation ELO
- [ ] **Tests d'intégration HTTP** sur les endpoints (déclaration, confirmation, anti-farming) avec une vraie DB de test
- [ ] **Rate-limiting / abuse protection** sur les endpoints publics
- [x] **Annulation / refus** d'un match pending par l'adversaire (`POST /matches/:id/reject`)
- [x] **Validation symétrique du score** : l'adversaire ressaisit son score à la confirmation ; mismatch → 409 (corriger ou refuser)
- [ ] **Expiration** des matchs pending non confirmés (auto-purge après N jours ?)

## Extension navigateur
- [x] Squelette MV3 + Vite + TS (`apps/extension`, build OK)
- [x] Content-script injecté dans `intra.42.fr` — widget en Shadow DOM, ancré après la section "évaluations à venir" (fallback bottom-right)
- [x] Flow OAuth depuis l'extension via `chrome.identity.launchWebAuthFlow` → backend `/auth/extension/login` → token bearer HMAC stocké dans `chrome.storage.local`
- [x] UI : déclarer un match, confirmer, voir leaderboard (top 5), pending propres à l'utilisateur
- [x] Icône extension (`icons/42_league.png` aux 4 tailles, mais 2.4 MB — à redimensionner plus tard)
- [x] Animations : spinner connexion, fade-in panneau, checkmark validation match, pulse avatar
- [x] Bascule visuelle connecté/déconnecté (bordure 42 + avatar + ELO en header une fois loggé, carte dashed monochrome sinon)
- [x] Page Options (`options_ui` dans manifest) — profil, stats (ELO/win rate/Δ), historique 50 matchs, URL backend configurable, changer compte / logout
- [ ] Auto-complétion login adversaire (lister users / piocher depuis le DOM de l'intra)
- [ ] Optimiser `42_league.png` (1254×1254 → générer 16/32/48/128 séparément)
- [ ] Tester sur Firefox (`chrome.identity.launchWebAuthFlow` existe aussi côté Firefox via `browser.identity`)

## Déploiement
- [ ] Compte Railway (ou Fly.io)
- [ ] Postgres managé
- [ ] Variables d'env en prod
- [ ] Mettre l'URL de prod dans les redirect URIs de l'app OAuth intra
- [ ] CI (lint + typecheck + tests sur PR)

## Sécurité
- [ ] **Rotate les secrets OAuth** (`FT_OAUTH_UID` / `FT_OAUTH_SECRET`) — les valeurs actuelles sont apparues dans une conversation Claude
- [ ] Cookie `Secure` en prod (actuellement seulement `HttpOnly` + `SameSite=Lax`)
