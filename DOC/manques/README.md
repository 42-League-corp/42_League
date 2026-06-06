# Manques & dette — gap-analysis complète de 42 League

> Cartographie **exhaustive de ce qui n'est pas encore écrit, est incomplet, à
> moitié fait, buggé ou améliorable** sur le site. Produite par 8 explorations
> parallèles du code (une par domaine), chacune ancrée sur les fichiers réels
> (`fichier:ligne`), pas sur la doc. Complète et remplace en profondeur le court
> [`../pending.md`](../pending.md) (backlog historique).
>
> Périmètre : **8 domaines**, ~**6 400 lignes**, ~**320 manques** recensés, chacun
> au gabarit **État actuel → Ce qui manque → Fichiers concernés → Piste
> d'implémentation → Effort (S/M/L) → Priorité**.

## Les 8 domaines

| # | Fichier | Domaine | Manques |
|---|---------|---------|---------|
| 01 | [01-tournois.md](./01-tournois.md) | Tournois : bracket, poules, 2v2, byes, toss, paris, reshuffle, cérémonie | ~55 |
| 02 | [02-defis-matchs.md](./02-defis-matchs.md) | Défis & matchs : 1v1, FFA Smash, fléchettes, OPS, matchmaking, anti-farming | ~50 |
| 03 | [03-economie.md](./03-economie.md) | Économie League Coins : gains, sinks, paris, quêtes, boutique, équilibrage | ~40 |
| 04 | [04-multi-jeux.md](./04-multi-jeux.md) | Multi-disciplines : registry, asymétries par jeu, normalisation `PlayerGameStat` | ~35 |
| 05 | [05-profil-social.md](./05-profil-social.md) | Profil & social : badges, suivi, équipes, saisons, RGPD, recherche | ~50 |
| 06 | [06-notifications-temps-reel.md](./06-notifications-temps-reel.md) | Notifications & SSE : web push, préférences, couverture des types, scalabilité | ~35 |
| 07 | [07-backend-admin-securite.md](./07-backend-admin-securite.md) | Backend / GOD / sécurité / infra / extension : scheduler, observabilité, backups, secrets | ~45 |
| 08 | [08-frontend-ux-mobile-i18n-tests.md](./08-frontend-ux-mobile-i18n-tests.md) | Frontend / UX / mobile-PWA / i18n / a11y / tests / perf | ~40 |

---

## Top priorités transverses

Sélection des manques à plus fort impact, regroupés par nature. Détails et pistes
dans le fichier de domaine indiqué.

### 🔴 Bugs confirmés (à corriger en premier)
- **`/reject` ignore les coéquipiers en 2v2** : seul le capitaine peut refuser un
  score — un coéquipier ne peut rien valider/refuser. → [01](./01-tournois.md)
- **Anonymisation RGPD incomplète** : `anonymizeAccount` ne nullifie pas
  `firstName`/`lastName` et ne purge ni `Follow` ni `UserBadge` ni cosmétiques →
  l'identité réelle et le réseau survivent. → [05](./05-profil-social.md)
- **Anti-farming absent en FFA Smash & fléchettes** : `countedForElo:true` + coins
  crédités sans dégressivité → farming ELO/coins illimité (contraire au 1v1/2v2).
  → [02](./02-defis-matchs.md), [03](./03-economie.md)
- **`assertNotBanned` seulement à la déclaration** : un compte banni ensuite peut
  toujours confirmer/refuser/clôturer des matchs et bouger l'ELO. → [02](./02-defis-matchs.md)
- **Détection mobile par largeur** (`useViewport.ts:59`, `< 768`) : un téléphone en
  **paysage** bascule sur le shell desktop — c'est le bug de rotation. → [08](./08-frontend-ux-mobile-i18n-tests.md)
- **Stats de profil tronquées** : winrate/W-L calculés sur les 50 derniers matchs,
  tous jeux mélangés ; rang affiché toujours celui du babyfoot. → [05](./05-profil-social.md)
- **Fléchettes sélectionnables à la création** de tournoi mais rejetées au 1er
  score (cul-de-sac UX). → [01](./01-tournois.md), [04](./04-multi-jeux.md)
- **Code mort / désyncs** : `settleMatchBetsTx` encore appelé (paris « match »
  retirés) ; `notifyTrophy` réglable mais jamais émis ; raccourcis PWA cassés
  (`/defis`, `/tournois` → vraies routes `/challenges`, `/tournaments`). → [03](./03-economie.md), [05](./05-profil-social.md), [08](./08-frontend-ux-mobile-i18n-tests.md)

### 🟠 Sécurité, RGPD & infra
- **Rotation des secrets OAuth 42** toujours en attente (secret leaké encore en
  service). → [07](./07-backend-admin-securite.md), [../pending.md](../pending.md)
- **Aucune sauvegarde DB automatisée/offsite** (perte irréversible possible). → [07](./07-backend-admin-securite.md)
- **Aucun scheduler durable** : purges, anonymisations, timers OPS et expirations
  reposent sur des `setTimeout`/`setInterval` volatils — perdus au redéploiement,
  double-exécution si > 1 instance. → [07](./07-backend-admin-securite.md), [06](./06-notifications-temps-reel.md), [02](./02-defis-matchs.md)
- **Observabilité quasi nulle** : `console.*` non structurés, pas de métriques ni
  d'error-tracking ; `/health` ne teste pas la DB. → [07](./07-backend-admin-securite.md)
- **`migrate deploy` from scratch cassé** (migration fléchettes mal ordonnée),
  masqué par `db push` en itests → restauration/DR impossible en l'état. → [07](./07-backend-admin-securite.md)
- **Architecture mono-process** : SSE, rate-limit et timers en RAM → pas de scaling
  horizontal sans Redis Pub/Sub ; Bearer 30 j non révocable. → [07](./07-backend-admin-securite.md), [06](./06-notifications-temps-reel.md)

### 🟠 Produit & équilibrage
- **Pas de web push** : les notifs (« défi reçu », « score à valider ») meurent dès
  que l'onglet est fermé — cœur du produit non fiable hors-onglet. → [06](./06-notifications-temps-reel.md)
- **Quêtes & Paris mobile-only** : `ProfilDesktop` n'a aucun accès aux quêtes,
  paris et solde de coins — asymétrie de feature majeure. → [08](./08-frontend-ux-mobile-i18n-tests.md), [03](./03-economie.md)
- **Économie sans garde-fous** : un seul vrai sink (boutique à achat unique) face à
  des sources infinies → inflation ; pas de grand-livre/historique de transactions ;
  cote de pari fixe ×2 (pas de cotes dynamiques) ; pas de plafond de mise. → [03](./03-economie.md)
- **Badges quasi inertes** : 4 badges hardcodés, seul `season_champion` attribué par
  code ; aucune route admin d'attribution ; pas de notif badge hors champion. → [05](./05-profil-social.md)
- **Forfait/abandon inexistant** : un désistement en cours **bloque le bracket**
  (slot null sans gagnant). → [01](./01-tournois.md)
- **Saisons 100 % manuelles** : pas de calendrier/clôture auto ; `activate` efface
  `endedAt` (risque de corruption de palmarès). → [05](./05-profil-social.md)

### 🟡 Dette structurelle & qualité
- **`PlayerGameStat` non migré** : colonnes ELO/compteurs plates × 5 jeux,
  redupliquées côté front ; « ajouter un jeu = 1 entrée » est faux (~11 points). → [04](./04-multi-jeux.md)
- **Moteur de bracket sans tests** ; **FFA / fléchettes / OPS / matchmaking / 2v2
  non testés** ; **zéro test frontend** (ni Vitest web, ni Playwright/Cypress). → [01](./01-tournois.md), [02](./02-defis-matchs.md), [08](./08-frontend-ux-mobile-i18n-tests.md)
- **i18n incomplète** : 4 clés `shop.rarity.*` manquantes en espagnol ; `<html
  lang>` non synchronisé ; **erreurs backend en français en dur** affichées brutes
  (~30 sites). → [08](./08-frontend-ux-mobile-i18n-tests.md), [01](./01-tournois.md), [02](./02-defis-matchs.md)
- **Accessibilité** : pas d'`aria-live` sur les notifs, focus visible désactivé sans
  remplacement, pas de skip-link ni focus-trap, `<img>` sans `alt`, sens porté par la
  couleur seule. → [08](./08-frontend-ux-mobile-i18n-tests.md), [06](./06-notifications-temps-reel.md)
- **Perf front** : `prefetchRouteChunks()` précharge toutes les pages (annule le
  code-splitting) ; PNG persos > 300 Ko sans webp/lazy. → [08](./08-frontend-ux-mobile-i18n-tests.md)
- **Registry de jeux partiel** : `elo()` faux/inutilisé pour les fléchettes, FFA/darts
  contournent le registry, liste des disciplines dupliquée 5+ fois en dur. → [04](./04-multi-jeux.md)

---

## Comment lire / maintenir

- Chaque manque est **autonome** (état, fichiers, piste, effort, priorité) → utilisable
  tel quel comme ticket.
- En traitant un manque : **cocher/retirer** l'entrée du fichier de domaine et, si
  pertinent, mettre à jour [`../pending.md`](../pending.md).
- Désync repérée à corriger en passant : `pending.md:17` marque l'expiration des
  pending comme « non faite » alors qu'un job existe désormais (cf. [02](./02-defis-matchs.md)).

> Généré le 2026-06-06 par 8 agents d'exploration parallèles. Instantané du code à
> cette date — revérifier `fichier:ligne` avant d'agir, le code a pu bouger.
