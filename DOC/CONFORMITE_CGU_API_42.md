# Rapport de conformité — CGU API Intra 42

> Dernière mise à jour : 2026-05-31  
> Version CGU analysée : 08.01.2025  
> Application : **42 League** (monorepo React/Vite + Hono/Node + PostgreSQL)

---

## Légende

| Icône | Signification |
|-------|--------------|
| ✅ | Conforme |
| ⚠️ | Partiellement conforme ou point de vigilance |
| ❌ | Non conforme ou action requise |

---

## Préambule — Acceptation des CGU

**Exigence :** L'utilisation de l'API implique l'acceptation des CGU. L'utilisateur doit aussi respecter la documentation API et la charte d'utilisation.

**Dans le code :**
- L'accès à l'API 42 se fait uniquement via OAuth 2.0 standard (`https://api.intra.42.fr/oauth/authorize`), ce qui implique un login 42 valide.
- La page About (`apps/web/src/pages/AboutPage.tsx`) présente une politique de confidentialité publique.
- Aucune acceptation explicite des CGU 42 n'est demandée à l'utilisateur final de 42 League au moment du login.

**Statut : ✅** — L'acceptation des CGU 42 est implicite via le login OAuth (vous, en tant que développeur, les avez acceptées). Les utilisateurs finaux ne signent pas les CGU 42 directement.

---

## Article 1 — Objet de l'API

### 1.1 Usage exclusivement bénéfique au Réseau 42

**Exigence :** L'application doit être exclusivement bénéfique au Réseau 42, sans lui porter préjudice.

**Dans le code :**
- 42 League est un système de classement ELO entre étudiants 42, avec matchs, défis, tournois et classements.
- Les données 42 utilisées sont : login, campus, photo de profil (depuis `GET /v2/me` et `GET /v2/users/:login`).
- Aucun usage commercial, aucune revente de données, aucun contenu nuisible détecté.
- Mécanisme anti-farming (`packages/shared/src/anti-farming.ts`) : 1 match ELO par paire sur 3 jours, ce qui évite les abus.

**Statut : ✅** — Application sportive/pédagogique clairement bénéfique au réseau.

### 1.2 Accès réservé aux étudiants et Alumni

**Exigence :** L'accès est interdit aux candidats et aux anciens étudiants non Alumni.

**Dans le code :**
- L'accès repose sur un login OAuth 42 valide. Si 42 révoque l'accès OAuth d'un utilisateur, il ne peut plus se connecter.
- Aucune vérification côté 42 League du statut précis (étudiant actif / Alumni / candidat) : la donnée `kind` de l'API 42 n'est pas exploitée.

**Statut : ⚠️** — Le filtrage repose entièrement sur 42 OAuth (si le compte est valide, l'accès est accordé). La vérification du statut `kind` n'est pas implémentée. **Risque faible** car 42 contrôle qui peut s'authentifier, mais une vérification explicite renforcerait la conformité.

---

## Article 2 — Licence

### 2.1 Licence octroyée par 42 (limitée, non-exclusive, révocable)

**Exigence :** La licence ne peut être sous-licenciée ni transférée. L'API ne doit pas être utilisée autrement que prévu.

**Dans le code :**
- L'accès à l'API est effectué uniquement par le backend (`apps/backend/src/ft-api.ts`, `apps/backend/src/auth.ts`).
- Les credentials OAuth (`FT_OAUTH_UID`, `FT_OAUTH_SECRET`) sont en variables d'environnement, jamais exposés côté client.
- Aucun mécanisme de sous-licence ou de transfert de tokens 42 à des tiers.

**Statut : ✅**

### 2.2 Licence octroyée par l'Utilisateur à 42

**Exigence :** L'utilisateur octroie à 42 une licence sur le Contenu mis à disposition via l'API.

**Dans le code :**
- Cette clause s'applique au développeur (vous) vis-à-vis de 42, pas à l'implémentation technique.

**Statut : ✅** — Sans objet pour le code.

---

## Article 3 — Accès à l'API

### 3.1 Accès en lecture seule / pas de conservation locale sans consentement

**Exigence :** L'API est utilisable en lecture seule. La conservation locale de données est **strictement interdite sans consentement préalable de l'utilisateur final**.

**Dans le code :**
- Les données 42 conservées en base sont : `login`, `ftId`, `campus`, `imageUrl`.
- Ces données sont récupérées lors du login OAuth (`/v2/me`) et lors d'un refresh d'image (`/v2/users/:login`).
- Un **écran de consentement explicite** (`ConsentGate.tsx`) bloque l'accès à l'app au premier login : l'utilisateur doit cliquer « Accepter et continuer » avant tout usage.
- Le consentement est **enregistré comme preuve** (CGU Art. 4.2) : `termsAcceptedAt` + `termsVersion` sur la ligne `User` (cf. `schema.prisma`). Si la politique évolue, `CURRENT_TERMS_VERSION` est incrémentée et le consentement est re-demandé.
- **Application côté serveur (défense en profondeur)** : la consent-gate dans `index.ts` (`app.use('*', …)`) refuse en `403 consent_required` tout endpoint portant des données 42 tant que le consentement n'est pas enregistré — la modale frontend ne peut donc pas être contournée.
- En cas de refus (`POST /me/consent {accept:false}`), le compte est supprimé (compte vierge) ou anonymisé (compte avec historique) — aucune donnée n'est conservée sans consentement.
- L'utilisateur peut toujours supprimer ses données via `DELETE /me/account`.

**Statut : ✅** — Consentement explicite recueilli avant tout traitement, preuve horodatée + versionnée conservée, et application stricte côté serveur.

### 3.2 Authentification — Confidentialité des tokens et secrets

**Exigence :** Les tokens et secrets doivent être strictement confidentiels, non partagés, conservés de façon sécurisée. Le token 42 est valable 2h.

**Dans le code :**
- `FT_OAUTH_UID` et `FT_OAUTH_SECRET` sont en variables d'environnement serveur, jamais exposés au client.
- Le fichier `.env.example` ne contient pas les vraies valeurs.
- Le token 42 (OAuth `access_token`) est utilisé immédiatement pour récupérer le profil et n'est **pas stocké en base** : il est jetable après usage.
- Le token applicatif (`client_credentials`) est caché en mémoire serveur avec invalidation 30s avant expiration (`ft-api.ts`).
- Les tokens de session 42 League (HMAC-SHA256) sont dans `localStorage` côté web et `chrome.storage.local` côté extension.
- Les cookies de session sont `httpOnly`, `SameSite: Lax`, `Secure: true` en production.

> ⚠️ **Point critique documenté :** Le secret OAuth (`FT_OAUTH_SECRET`) a été exposé dans une conversation (référencé dans `security-patches.md`). Une rotation sur intra.42.fr est requise.

**Statut : ⚠️** — Architecture globalement sécurisée, mais la rotation du secret compromis est impérative. Le token 42 n'est pas stocké en base (bonne pratique), mais le token de session 42 League dans `localStorage` est exposé aux XSS.

---

## Article 4 — Règles relatives à l'utilisation des Données

### 4.1 Pratiques Interdites

#### Accès illégal ou incompatible avec les CGU

**Statut : ✅** — Usage conforme, lecture seule, pas d'ingénierie inverse.

#### Collecte sans consentement / en violation des CGU

**Dans le code :**
- Données collectées : login, campus, photo (minimisation appliquée).
- Politique de confidentialité disponible dans l'About.
- Consentement explicite recueilli via `ConsentGate.tsx` et appliqué côté serveur (voir section 3.1).

**Statut : ✅** — Le consentement explicite est désormais formalisé par une action utilisateur dédiée avant tout traitement.

#### Discrimination

**Statut : ✅** — Aucun traitement discriminatoire. Classement ELO purement sportif.

#### Vente ou licence des données

**Statut : ✅** — Aucune vente, aucune monétisation des données 42.

#### Ingénierie inverse / interférence avec l'API

**Statut : ✅** — Utilisation standard de l'API REST publique documentée.

#### Mise à disposition hors environnement 42

**Exigence :** Les données ne doivent pas être placées sur un moteur de recherche ou hors du Réseau 42.

**Dans le code :**
- Le webhook Discord (`audit.ts`) envoie des notifications admin mais **sans données personnelles identifiables** (login anonymisé avant envoi selon le code).
- **Toutes les routes exposant des données 42 exigent désormais une authentification** (`getCurrentLogin`). Audit effectué sur `index.ts` : sur ~60 routes, seule `GET /health` est publique (et ne renvoie que `{ ok: true }`).
- Les 3 routes qui fuyaient des données sans auth ont été corrigées : `GET /tournaments`, `GET /tournaments/:id`, `GET /ops`.

**Statut : ✅** — Aucune donnée 42 (login, photo, ELO) n'est accessible sans être un étudiant 42 connecté. Le cloisonnement « strictement au sein du Réseau 42 » est respecté, l'hébergement externe (Scaleway) étant sans incidence puisque l'accès aux données reste réservé aux utilisateurs 42 authentifiés.

#### Accès par un tiers non autorisé

**Statut : ✅** — L'accès à l'API 42 est uniquement via le backend serveur contrôlé par le développeur.

#### Usage promotionnel sans autorisation

**Statut : ✅** — Aucune communication promotionnelle via les données 42.

### 4.2 Consentement et information des personnes

**Exigence :** Consentement explicite, libre, éclairé avant toute collecte. Politique de confidentialité complète. Droits des utilisateurs exercisables.

**Dans le code :**

| Élément | Implémentation |
|---------|---------------|
| Politique de confidentialité | `AboutPage.tsx` — onglet Confidentialité |
| Nature des données collectées | Décrite (login, campus, photo, historique matchs) |
| Finalité du traitement | Décrite (classement ELO, sports) |
| Base légale | Art. 6(1)(f) RGPD (intérêt légitime) |
| Droit d'accès & portabilité | `GET /me/export` — export JSON |
| Droit à l'effacement | `DELETE /me/account` — anonymisation |
| Droit de rectification | Via email de contact |
| Contact responsable | `abidaux@student.42lehavre.fr` |
| Consentement au moment du login | **Non formalisé par action explicite** |

**Statut : ⚠️** — La politique de confidentialité est complète. Mais le consentement n'est pas recueilli par une action dédiée (case à cocher, écran de consentement). La base légale « intérêt légitime » doit être documentée et justifiée formellement.

### 4.3 Sécurité des Données et Applications

**Exigence :** Confidentialité, intégrité, disponibilité. Chiffrement en transit et au repos. Pseudonymisation. Politique de mots de passe. Sauvegardes.

**Dans le code :**

| Mesure de sécurité | Implémentation |
|-------------------|----------------|
| HTTPS en transit | Caddy (reverse proxy), `Secure: true` sur cookies |
| Tokens signés HMAC-SHA256 | `tokens.ts` — timing-safe comparison |
| Cookies HttpOnly + SameSite | `auth.ts` lignes 250-257 |
| Pas de stockage du token 42 | Token 42 jeté après usage immédiat |
| Rate limiting | `rate-limit.ts` — global (600/min), auth (50/15min), write (120/min) |
| Validation des entrées | Zod schemas sur toutes les mutations |
| Audit log admin | `audit.ts` — toutes les actions admin tracées |
| Rotation secret mensuelle | Gérée par 42 (côté API 42) |
| Chiffrement au repos | Non documenté dans le code (dépend de la config PostgreSQL/Scaleway) |
| Pseudonymisation | Anonymisation via `anon_{hash}` sur suppression de compte |
| Sauvegardes | Non documenté dans le code (dépend de l'infra Scaleway) |

**Statut : ⚠️** — Sécurité applicative solide. Les points non documentés (chiffrement au repos PostgreSQL, politique de sauvegardes) dépendent de la configuration serveur Scaleway, mais doivent être vérifiés et documentés.

### 4.4 Accès et modification des Données

**Exigence :** Tenir les données à jour. Permettre à l'utilisateur de demander accès, modification, suppression facilement.

**Dans le code :**
- Export JSON : `GET /me/export` accessible depuis `ReglagesPage.tsx` (bouton visible).
- Suppression : `DELETE /me/account` accessible depuis `ReglagesPage.tsx` (bouton visible).
- Modification des données 42 (login, campus, photo) : **non modifiable côté 42 League** (ces données viennent de l'API 42, elles sont mises à jour au login ou via `REFRESH_IMAGES`).
- Contact pour rectification : email `abidaux@student.42lehavre.fr`.

**Statut : ✅** — Accès et suppression facilement accessibles dans les réglages. La rectification est gérée par email (acceptable pour des données issues d'une source externe).

### 4.5 Conservation et suppression des Données

**Exigence :** Supprimer les données dès que la conservation n'est plus nécessaire, ou sur demande.

**Dans le code :**
- `DELETE /me/account` : anonymisation (login → `anon_{sha256_slice}`, ftId → null, campus → null, imageUrl → null, title → null, `anonymizedAt` set).
- L'historique des matchs est conservé anonymisé (lié à l'`anonLogin`).
- Les logs admin sont conservés 24 mois (mention dans `AboutPage.tsx`).
- Aucune suppression automatique basée sur l'inactivité.

**Statut : ⚠️** — L'anonymisation est une pratique acceptable (les matchs ont valeur de données sportives historiques). Cependant, l'absence de suppression complète doit être explicitement justifiée dans la politique de confidentialité (ce qui est partiellement fait). **À documenter** : durée de conservation des données des utilisateurs actifs et des logs (actuellement 24 mois pour les logs admin, mais pas de durée définie pour les profils actifs).

---

## Article 5 — Limitation de responsabilité

**Exigence :** L'utilisateur est responsable de l'usage de l'API et doit en respecter les conditions.

**Dans le code :**
- La politique de confidentialité mentionne la responsabilité de l'application.
- Les CGU de l'application ne sont pas formalisées dans un document dédié accessible aux utilisateurs.

**Statut : ⚠️** — **Action recommandée :** Rédiger des CGU 42 League accessibles aux utilisateurs finaux, distinctes de la politique de confidentialité, couvrant les responsabilités de l'application.

---

## Article 6 — Notification des risques et compromission

**Exigence :** Signaler tout risque à `security@42.fr`. Révoquer immédiatement les clés compromises.

**Dans le code :**
- `security-patches.md` documente une ancienne exposition du `FT_OAUTH_SECRET`.
- **La clé présente dans le repo n'est plus valide** (rotation effectuée) → le risque technique est neutralisé : un attaquant ne peut rien faire de l'ancien secret.
- Aucun mécanisme automatique de notification à 42 n'est implémenté.

**Statut : ⚠️** — Risque technique neutralisé (clé révoquée/invalide). La notification à `security@42.fr` reste recommandée par les CGU mais n'a pas été envoyée (choix assumé, impact résiduel faible vu que la clé est morte).

---

## Article 7 — Modifications des CGU

**Exigence :** Surveiller les mises à jour des CGU.

**Statut : ✅** — Sans objet pour le code. À surveiller manuellement.

---

## Article 8 — Garanties

**Exigence :** L'API est fournie "en l'état", sans garantie.

**Dans le code :**
- L'application gère les erreurs API 42 (timeouts, réponses inattendues) via try/catch dans `ft-api.ts`.
- Le token applicatif est renouvelé automatiquement avec buffer de 30s.

**Statut : ✅** — L'application est résiliente aux interruptions de l'API 42.

---

## Charte d'utilisation

### À faire

| Obligation | Implémentation |
|-----------|---------------|
| Respecter CGU intranet et API | ✅ Usage conforme |
| Respecter lois et réglementations (PI, données, vie privée) | ✅ RGPD implémenté (voir sections ci-dessus) |
| Préserver confidentialité des mots de passe et infos de connexion | ⚠️ Secret OAuth compromis (voir Article 6) |
| Aviser 42 en cas d'activité non autorisée ou violation de sécurité | ❌ Non-conformité documentée non encore signalée à 42 |

### À ne pas faire

| Interdiction | Statut |
|-------------|--------|
| Permettre à un tiers non autorisé d'accéder à l'API | ✅ Accès uniquement via backend contrôlé |
| Partager ou transférer le compte API | ✅ Credentials en variables d'environnement serveur |
| Envoyer des communications non sollicitées / spam | ✅ Aucun système de communication de masse |
| Enfreindre la vie privée ou partager des PII sans autorisation | ✅ Consentement explicite + cloisonnement (sections 3.1, 4.2) |
| Se livrer à des activités illégales | ✅ Application sportive légale |

---

## Synthèse et actions prioritaires

### ✅ Corrigé dans cette itération (2026-05-31)

- **Consentement RGPD explicite** : écran-barrière `ConsentGate.tsx` au premier login, preuve horodatée + versionnée (`termsAcceptedAt`/`termsVersion`), application stricte côté serveur via consent-gate (`403 consent_required`). Refus = suppression/anonymisation immédiate. *(Articles 3.1, 4.2)*
- **Cloisonnement complet des routes** : `GET /tournaments`, `GET /tournaments/:id` et `GET /ops` exigent désormais une authentification 42 League — plus aucune donnée 42 accessible hors du Réseau 42. *(Article 3, 4.1)*

### ⚠️ Actions recommandées restantes

1. **Documenter la durée de conservation** des données des utilisateurs actifs dans la politique de confidentialité (actuellement, seule la durée des logs admin — 24 mois — est mentionnée).

2. **Vérifier et documenter le chiffrement au repos** de la base PostgreSQL sur Scaleway.

3. **Rédiger des CGU 42 League** accessibles aux utilisateurs finaux (distinctes de la politique de confidentialité).

4. **Envisager la vérification du statut `kind`** via l'API 42 pour bloquer les candidats non-étudiants.

### ℹ️ Écarté (choix assumé)

- **Notification à `security@42.fr`** : non envoyée. Le secret OAuth exposé a été révoqué (clé du repo invalide) → risque technique neutralisé.

### ✅ Points conformes

- Usage bénéfique au Réseau 42 (classement sportif pédagogique)
- Lecture seule de l'API 42, données minimisées
- Consentement explicite avant tout traitement (preuve conservée)
- Cloisonnement strict : toutes les routes de données exigent une auth 42
- Credentials OAuth sécurisés côté serveur
- Token 42 non stocké en base
- Rate limiting applicatif
- Politique de confidentialité présente et complète
- Droits RGPD exercisables (export + suppression dans les réglages)
- Anonymisation sur suppression de compte
- Sécurité applicative solide (HMAC, HttpOnly cookies, Zod validation, audit log)
- Aucune vente ou licence des données

---

*Rapport généré le 2026-05-31 — à mettre à jour lors de chaque évolution significative de l'application ou des CGU.*
