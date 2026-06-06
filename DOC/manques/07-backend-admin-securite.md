# Manques — Backend / Admin / Sécurité / Infra

> Document de **dette technique et incomplétudes** du domaine BACKEND / ADMIN / GOD /
> ANALYTICS / SÉCURITÉ / INFRA / EXTENSION. On y documente **ce qui manque**, pas ce
> qui marche déjà. Les failles de l'`AUDIT_CYBER_2026-06-05.md` **toutes corrigées**
> ne sont **pas** reprises ici (sauf reliquats de durcissement explicitement non
> traités). On part de l'existant réel du code (`apps/backend/src`, `apps/extension`)
> et des trous listés dans `SECURITY.md` → « Ce qui n'est PAS encore en place ».
>
> Convention de gabarit par manque :
> **État actuel** (fichier:ligne) · **Ce qui manque / problème** · **Fichiers concernés**
> · **Piste d'implémentation** · **Effort** S/M/L · **Priorité**.
>
> Échelle de priorité : 🔴 haute · 🟠 moyenne · 🟢 basse · ⚪ confort/dette lointaine.

---

## Table des matières

1. [Scheduler & jobs de fond (timers volatils)](#1-scheduler--jobs-de-fond-timers-volatils)
2. [Scalabilité mono-process (SSE, timers, rate-limit en mémoire)](#2-scalabilité-mono-process-sse-timers-rate-limit-en-mémoire)
3. [Rôles, permissions & panneau GOD](#3-rôles-permissions--panneau-god)
4. [Modération & audit log](#4-modération--audit-log)
5. [Analytics d'usage (AnalyticsEvent / STATS)](#5-analytics-dusage-analyticsevent--stats)
6. [Authentification, sessions & tokens](#6-authentification-sessions--tokens)
7. [Secrets & rotation](#7-secrets--rotation)
8. [Observabilité (logs, métriques, traces, alerting)](#8-observabilité-logs-métriques-traces-alerting)
9. [RGPD — export, suppression, anonymisation](#9-rgpd--export-suppression-anonymisation)
10. [Robustesse — transactions, idempotence, cohérence](#10-robustesse--transactions-idempotence-cohérence)
11. [Déploiement, Docker & CI/CD](#11-déploiement-docker--cicd)
12. [Sauvegardes & reprise après sinistre (DR)](#12-sauvegardes--reprise-après-sinistre-dr)
13. [Tests backend](#13-tests-backend)
14. [Extension navigateur](#14-extension-navigateur)
15. [Reliquats de durcissement sécurité (post-audit)](#15-reliquats-de-durcissement-sécurité-post-audit)
16. [Récapitulatif priorisé](#16-récapitulatif-priorisé)

---

## 1. Scheduler & jobs de fond (timers volatils)

Le cœur du problème : **il n'existe aucun scheduler durable**. Toute la planification
repose sur des `setTimeout`/`setInterval` **en mémoire du process Node**, perdus à
chaque redéploiement (et le projet redéploie à chaque push sur `develop`/`main`).
Des palliatifs de « re-scheduling au boot » existent pour les OPS mais pas pour tout,
et restent fragiles.

### 1.1 — Aucun scheduler persistant (jobs perdus au redémarrage)

- **État actuel** : `index.ts:8272-8312` : au boot, on appelle `rescheduleOpsTimers()`,
  `sweepExpiredOpsBets()` puis on cale les purges via `setTimeout(msUntil3am)` +
  `setInterval(24h)`. Tout vit dans la heap du process unique.
- **Ce qui manque / problème** :
  - À chaque déploiement (fréquent : staging à chaque push), **les `setInterval` de
    purge sont relancés et le timer « 03h00 » est recalculé** → si on déploie 10 fois
    dans la journée, le « cron de minuit » n'arrive jamais à 03h00 réel autrement que
    par chance (chaque boot rappelle `runDailyPurges()` immédiatement, ce qui masque
    le bug mais rend le timing imprévisible et redondant).
  - Aucune **persistance d'état de job** (dernier run, succès/échec, lock) : impossible
    de savoir si une purge a tourné, ni d'éviter qu'elle tourne deux fois.
  - Pas de **leader election** : avec 2 instances backend (cf. §2), **chaque** instance
    exécuterait purges/anonymisations en parallèle → double traitement.
- **Fichiers concernés** : `index.ts:8272-8312`, `purgeOldAuditLogs`/`purgeStalePendingMatches`/`purgeScheduledDeletions` (8210-8265), `rate-limit.ts:29-44` (sweeper).
- **Piste d'implémentation** : introduire un vrai mécanisme de jobs durables — table
  `ScheduledJob` (type, runAt, status, lockedAt, lockedBy) interrogée par un tick unique,
  **ou** une lib (`croner`/`node-cron` pour le timing + un advisory lock Postgres
  `pg_advisory_lock` pour la mono-exécution), **ou** déléguer à `pg_cron`/un cron système
  qui `curl` un endpoint protégé `POST /admin/jobs/run`. Au minimum : un **verrou DB**
  (advisory lock) autour de chaque purge pour la rendre idempotente multi-instances.
- **Effort** M · **Priorité** 🟠

### 1.2 — Timers d'expiration des OPS en RAM (best-effort)

- **État actuel** : `index.ts:5576-5603` : `scheduleOpsTimers()` programme deux
  `setTimeout` (expiration + fin de cooldown) qui émettent un SSE. `rescheduleOpsTimers()`
  les recrée au boot pour les OPS encore vivants.
- **Ce qui manque / problème** :
  - Si le process redémarre **pile entre l'expiration d'un OPS et le boot suivant**,
    l'event `ops:update` « expired » **n'est jamais émis** : les clients connectés ne
    sont rafraîchis qu'à leur prochaine requête (la lecture filtre `expiresAt > now`,
    donc la donnée est correcte, mais le **push temps réel manque** → UI figée jusqu'au
    refresh). `sweepExpiredOpsBets()` est rejoué au boot pour solder les paris, mais
    **pas** l'émission SSE de transition.
  - `scheduleOpsTimers` ne gère que des délais < ~24,8 j (limite `setTimeout`) ; OK pour
    24h mais aucune garde explicite si `OPS_COOLDOWN_MS` grossissait.
- **Fichiers concernés** : `index.ts:5569-5603`, `5581-5592`, `8281-8287`.
- **Piste d'implémentation** : remplacer les timers volatils par un **tick périodique**
  (toutes les 30-60 s) qui détecte les transitions « vient d'expirer » / « cooldown
  terminé » via la DB et émet les SSE — déterministe, survit aux redémarrages, et
  fonctionne avec le scheduler durable du §1.1.
- **Effort** M · **Priorité** 🟢

### 1.3 — Expiration des matchs/défis : purge quotidienne, pas temps réel

- **État actuel** : `purgeStalePendingMatches()` (`index.ts:8217-8244`) ne tourne **qu'au
  boot puis 1×/jour à 03h00**. `PENDING_MATCH_TTL_HOURS=72`. Un PendingMatch expiré
  reste donc visible jusqu'à **72h + délai jusqu'au prochain run** (jusqu'à ~96h).
  À noter : `pending.md:17` marque encore « Expiration des matchs pending » comme **non
  fait** (`[ ]`) — le job existe pourtant ; la doc pending est **désynchronisée**.
- **Ce qui manque / problème** : pas d'expiration « au fil de l'eau », latence d'1 jour ;
  doc `pending.md` incohérente avec le code.
- **Fichiers concernés** : `index.ts:8217-8244`, `8288-8311`, `DOC/pending.md:17`.
- **Piste d'implémentation** : descendre la cadence du job (ex. toutes les heures) ou
  filtrer côté lecture comme pour les OPS ; corriger `pending.md`.
- **Effort** S · **Priorité** 🟢

### 1.4 — Pas de healthcheck applicatif profond ni de readiness/liveness distinct

- **État actuel** : `GET /health` renvoie `c.json({ ok: true })` **statique**
  (`index.ts:920`) — il ne teste **ni la DB ni rien**. Le healthcheck Docker du backend
  n'est pas dans le Dockerfile (seul Postgres a un `pg_isready` dans les composes,
  `docker-compose.registry.yml:13`).
- **Ce qui manque / problème** : `/health` répond `200` même si Postgres est tombé →
  le conteneur est « sain » alors que toute requête métier échoue ; aucune distinction
  **liveness** (process vivant) vs **readiness** (dépendances OK) ; pas de sonde de
  scheduler/jobs.
- **Fichiers concernés** : `index.ts:920`, `apps/backend/Dockerfile`, `docker-compose*.yml`.
- **Piste d'implémentation** : `/health` (liveness, léger) + `/ready` (readiness :
  `SELECT 1` Prisma + statut des jobs + version migration) ; ajouter un `HEALTHCHECK`
  dans le Dockerfile backend pointant `/ready`. Attention à laisser `/health` et `/ready`
  **hors consent-gate** (déjà le cas pour `/health`, `index.ts:155`).
- **Effort** S · **Priorité** 🟠

---

## 2. Scalabilité mono-process (SSE, timers, rate-limit en mémoire)

Toute l'architecture **suppose un unique process backend** par environnement. C'est
acceptable pour un seul campus, mais c'est une **dette d'infra** qui empêche tout scale
horizontal et crée des SPOF.

### 2.1 — SSE in-memory : impossible de scaler à >1 instance

- **État actuel** : `sse.ts:9` : `connections = new Map<string, Set<...>>` — registre
  **local au process**. `emit()`/`broadcast()` itèrent cette map.
- **Ce qui manque / problème** : avec 2+ instances backend derrière un load-balancer,
  un `emit(['alice'])` déclenché sur l'instance A **ne touche pas** la connexion SSE
  d'alice ouverte sur l'instance B. Le plafond `MAX_SSE_PER_LOGIN=5` (`sse.ts:16`) est
  aussi **par instance**, donc 5×N globalement.
- **Fichiers concernés** : `sse.ts` (intégral), tous les `emit()`/`broadcast()` de `index.ts`.
- **Piste d'implémentation** : si scale-out un jour nécessaire → bus pub/sub (Redis
  pub/sub, Postgres `LISTEN/NOTIFY`) qui relaie les events à toutes les instances ;
  sinon **documenter explicitement la contrainte « 1 réplique »** et la verrouiller dans
  le compose (`deploy.replicas: 1`) pour éviter un scale accidentel silencieux.
- **Effort** L · **Priorité** 🟢 (acceptable tant que mono-campus, mais à tracer)

### 2.2 — Rate-limit & pénalités en mémoire (réinitialisés au déploiement, non partagés)

- **État actuel** : `rate-limit.ts:16-17` : `bucketStores` et `penaltyStore` sont des
  `Map` **process-local**. Le cache `isAdminRequest` (30 s) est aussi local
  (`index.ts:215`).
- **Ce qui manque / problème** :
  - **Reset à chaque déploiement** : un attaquant pénalisé 8h voit son blocage effacé
    au prochain redéploiement.
  - **Non partagé entre instances** (si scale-out) → plafonds effectifs × N.
  - **`DELETE /admin/rate-limit/me`** (`clearPenalty`) ne débloque que l'instance qui
    reçoit la requête.
- **Fichiers concernés** : `rate-limit.ts:16-44,129-136`, `index.ts:215`.
- **Piste d'implémentation** : backend Redis (TTL natif, `INCR`/`EXPIRE`) pour buckets +
  pénalités si on veut de la persistance/partage ; sinon accepter la limite (mono-instance,
  bêta) et la documenter. Au minimum, noter que le rate-limit est **éphémère par design**.
- **Effort** M · **Priorité** 🟢

### 2.3 — Caches applicatifs locaux (team photos, admin) non invalidables globalement

- **État actuel** : `teamPhotoCache` (`index.ts:1343`, TTL), cache `isAdminRequest`
  (30 s). Locaux au process.
- **Ce qui manque / problème** : pas de cohérence inter-instances ; un changement de
  rôle met jusqu'à 30 s à être pris en compte par le cache admin (acceptable mais à
  connaître). Pas de manque bloquant, dette mineure.
- **Fichiers concernés** : `index.ts:215,1343-1366`.
- **Piste d'implémentation** : OK en l'état ; documenter le TTL d'éventuelle latence
  d'élévation/révocation de rôle.
- **Effort** S · **Priorité** ⚪

---

## 3. Rôles, permissions & panneau GOD

L'autorisation est globalement saine (`requireAdmin`/`requirePerm`/`requireSuperAdmin`,
SUPERADMIN hardcodés). Les manques portent sur la **granularité**, la **gouvernance**
des SUPERADMIN et l'absence de garde-fous renforcés.

### 3.1 — SUPERADMIN hardcodés en deux endroits, pas de 2FA, pas de sudo mode

- **État actuel** : la liste SUPERADMIN vit **dans le code** (`SUPERADMINS` dans
  `index.ts`, ré-imposée à chaque login) **et** `admins.ts:8-11` maintient une **2ᵉ
  liste** `ADMINS` (`throbert`, `abidaux`) pour les tournois officiels / force-result.
  `SECURITY.md` liste 2FA TOTP et « sudo mode » comme **non implémentés**.
- **Ce qui manque / problème** :
  - **Deux sources de vérité** (`SUPERADMINS` vs `ADMINS`/`isAdmin()`) à maintenir en
    parallèle — risque de divergence (un founder ajouté à l'une, oublié de l'autre).
    L'audit l'avait noté en « info » (incohérence `isAdmin()` vs rôle DB).
  - **Aucune ré-authentification (sudo)** avant les actions destructives (`RESET_DATABASE`,
    `BAN_USER`, `SET_ROLE`, bascule de saison). Un compte SUPERADMIN compromis = pouvoir
    total immédiat.
  - **Aucun 2FA** : la seule barrière est l'OAuth 42 (lui-même sans MFA garanti côté 42).
- **Fichiers concernés** : `admins.ts`, `index.ts` (`SUPERADMINS`, `getUserRole`,
  `getOrCreateUser`), `SECURITY.md:711-724`.
- **Piste d'implémentation** : (a) unifier sur **une** source (table `Founder`/flag DB,
  ou un seul tableau exporté réutilisé partout) ; (b) **sudo mode** : un token court
  (TTL 5 min, scope `sudo`) délivré après re-clic/re-auth, exigé par les routes
  destructives ; (c) 2FA TOTP optionnel pour SUPERADMIN.
- **Effort** M (sudo) / L (2FA) · **Priorité** 🟠

### 3.2 — Permissions modérateur : pas de portée temporelle ni de scoping fin

- **État actuel** : `MODERATOR_PERMISSIONS` (flags booléens dans la colonne JSON
  `moderatorPermissions`) débloque des routes (`SECURITY.md:446-462`). Tout-ou-rien par
  capacité.
- **Ce qui manque / problème** :
  - Pas de **permissions temporaires** (modérateur d'un événement le temps d'un tournoi).
  - Pas de **scoping** (ex. « peut bannir mais seulement sur la discipline X » / « mod
    d'un seul tournoi »).
  - Pas de **journal de qui a accordé quelle permission à qui** au-delà de l'action
    `SET_MODERATOR_PERMISSIONS` (le payload est-il systématiquement renseigné ? à
    vérifier — `audit.ts` log `payload` mais c'est l'appelant qui le remplit).
  - La colonne JSON n'est **pas typée en DB** : un flag mal nommé passe silencieusement
    (seul le front/`MODERATOR_PERMISSIONS` fait foi).
- **Fichiers concernés** : `index.ts` (`MODERATOR_PERMISSIONS`, `requirePerm`),
  schema `User.moderatorPermissions`.
- **Piste d'implémentation** : table `ModeratorGrant` (perm, scope, grantedBy, expiresAt)
  si le besoin de finesse émerge ; sinon valider strictement les clés du JSON à l'écriture.
- **Effort** M · **Priorité** 🟢

### 3.3 — Pas de garde-fou « 4 yeux » ni de quota sur actions destructives

- **État actuel** : `RESET_DATABASE` exige une **phrase de confirmation** exacte
  (`SECURITY.md:324`) — c'est la seule barrière renforcée. Les bans/role changes/edits
  ELO sont immédiats et unilatéraux.
- **Ce qui manque / problème** : aucun **rate-limit métier** sur les actions admin (un
  admin compromis peut bannir 500 comptes en boucle — les admins sont **exemptés** du
  rate-limit HTTP, cf. `SECURITY.md:343`), pas de **dual-control** (2ᵉ admin valide) sur
  le reset DB, pas d'**annulation** (`UNBAN` existe mais pas de « undo » générique des
  edits de stats).
- **Fichiers concernés** : routes `/admin/*` de `index.ts`, `audit.ts`.
- **Piste d'implémentation** : seuil d'alerte Discord si > N actions destructives /
  fenêtre par un même acteur ; option dual-control sur `RESET_DATABASE`.
- **Effort** M · **Priorité** 🟢

### 3.4 — Panneau GOD : 13 onglets, pas tous gardés finement côté UI ; pas d'export

- **État actuel** : `GODPage.tsx:40` — 13 onglets (`users`, `moderation`, `rejets`,
  `matches`, `pending`, `ideas`, `bugs`, `alertes`, `audit`, `history`, `seasons`,
  `tournaments`, `stats`). Le vrai contrôle est serveur (bien).
- **Ce qui manque / problème** :
  - Les onglets sensibles (`seasons`, `pending` = SUPERADMIN) sont rendus côté client ;
    si la garde UI diffère de la garde serveur, un MODERATOR voit des onglets vides/403
    (UX, pas sécu).
  - **Pas d'export** (CSV/JSON) de l'audit log ni des stats depuis l'UI pour archivage
    forensique externe.
  - Aucune **pagination serveur** visible sur les gros onglets (audit limité à 500/appel,
    mais `history`/`matches` ?) — à confirmer, risque de payloads lourds.
- **Fichiers concernés** : `apps/web/src/pages/GODPage.tsx`, routes `/admin/*`.
- **Piste d'implémentation** : harmoniser visibilité onglet ↔ rôle ; bouton « Exporter »
  sur AUDIT/STATS ; pagination curseur sur les listes admin.
- **Effort** M · **Priorité** 🟢

---

## 4. Modération & audit log

L'audit log (`AdminAuditLog` + Discord) est solide. Manques sur la **couverture**, la
**fiabilité de la notif** et l'**immuabilité**.

### 4.1 — Notification Discord d'audit appauvrie & non fiabilisée

- **État actuel** : `audit.ts:72-89` : `notifyDiscord(action)` ne poste **que l'emoji +
  le nom de l'action** (`${emoji} **${action}**`). Aucun acteur, cible, IP, payload —
  délibérément (commentaire RGPD ligne 45). En **staging, aucune notif** (filtre
  `APP_ENV==='staging'`, ligne 76).
- **Ce qui manque / problème** :
  - Le message Discord est **trop pauvre pour le forensic temps réel** : un `BAN_USER`
    ne dit pas **qui** a banni **qui**. Il faut ouvrir l'onglet AUDIT pour le savoir.
    (Compromis RGPD compréhensible, mais on pourrait inclure au moins l'acteur, qui est
    un membre interne consentant.)
  - **Fire-and-forget sans retry** (`void notifyDiscord(...).catch`) : si le webhook est
    momentanément KO, **la notif est perdue** (l'entrée DB reste, c'est le filet).
  - **Pas de rate-limit/anti-spam** sur les posts Discord : une boucle d'actions inonde
    le canal.
- **Fichiers concernés** : `audit.ts:67-89`.
- **Piste d'implémentation** : enrichir le message (acteur + action + cible hashée/pseudo),
  ajouter un retry léger ou une file ; throttler les posts ; rendre staging configurable.
- **Effort** S · **Priorité** 🟢

### 4.2 — Audit log non immuable (un SUPERADMIN peut le purger/altérer)

- **État actuel** : `AdminAuditLog` est une table Prisma normale ; `purgeOldAuditLogs()`
  fait un `deleteMany` après 24 mois (`index.ts:8210-8215`, RGPD Art. 5). Rien
  n'empêche techniquement un accès DB direct (ou une future route) de modifier/supprimer
  des lignes.
- **Ce qui manque / problème** : un audit log **forensique** doit être append-only et
  idéalement vérifiable (chaînage de hash) pour résister à un admin malveillant qui
  efface ses traces. Aujourd'hui : aucune protection d'intégrité, aucun WORM, le
  `RESET_DATABASE` pourrait emporter l'audit lui-même (à vérifier dans la logique de
  reset).
- **Fichiers concernés** : `audit.ts`, `index.ts` (reset DB, `purgeOldAuditLogs`),
  schema `AdminAuditLog`.
- **Piste d'implémentation** : chaînage de hash (`prevHash` + `hash` par ligne) pour
  détecter une altération ; export périodique offsite (Discord/S3) ; s'assurer que le
  reset DB **préserve** l'audit log.
- **Effort** M · **Priorité** 🟠

### 4.3 — Couverture d'audit : certaines actions sensibles non tracées ?

- **État actuel** : enum `AdminAction` couvre 18 actions (`audit.ts:13-31`,
  `SECURITY.md:50-68`). Routes wrappées listées `SECURITY.md:113-130`.
- **Ce qui manque / problème** : à vérifier que **toutes** les mutations sensibles
  loggent — notamment : `grantItemTx`/grant boutique admin (`index.ts:8203`), création
  de saison (`POST /seasons`), `force-accept`/`force-result` de tournoi
  (`SECURITY.md:530-531`), modifs de catalogue Shop (`POST/PATCH /admin/shop/items`).
  Plusieurs de ces actions **n'ont pas d'`AdminAction` dédié** dans l'enum → soit elles
  ne sont pas auditées, soit mappées sur une action générique imprécise.
- **Fichiers concernés** : `index.ts` (routes admin saison/shop/tournoi force), enum
  `AdminAction`.
- **Piste d'implémentation** : audit de couverture endpoint-par-endpoint ; ajouter les
  `AdminAction` manquants (`GRANT_ITEM`, `CREATE_SEASON`, `FORCE_RESULT`,
  `EDIT_SHOP_ITEM`…) ; test qui asserte que chaque route `/admin` mutante appelle
  `logAdminAction`.
- **Effort** M · **Priorité** 🟠

### 4.4 — `extractIp` fait confiance à `x-forwarded-for` pour l'IP loggée

- **État actuel** : `audit.ts:33-40` lit `cf-connecting-ip` → `x-forwarded-for[0]` →
  `x-real-ip`. L'audit cyber a corrigé le rate-limit (Caddy écrase XFF avec
  `{remote_host}`), mais `extractIp` **préfère encore `x-forwarded-for` avant
  `x-real-ip`**.
- **Ce qui manque / problème** : si Caddy pose `x-real-ip` mais qu'un client a injecté
  un `x-forwarded-for`, l'**IP enregistrée dans l'audit** pourrait être spoofée → traces
  forensiques empoisonnées (moins grave que le rate-limit, mais c'est du forensic). À
  confirmer selon ce que Caddy réécrit exactement.
- **Fichiers concernés** : `audit.ts:33-40`, `Caddyfile`.
- **Piste d'implémentation** : aligner `extractIp` sur la même source de confiance que
  `clientIp` (`rate-limit.ts:47-53`) ; privilégier l'IP posée par le proxy de confiance.
- **Effort** S · **Priorité** 🟢

---

## 5. Analytics d'usage (AnalyticsEvent / STATS)

Télémétrie récente : `POST /analytics/track` (batch best-effort) + `GET
/admin/stats/overview` (onglet STATS). Fonctionnel mais minimal.

### 5.1 — Aucune rétention/purge des `AnalyticsEvent` (croissance illimitée)

- **État actuel** : `index.ts:6847-6866` insère les events ; modèle `AnalyticsEvent`
  (`schema.prisma:763-777`) avec index `createdAt`/`type,name`/`login,createdAt`. **Aucun
  job de purge** ne nettoie cette table (contrairement à l'audit log purgé à 24 mois et
  aux pending purgés à 72h).
- **Ce qui manque / problème** : la table **grossit indéfiniment** (un pageview par
  navigation × tous les users). À terme : gonflement DB, `groupBy`/`distinct` de plus en
  plus lents (`stats/overview` fait plusieurs `findMany distinct` + `groupBy` sans
  borne de période côté stockage — seule la **requête** est fenêtrée par `?days`).
  Risque RGPD aussi : conservation sans limite de données de navigation nominatives
  (liées au `login`).
- **Fichiers concernés** : `index.ts:6847-6866`, `schema.prisma:763-777`,
  jobs de purge (`index.ts:8210-8265`).
- **Piste d'implémentation** : ajouter `purgeOldAnalyticsEvents()` au `runDailyPurges`
  (ex. rétention 90-180 j) ; envisager une **agrégation/rollup** (table de compteurs
  journaliers) pour garder l'historique long sans les lignes brutes nominatives.
- **Effort** S · **Priorité** 🟠

### 5.2 — Analytics nominatives liées au `login` sans pseudonymisation ni opt-out

- **État actuel** : chaque event porte `login` (FK `User`, cascade delete). Pas de flag
  de consentement spécifique à la télémétrie ; le consent-gate global couvre l'accès mais
  `/analytics/track` ... est-il exempté ? (`CONSENT_EXEMPT_PATHS` ne l'inclut pas, donc
  un user non-consentant ne peut pas tracker — OK, mais le tracking est lié à l'identité).
- **Ce qui manque / problème** : pas de **pseudonymisation** (le login est un identifiant
  direct), pas d'**opt-out analytics** distinct du consentement CGU, l'export RGPD
  (`/me/export`) inclut-il les `AnalyticsEvent` ? (à vérifier — cf. §9.1). Données de
  navigation = sensibles côté RGPD/CNIL (finalité « stats produit » à documenter).
- **Fichiers concernés** : `index.ts:6847-6866`, `/me/export` (`index.ts:1166`),
  `CONFORMITE_CGU_API_42.md`.
- **Piste d'implémentation** : documenter la finalité ; inclure les analytics dans
  l'export ; purger sur suppression de compte (cascade OK via FK) ; option opt-out.
- **Effort** S · **Priorité** 🟢

### 5.3 — `stats/overview` : requêtes lourdes non cachées, pas de fonnel ni rétention/cohorte

- **État actuel** : `index.ts:6872-6929` : à chaque ouverture de l'onglet STATS, on lance
  ~5 agrégats globaux **+ 5 disciplines × 3 requêtes** (`Promise.all` sur `ANALYTICS_GAMES`)
  → une dizaine de scans/groupBy, recalculés à chaque appel, sans cache.
- **Ce qui manque / problème** : coût qui croît avec la table (cf. §5.1) ; pas de cache
  court ; métriques limitées au **comptage** (pages vues, actifs, matchs) — pas de
  **rétention/cohortes**, pas de **funnel** (onboarding → 1er match), pas de **séries
  temporelles** (courbes jour/jour).
- **Fichiers concernés** : `index.ts:6869-6929`, `GODPage.tsx` (StatsTab ~3590+).
- **Piste d'implémentation** : cache mémoire court (60-300 s) sur l'overview ; pré-agréger
  en table de rollup journalier ; ajouter séries temporelles + rétention D1/D7.
- **Effort** M · **Priorité** 🟢

### 5.4 — `/analytics/track` silencieusement avalé (debug impossible)

- **État actuel** : `index.ts:6863-6865` : tout échec d'insert est **avalé** (`catch {}`),
  payload invalide → `204` sans signal. C'est volontaire (best-effort) mais aveugle.
- **Ce qui manque / problème** : si la table se remplit mal (FK, schéma), **personne ne
  le sait** ; aucune métrique de volume d'events ingérés/rejetés.
- **Fichiers concernés** : `index.ts:6847-6866`.
- **Piste d'implémentation** : compteur d'erreurs/volume (log throttlé ou métrique) ;
  garder le best-effort côté client mais observer côté serveur.
- **Effort** S · **Priorité** ⚪

---

## 6. Authentification, sessions & tokens

OAuth 42 + cookies signés + tokens HMAC + token de stream `sse` cloisonné : solide. Les
manques sont des reliquats connus de l'audit, non encore traités.

### 6.1 — Bearer web 30 j en localStorage, non révocable (reliquat audit #6)

- **État actuel** : token HMAC `TTL 30 j` stateless (`tokens.ts`), stocké dans
  `localStorage['league:token']`, envoyé en `Authorization`. L'audit a **atténué** via
  CSP Caddy (`connect-src 'self'`) mais le fond reste : **non révocable**, pas de
  `tokenVersion`/denylist, pas lié IP/UA. `SECURITY.md:670` + `pending.md` le listent
  comme durcissement restant.
- **Ce qui manque / problème** : pas de **révocation** (logout côté serveur ne peut pas
  invalider un Bearer déjà émis) ; un token volé reste valable 30 j ; pas de **rotation**.
- **Fichiers concernés** : `tokens.ts`, `auth.ts` (issue), `apps/web/src/lib/storage.ts`,
  `Caddyfile` (CSP).
- **Piste d'implémentation** : migrer la session web sur le **cookie HttpOnly** déjà
  implémenté (`auth.ts:262-268`) ; ou colonne `tokenVersion` sur `User` incrémentée au
  logout/ban (vérifiée dans `verifyToken`) + TTL court + refresh.
- **Effort** M · **Priorité** 🟠

### 6.2 — Logout non global : ban/anonymisation ne tuent pas les sessions actives

- **État actuel** : `POST /auth/logout` (`auth.ts:282-285`) supprime juste le **cookie**.
  Le Bearer reste valide. Un `BAN_USER` pose `bannedAt` mais le token HMAC du banni
  **reste cryptographiquement valide** jusqu'à expiration ; les routes vérifient
  `assertNotBanned` (bien), donc l'accès métier est bloqué — mais la **session SSE**
  ouverte et toute route oubliant `assertNotBanned` resteraient ouvertes.
- **Ce qui manque / problème** : pas d'invalidation immédiate des credentials lors d'un
  ban/anonymisation ; les flux SSE déjà ouverts d'un banni ne sont pas fermés activement.
- **Fichiers concernés** : `auth.ts:282-285`, `tokens.ts`, `index.ts` (ban),
  `sse.ts` (pas de `closeForLogin`).
- **Piste d'implémentation** : `tokenVersion`/denylist (cf. §6.1) ; helper
  `closeAllStreams(login)` appelé au ban pour fermer les SSE actifs.
- **Effort** M · **Priorité** 🟢

### 6.3 — OAuth callback : pas de timeout ni de retry sur les fetch vers l'intra 42

- **État actuel** : `auth.ts:203-234` : `fetch(FT_TOKEN_URL)` puis `fetch(FT_ME_URL)`
  **sans `AbortController`/timeout**. Si l'API 42 traîne, la requête de callback pend.
- **Ce qui manque / problème** : pas de **timeout** (un /v2/me lent bloque le handler) ;
  pas de **retry**/backoff sur 5xx transitoires de l'intra ; pas de circuit-breaker.
  Couplé au spoof XFF historique, le `/callback` est un point d'amplification (déjà
  noté audit #2, rate-limit corrigé mais le fetch sortant reste sans garde temporelle).
- **Fichiers concernés** : `auth.ts:203-234`, `ft-api.ts` (à vérifier si timeouts y sont).
- **Piste d'implémentation** : `AbortController` (timeout 5-10 s) sur tous les fetch
  sortants vers `api.intra.42.fr` ; retry léger sur 429/5xx ; mutualiser via `ft-api.ts`.
- **Effort** S · **Priorité** 🟢

### 6.4 — `x-dev-login` : backdoor neutralisée en prod mais toujours active dev/staging

- **État actuel** : garde dure `NODE_ENV !== 'production'` ajoutée (audit #13 corrigé).
  Mais en **staging** (`NODE_ENV` n'est pas forcément `production` ?) le header pourrait
  rester honoré par `getCurrentLogin` selon la valeur effective de `NODE_ENV` dans le
  conteneur staging (le staging-gate utilise `getSessionLogin` qui ne l'honore pas, OK).
- **Ce qui manque / problème** : dépendance à une variable d'env correctement positionnée
  en staging (`NODE_ENV=production` sur staging ? sinon `x-dev-login` actif derrière le
  basic-auth Caddy). À **vérifier/documenter** explicitement l'état de `ALLOW_DEV_LOGIN`
  et `NODE_ENV` sur chaque environnement.
- **Fichiers concernés** : `index.ts` (`getCurrentLogin`, `ALLOW_DEV_LOGIN`),
  composes (`NODE_ENV`).
- **Piste d'implémentation** : refus de boot si `ALLOW_DEV_LOGIN==='true'` hors dev ;
  documenter `NODE_ENV`/`APP_ENV` attendus par environnement.
- **Effort** S · **Priorité** 🟢

---

## 7. Secrets & rotation

### 7.1 — Rotation des secrets OAuth 42 EN ATTENTE (secret leaké)

- **État actuel** : `pending.md:44,47` (Sécurité) — `FT_OAUTH_UID`/`FT_OAUTH_SECRET`
  **« sont apparus dans une conversation Claude »** → action manuelle requise sur l'intra
  (regénérer le secret) puis maj `.env` local + prod. **Non fait à ce jour.**
- **Ce qui manque / problème** : un secret OAuth potentiellement exposé **toujours en
  service** → un tiers connaissant l'UID/secret pourrait usurper l'app OAuth.
- **Fichiers concernés** : `.env` prod/staging (hors repo), `pending.md:46-47`.
- **Piste d'implémentation** : regénérer sur `profile.intra.42.fr → OAuth applications`,
  déployer le nouveau secret (prod **et** staging ont des apps OAuth dédiées), invalider
  l'ancien. **Action manuelle, prioritaire.**
- **Effort** S · **Priorité** 🔴

### 7.2 — `SESSION_SECRET` & secrets sans rotation ni gestionnaire

- **État actuel** : secrets dans `/opt/.../.env` (non commités, bien — `architecture-ci-cd.md:184-187`).
  Pas de **rotation** documentée du `SESSION_SECRET` (le rotater **invalide d'un coup
  tous les Bearer 30 j et cookies** → déconnexion globale, donc jamais fait à la légère).
- **Ce qui manque / problème** : pas de **gestionnaire de secrets** (Vault/SOPS/age) ;
  rotation `SESSION_SECRET` = coupure brutale (pas de support de **2 secrets** en
  parallèle pour rotation douce) ; webhook `#security` **hardcodé** dans
  `security-alerts.yml` (`SECURITY.md:161-163`, non migré en Repo Secret).
- **Fichiers concernés** : `auth.ts`/`tokens.ts` (un seul `SESSION_SECRET`),
  `.github/workflows/security-alerts.yml`.
- **Piste d'implémentation** : supporter une liste de secrets (clé courante + clés de
  vérification legacy) pour rotation sans coupure ; migrer le webhook hardcodé en secret ;
  documenter la procédure de rotation `SESSION_SECRET`.
- **Effort** M · **Priorité** 🟠

### 7.3 — Mot de passe Postgres : défaut `league` encore possible

- **État actuel** : audit #10 « corrigé » via `${POSTGRES_PASSWORD:-league}` (compose).
  Le **fallback reste `league`** si la variable n'est pas posée.
- **Ce qui manque / problème** : si `.env` ne définit pas `POSTGRES_PASSWORD`, le mot de
  passe trivial `league` s'applique (Postgres non exposé hors réseau Docker → atténué,
  mais c'est un fallback faible). Pas de garantie qu'un secret fort est **réellement**
  posé en prod/staging.
- **Fichiers concernés** : `docker-compose*.yml`, `.env` serveurs.
- **Piste d'implémentation** : retirer le fallback (échec explicite si absent) ; vérifier
  qu'un secret fort est posé sur chaque environnement.
- **Effort** S · **Priorité** 🟢

---

## 8. Observabilité (logs, métriques, traces, alerting)

C'est le **gros trou** côté exploitation. L'app a une bonne sécu CI mais **quasi aucune
observabilité runtime**.

### 8.1 — Logs : `console.*` non structurés, pas de corrélation, pas d'agrégation

- **État actuel** : ~10 `console.log/error` dans `index.ts` (purges, boot, erreurs
  avalées), plus quelques-uns ailleurs. Format **texte libre**, pas de niveau, pas de
  `requestId`, pas de timestamp structuré.
- **Ce qui manque / problème** : aucun **logger structuré** (JSON) ; impossible de
  corréler les logs d'une requête (pas de trace-id) ; pas d'**agrégation centralisée**
  (les logs vivent dans `docker logs`, perdus à la rotation/redéploiement) ; beaucoup
  d'erreurs sont **avalées silencieusement** (`catch {}` analytics, audit, fetch OAuth).
- **Fichiers concernés** : tout `index.ts`, `audit.ts:64`, `auth.ts`, etc.
- **Piste d'implémentation** : `pino` (JSON, niveaux) + middleware Hono qui pose un
  `requestId` (header `x-request-id`) ; expédier vers un agrégateur (Loki/Grafana,
  ou simple `docker logs` → driver) ; ne plus avaler les erreurs sans au moins compter.
- **Effort** M · **Priorité** 🟠

### 8.2 — Aucune métrique applicative (Prometheus / RED) ni dashboard

- **État actuel** : aucune route `/metrics`, aucun compteur de latence/erreurs/req,
  aucune métrique business (matchs/jour, paris, coins émis). La seule « métrique » est
  l'onglet STATS (produit, pas infra).
- **Ce qui manque / problème** : impossible de savoir en temps réel la latence p95, le
  taux d'erreur 5xx, le nombre de connexions SSE ouvertes, l'usage mémoire/heap, le
  backlog de jobs. Diagnostic d'incident = lecture de `docker logs` à l'aveugle.
- **Fichiers concernés** : `index.ts` (pas de middleware métrique), infra.
- **Piste d'implémentation** : `prom-client` + `/metrics` (protégé) + middleware de
  comptage (durée, statut, route) + gauges (SSE ouverts via `sse.ts`, taille des stores
  rate-limit) ; Grafana/Prometheus ou un service hébergé.
- **Effort** M · **Priorité** 🟠

### 8.3 — Pas de tracing distribué ni de capture d'erreurs (Sentry-like)

- **État actuel** : aucun APM, aucun Sentry/error-tracking. Les exceptions non gérées
  remontent au handler `onError` Hono (à vérifier qu'il existe et logge proprement).
- **Ce qui manque / problème** : pas de **stack traces agrégées** des erreurs prod, pas
  d'alerte sur pic d'erreurs, pas de contexte (user, route, payload) capturé. Une
  régression qui jette 500 passe inaperçue tant qu'un user ne le signale pas.
- **Fichiers concernés** : handler `onError` global, `index.ts`.
- **Piste d'implémentation** : intégrer Sentry (ou GlitchTip self-host) côté backend
  **et** front ; alerte Discord sur nouvelle erreur/spike. Ne PAS envoyer de PII (RGPD).
- **Effort** M · **Priorité** 🟠

### 8.4 — Alerting Discord limité au scope sécu/CI, pas au runtime applicatif

- **État actuel** : alerting Discord existant = **CI sécu** (CodeQL/Trivy/npm audit,
  résumé quotidien, `security-alerts.yml`/`daily-security-audit.yml`) + audit admin
  (`#audit`). Les « sondes live » du `daily-security-audit` testent la santé déployée
  **1×/jour**.
- **Ce qui manque / problème** : **aucune alerte temps réel runtime** : backend down,
  DB injoignable, taux de 5xx anormal, OOM, disque plein, SSL bientôt expiré → personne
  n'est prévenu avant le rapport quotidien (latence jusqu'à 24h). Pas de **uptime
  monitor** externe (le check est interne au même serveur).
- **Fichiers concernés** : workflows GitHub, infra serveur.
- **Piste d'implémentation** : monitor externe (UptimeRobot/healthchecks.io) qui ping
  `/ready` (cf. §1.4) et alerte Discord en < 5 min ; alertes Prometheus (Alertmanager)
  si §8.2 ; surveillance disque/mémoire VPS.
- **Effort** M · **Priorité** 🟠

---

## 9. RGPD — export, suppression, anonymisation

Le socle RGPD est **bien plus avancé que la moyenne** : consentement explicite
(`termsAcceptedAt`/`termsVersion`), consent-gate, export Art. 20, suppression Art. 17
avec période de grâce + anonymisation, purge audit 24 mois. Manques sur la **complétude**
et la **vérifiabilité**.

### 9.1 — Export `/me/export` : périmètre à auditer (analytics, paris, items inclus ?)

- **État actuel** : `GET /me/export` (`index.ts:1166`, Art. 20). Construit un objet de
  données perso.
- **Ce qui manque / problème** : il faut **vérifier que l'export inclut TOUTES** les
  données nominatives : `AnalyticsEvent` (§5.2), paris (`bets`), transactions de coins,
  items boutique possédés, OPS, entrées d'audit **où l'utilisateur est `targetLogin`**,
  feature-requests/bugs soumis. Un export incomplet = non-conformité Art. 20.
- **Fichiers concernés** : `index.ts:1166-1208`, tous les modèles référençant `login`.
- **Piste d'implémentation** : recenser tous les modèles avec FK `login`/`*Login` et
  s'assurer qu'ils sont dans l'export ; test qui compare la liste des relations du modèle
  `User` à ce que renvoie l'export.
- **Effort** M · **Priorité** 🟠

### 9.2 — Anonymisation : exhaustivité des PII purgées non garantie

- **État actuel** : `anonymizeAccount()` (`index.ts:1221-1250`) purge les PII, met
  `anonymizedAt`, purge les tournois (`purgeUserFromTournaments`). Fallback
  d'anonymisation si une FK bloque la suppression sèche (`index.ts:1107-1116`).
- **Ce qui manque / problème** :
  - À vérifier que **tous** les champs PII sont effacés : `firstName`, `lastName`,
    `imageUrl`, `campus`, `ftId` (l'`ftId` est le pivot intra — doit-il être nullifié ?
    le garder ré-identifie). Les `AnalyticsEvent` (nominatifs via `login`) sont-ils
    supprimés à l'anonymisation, ou seulement à la suppression de compte (cascade) ?
    L'anonymisation **garde la ligne User** (login conservé pour l'intégrité historique)
    → les analytics liées restent nominatives.
  - Pas de **preuve/traçabilité** de l'anonymisation au-delà de `anonymizedAt`.
- **Fichiers concernés** : `index.ts:1221-1250`, `purgeUserFromTournaments` (291-309),
  `AnalyticsEvent`.
- **Piste d'implémentation** : checklist des champs PII + test ; décider du sort des
  analytics à l'anonymisation (purge ou pseudonymisation) ; nullifier/hasher `ftId`.
- **Effort** M · **Priorité** 🟠

### 9.3 — Anonymisation différée : dépend d'un job volatil (cf. §1)

- **État actuel** : `purgeScheduledDeletions()` (`index.ts:8251-8265`) anonymise après
  `ACCOUNT_GRACE_DAYS` (30 j) — exécuté **par le job quotidien volatil** (§1.1).
- **Ce qui manque / problème** : si le job ne tourne pas (déploiements en boucle, process
  jamais stable à 03h00, bug avalé `catch`), des comptes restent en
  `deletionScheduledAt` **au-delà** de la période de grâce → la suppression promise par
  la RGPD **dérape dans le temps** sans que personne ne le voie (erreur avalée
  `index.ts:8295-8297`).
- **Fichiers concernés** : `index.ts:8251-8265,8288-8311`.
- **Piste d'implémentation** : scheduler durable (§1.1) + **métrique/alerte** si des
  comptes dépassent la grâce sans anonymisation ; logguer le compte de comptes en
  attente à chaque run.
- **Effort** S (sur base §1.1) · **Priorité** 🟠

### 9.4 — Pas de registre des traitements ni de DPA documenté

- **État actuel** : `CONFORMITE_CGU_API_42.md` existe (conformité CGU API 42). Le
  consentement et les droits sont implémentés.
- **Ce qui manque / problème** : pas de **registre des activités de traitement** (Art. 30)
  formalisé (finalités, durées de conservation par donnée, base légale), pas de mention
  explicite de la **durée de conservation des analytics** (cf. §5.1, illimitée
  aujourd'hui). Durées de conservation hétérogènes et partiellement non documentées
  (audit 24 mois, pending 72h, grâce 30j, analytics ∞).
- **Fichiers concernés** : `DOC/CONFORMITE_CGU_API_42.md`, `DOC/SECURITY.md`.
- **Piste d'implémentation** : tableau « donnée → finalité → base légale → durée de
  conservation → purge » dans la doc ; aligner le code (jobs de purge) sur ces durées.
- **Effort** S · **Priorité** 🟢

---

## 10. Robustesse — transactions, idempotence, cohérence

Bon usage de `$transaction` (≈ 30 occurrences interactives dans `index.ts`). Manques sur
l'**idempotence**, les **opérations multi-étapes hors transaction** et la **cohérence
économie/SSE**.

### 10.1 — Pas d'idempotence sur les mutations (double-submit, retries)

- **État actuel** : les mutations (`POST /matches`, `/challenges`, paris, achats
  boutique) n'ont **pas de clé d'idempotence**. Le front peut double-cliquer ; un retry
  réseau peut rejouer un POST.
- **Ce qui manque / problème** : un double `POST /matches` crée 2 PendingMatch ; un
  retry d'achat boutique pourrait re-débiter (atténué si la transaction revalide le
  solde, mais pas de garantie d'unicité de l'opération). Pas d'`Idempotency-Key`.
- **Fichiers concernés** : toutes les routes mutantes de `index.ts`.
- **Piste d'implémentation** : header `Idempotency-Key` + table `IdempotencyKey`
  (clé → résultat) pour les opérations sensibles (achats, paris) ; contraintes d'unicité
  DB là où c'est naturel (1 pari par user/tournoi déjà via `betsLockedAt` ?).
- **Effort** M · **Priorité** 🟢

### 10.2 — Effets de bord SSE/Discord hors transaction (incohérence possible)

- **État actuel** : pattern récurrent — `$transaction(...)` puis `emit(...)`/`logAdminAction`
  **après** le commit (ex. `index.ts:8203-8206`). Parfois un 409 est levé **après** commit
  volontairement (`index.ts:2625-2659`, commentaire explicite).
- **Ce qui manque / problème** : si le process meurt **entre** le commit DB et l'`emit`,
  l'event temps réel est perdu (état DB correct mais UI non notifiée jusqu'au prochain
  fetch — dégradation gracieuse, pas de corruption). L'inverse (emit avant commit qui
  rollback) serait pire mais ne semble pas le pattern. À auditer au cas par cas.
- **Fichiers concernés** : nombreuses routes `index.ts`.
- **Piste d'implémentation** : pattern outbox (events persistés dans la transaction, relayés
  par un worker) si on veut une garantie at-least-once ; sinon accepter la dégradation
  (refetch couvre). Documenter le choix.
- **Effort** L (outbox) · **Priorité** ⚪

### 10.3 — Économie virtuelle : cohérence des soldes de coins non transactionnellement totale

- **État actuel** : `awardMatchEconomyTx`/`grantItemTx` opèrent dans des transactions ;
  anti-farming dégressif appliqué (audit #5). Les paris OPS sont soldés par
  `sweepExpiredOpsBets()` (job).
- **Ce qui manque / problème** : pas de **ledger** (journal immuable des mouvements de
  coins) — le solde est un champ mutable sur `User`, donc impossible d'auditer
  rétroactivement « pourquoi ce solde ? » ou de détecter une incohérence (somme des
  gains ≠ solde). `sweepExpiredOpsBets` dépend d'un job volatil (§1) → un pari pourrait
  rester non soldé si le boot ne le rejoue pas.
- **Fichiers concernés** : `index.ts` (`awardMatchEconomyTx`, `grantItemTx`,
  `sweepExpiredOpsBets:7823`), schema `User.leagueCoins`.
- **Piste d'implémentation** : table `CoinTransaction` (delta, raison, ref, before/after)
  écrite dans chaque transaction d'économie → audit + réconciliation ; vérification
  périodique « somme du ledger == solde ».
- **Effort** M · **Priorité** 🟢

### 10.4 — Erreurs avalées masquant des incohérences

- **État actuel** : nombreux `catch {}` / `.catch(() => {})` silencieux (analytics
  `index.ts:6863`, audit `audit.ts:64`, SSE `sse.ts:54-59`, jobs `index.ts:8281-8297`,
  team photo cache).
- **Ce qui manque / problème** : une DB intermittente, une FK cassée, un job en échec
  **répété** ne laissent **aucune trace exploitable** (au mieux un `console.error` perdu).
  Couplé à l'absence de métriques (§8.2), un dysfonctionnement chronique peut durer.
- **Fichiers concernés** : `index.ts`, `audit.ts`, `sse.ts`.
- **Piste d'implémentation** : remplacer les `catch {}` muets par un log structuré +
  compteur (§8.1/8.2) ; garder le best-effort fonctionnel mais **observable**.
- **Effort** S · **Priorité** 🟠

---

## 11. Déploiement, Docker & CI/CD

CI/CD mûre (staging/prod, GHCR, Caddy edge, Trivy/CodeQL). Manques sur le **durcissement
conteneurs résiduel**, la **gestion des migrations** et la **protection de branche**.

### 11.1 — Migrations Prisma jouées au boot, sans garde anti-régression

- **État actuel** : `prisma migrate deploy` au démarrage du conteneur backend
  (cf. `AUDIT_CYBER:351-354`). Les itests utilisent `prisma db push` car une **migration
  fléchettes mal ordonnée casse `migrate deploy` from scratch** (note MEMORY
  `integration-tests-db-push`).
- **Ce qui manque / problème** :
  - Une migration **non rétro-compatible** déployée se joue **avant** que le nouveau code
    ne soit prêt (pas de stratégie expand/contract documentée) → fenêtre d'incohérence.
  - Le fait que `migrate deploy` **from scratch est cassé** (migration fléchettes
    mal ordonnée) est une **dette réelle** : une reconstruction propre de la DB (DR,
    nouvel environnement) échouerait. Les itests le contournent avec `db push`, ce qui
    **masque** le problème.
  - Aucun **rollback** de migration ; pas de dry-run en CI sur une copie.
- **Fichiers concernés** : `apps/backend/prisma/migrations/*` (migration fléchettes),
  Dockerfile/entrypoint backend, `test/global-setup.ts`.
- **Piste d'implémentation** : **réparer l'ordre des migrations** pour que
  `migrate deploy` from scratch passe (sinon DR impossible) ; jouer `migrate deploy` en
  CI sur une DB vierge comme garde-fou ; adopter expand/contract pour les changements de
  schéma destructifs.
- **Effort** M · **Priorité** 🟠

### 11.2 — Conteneur frontend (nginx) toujours en root

- **État actuel** : audit #12 « corrigé » pour le **backend** (`USER node`, Dockerfile
  ligne 43). Le **frontend nginx n'a PAS de `USER`** (`apps/web/Dockerfile` : `FROM
  nginx:alpine` → `CMD ["nginx"...]` en root). `SECURITY.md:672` le note comme restant.
- **Ce qui manque / problème** : le conteneur nginx tourne **en root** ; pas de
  `cap_drop`/`no-new-privileges`/`read_only` sur les services compose. Défense en
  profondeur incomplète.
- **Fichiers concernés** : `apps/web/Dockerfile:27-45`, `docker-compose*.yml`.
- **Piste d'implémentation** : image nginx non-root (`nginxinc/nginx-unprivileged`) ou
  ajout d'un user dédié + ports >1024 ; durcir les services compose (`cap_drop: [ALL]`,
  `security_opt: [no-new-privileges:true]`, `read_only` + tmpfs).
- **Effort** S · **Priorité** 🟢

### 11.3 — Pas de protection de branche `main` ni de gate de déploiement humain

- **État actuel** : `SECURITY.md:719` — « Branch protection : push direct sur `main`
  toujours autorisé ». Le workflow de la MEMORY pousse **direct sur `develop`** (pas de
  PR). `deploy-prod.yml` se déclenche sur push `main`.
- **Ce qui manque / problème** : rien n'empêche un push direct/forcé sur `main` →
  déploiement prod immédiat sans review ni gate. Pas d'**environnement protégé** GitHub
  (approbation manuelle) sur le déploiement prod, pas de **smoke test post-deploy**
  bloquant.
- **Fichiers concernés** : règles GitHub du repo, `.github/workflows/deploy-prod.yml`.
- **Piste d'implémentation** : branch protection sur `main` (PR + CI verte requises,
  pas de force-push) ; GitHub Environment `production` avec required reviewer ;
  smoke test post-deploy qui rollback si `/ready` échoue.
- **Effort** S · **Priorité** 🟠

### 11.4 — Pas de stratégie de déploiement zéro-downtime applicative (rolling/blue-green)

- **État actuel** : `architecture-ci-cd.md:154-176` — garde-fou « zéro downtime » côté
  **Caddyfile** (validation avant reload), mais le backend est **un seul conteneur**
  `--force-recreate`/`up -d` → brève coupure pendant le redémarrage + rejeu des
  migrations + reschedule des timers.
- **Ce qui manque / problème** : pendant le redéploiement backend, **les SSE tombent**,
  les timers volatils se réinitialisent, une migration longue bloque le boot. Pas de
  rolling update (impossible à 1 réplique, cf. §2).
- **Fichiers concernés** : composes, pipeline deploy.
- **Piste d'implémentation** : healthcheck `/ready` + dépendance compose
  (`depends_on: condition: service_healthy`) ; à terme 2 répliques + LB pour rolling
  (nécessite §2.1 SSE partagé). Au minimum, réduire le temps de boot (migrations rapides).
- **Effort** M · **Priorité** 🟢

### 11.5 — Pas de DAST ni de scan de config IaC

- **État actuel** : `SECURITY.md:721` — DAST non en place. CI couvre SAST (CodeQL), SCA
  (npm audit/Trivy/Dependabot).
- **Ce qui manque / problème** : aucun scan **dynamique** de l'app déployée (OWASP ZAP),
  aucun scan de la **config Docker/compose/Caddy** (hadolint, trivy config), pas de scan
  de **secrets** dans l'historique git (gitleaks) — pertinent vu le leak OAuth (§7.1).
- **Fichiers concernés** : `.github/workflows/*`.
- **Piste d'implémentation** : job `gitleaks` (historique + PR), `trivy config` sur
  composes/Dockerfiles, `hadolint` sur les Dockerfiles, ZAP baseline contre staging.
- **Effort** M · **Priorité** 🟢

---

## 12. Sauvegardes & reprise après sinistre (DR)

### 12.1 — Aucune sauvegarde DB automatisée/offsite documentée

- **État actuel** : `SECURITY.md:720` — « Backups DB chiffrés offsite : non automatisé ».
  Les seuls « backups » trouvés sont des **branches git** `backup-*` (refs locales), sans
  rapport avec la donnée Postgres.
- **Ce qui manque / problème** : **aucun dump Postgres planifié**, aucune copie offsite,
  aucun chiffrement de backup, aucun test de restauration. Une corruption de volume / un
  `RESET_DATABASE` accidentel / une panne disque VPS = **perte de données irréversible**.
- **Fichiers concernés** : infra serveur, composes (volumes `league_pgdata` /
  `league_stg_pgdata`).
- **Piste d'implémentation** : cron `pg_dump` chiffré (age/gpg) poussé offsite (S3/B2)
  avec rétention ; **test de restauration** périodique ; documenter le RPO/RTO visé.
  Couplé à §11.1, garantir qu'une restauration **+ migrate deploy from scratch** marche.
- **Effort** M · **Priorité** 🔴

### 12.2 — Pas de runbook d'incident / DR documenté

- **État actuel** : `POST_MORTEM_404_BUG.md` existe (post-mortem ponctuel). Pas de
  runbook DR générique.
- **Ce qui manque / problème** : aucune procédure écrite « la prod est down → quoi
  faire », « la DB est corrompue → restaurer depuis X », « secret compromis → rotation »,
  contacts, ordre de redémarrage des stacks.
- **Fichiers concernés** : `DOC/`.
- **Piste d'implémentation** : runbook `DOC/RUNBOOK.md` (incidents fréquents, restauration
  backup, rotation secrets, rollback déploiement).
- **Effort** S · **Priorité** 🟠

---

## 13. Tests backend

Bonne base : ~180 tests, unitaires (`*.test.ts`) + intégration HTTP (`test/*.itest.ts`)
sur DB réelle. Manques sur la **couverture des routes admin/analytics** et le **chemin
de migration**.

### 13.1 — Routes admin/GOD très peu couvertes en intégration

- **État actuel** : itests = `matches`, `challenges`, `consent`, `auth-coverage`, `smoke`
  (`apps/backend/test/`). Seul `audit.test.ts` (unitaire) et `auth-coverage.itest.ts` /
  `matches.itest.ts` touchent un peu l'admin. **46 routes `/admin/*`** dans `index.ts`.
- **Ce qui manque / problème** : la majorité des routes admin (ban/unban, set-role,
  moderator-permissions, edit-stats, delete-*, seasons, shop, force-result, impersonate,
  sync-elo-from-prod) **n'ont pas de test d'intégration** vérifiant la **garde**
  (`requirePerm`/`requireSuperAdmin`), l'**audit**, et le comportement. Un refactor des
  gardes pourrait ouvrir un trou sans qu'aucun test ne casse.
- **Fichiers concernés** : `apps/backend/test/`, routes `/admin/*` de `index.ts`.
- **Piste d'implémentation** : itest `admin.itest.ts` qui, par route mutante : (a) refuse
  un USER, (b) refuse un MODERATOR sans la perm, (c) autorise avec la perm/ADMIN, (d)
  asserte qu'une ligne d'audit est créée.
- **Effort** M · **Priorité** 🟠

### 13.2 — Analytics & STATS : zéro test

- **État actuel** : `grep analytics` sur les tests → **aucun**.
- **Ce qui manque / problème** : `/analytics/track` (validation Zod, best-effort, FK) et
  `/admin/stats/overview` (agrégats, fenêtre `days`, scoping `game`, garde
  `requireAdminOrModerator`) ne sont **pas testés**.
- **Fichiers concernés** : `index.ts:6847-6929`, `apps/backend/test/`.
- **Piste d'implémentation** : itest d'ingestion + lecture d'overview (compte actifs,
  per-game, garde de rôle).
- **Effort** S · **Priorité** 🟢

### 13.3 — Pas de test du chemin de migration `migrate deploy` from scratch

- **État actuel** : itests sur `db push` (contourne la migration cassée, §11.1).
- **Ce qui manque / problème** : **rien ne teste** que `prisma migrate deploy` reconstruit
  la DB à zéro — or c'est précisément ce qui est **cassé** (migration fléchettes) et ce
  dont dépend toute restauration/DR.
- **Fichiers concernés** : `apps/backend/prisma/migrations/*`, CI.
- **Piste d'implémentation** : job CI dédié qui crée une DB vierge et joue
  `migrate deploy` (doit passer) ; corriger la migration en amont (§11.1).
- **Effort** S (le test) / M (le fix migration) · **Priorité** 🟠

### 13.4 — Pas de tests de charge / SSE / rate-limit sous concurrence

- **État actuel** : `sse.test.ts` et `rate-limit.test.ts` existent (unitaires). Pas de
  test de **charge** (N connexions SSE, flood rate-limit, body-limit).
- **Ce qui manque / problème** : les plafonds (5 SSE/login, 1 Mo body, pénalités
  progressives) ne sont pas validés sous **concurrence réelle** ; pas de régression-guard
  perf.
- **Fichiers concernés** : `sse.test.ts`, `rate-limit.test.ts`.
- **Piste d'implémentation** : test de charge léger (k6/autocannon) en CI nightly contre
  staging ; assert sur 413/429/éviction SSE.
- **Effort** M · **Priorité** ⚪

---

## 14. Extension navigateur

Extension MV3 (Chrome + Firefox) fonctionnelle (`apps/extension`, ~3000 lignes TS).
**Aucun `TODO`/`FIXME` dans le code**, mais `pending.md:22-34` liste des restes, et la
robustesse mérite attention. **`intra.ts` fait 1395 lignes** (content-script monolithe).

### 14.1 — Fonctionnalités restantes (pending.md)

- **État actuel** : `pending.md:33-34` — `[ ]` Auto-complétion login adversaire (lister
  users / piocher dans le DOM intra) ; `[ ]` Optimiser `42_league.png` (1254×1254 → 2,4 MB,
  générer 16/32/48/128).
- **Ce qui manque / problème** : saisie manuelle du login adversaire = friction + risque
  de typo ; icône lourde (2,4 Mo) gonfle le paquet et ralentit le store.
- **Fichiers concernés** : `apps/extension/src/content/intra.ts`,
  `apps/extension/public/icons/42_league.png`.
- **Piste d'implémentation** : autocomplete via `GET /users` (allow-list publique) +
  scrape DOM intra ; régénérer les icônes aux 4 tailles + compresser.
- **Effort** S/M · **Priorité** 🟢

### 14.2 — Content-script monolithe & couplage au DOM de l'intra (fragile)

- **État actuel** : `intra.ts` (1395 l) injecte un widget Shadow DOM **ancré après la
  section “évaluations à venir”** (fallback bottom-right) — couplage fort au markup
  intra, qui peut changer sans préavis.
- **Ce qui manque / problème** : un changement de l'UI intra **casse silencieusement**
  l'ancrage (pas de monitoring côté extension, pas de remontée d'erreur). Pas de tests.
  Module géant difficile à maintenir.
- **Fichiers concernés** : `apps/extension/src/content/intra.ts` (+ `intra-profile.ts`,
  `styles.ts`).
- **Piste d'implémentation** : sélecteurs robustes + fallback explicite + télémétrie
  d'échec d'ancrage (best-effort vers `/analytics/track`) ; découper `intra.ts` en
  modules ; quelques tests DOM (jsdom).
- **Effort** M · **Priorité** 🟢

### 14.3 — Token extension en `chrome.storage.local`, non révocable, sans refresh

- **État actuel** : OAuth via `launchWebAuthFlow` → Bearer HMAC dans
  `chrome.storage.local` (`pending.md:25`). Token lu dans le fragment (audit #15 corrigé).
- **Ce qui manque / problème** : même nature que le Bearer web (§6.1) — **30 j, non
  révocable, pas de refresh**. Stocké en `storage.local` (lisible par l'extension, OK,
  mais persistant). Pas de gestion d'expiration côté extension (que se passe-t-il à
  J+30 ? re-login manuel ?).
- **Fichiers concernés** : `apps/extension/src/lib/storage.ts`,
  `apps/extension/src/background/index.ts`, `apps/extension/src/lib/api.ts`.
- **Piste d'implémentation** : gérer le 401 → relancer le flow OAuth automatiquement ;
  s'aligner sur la stratégie de révocation/refresh du backend (§6.1/6.2).
- **Effort** S · **Priorité** 🟢

### 14.4 — Pas de CI/build/test ni de publication automatisée de l'extension

- **État actuel** : builds Chrome/Firefox séparés (`pending.md:31`), zips committés
  (`42-league.zip`, `42-league-source.zip` dans `apps/extension/`). Aucun workflow
  extension repéré.
- **Ce qui manque / problème** : pas de **CI** qui build/lint/teste l'extension à chaque
  PR (le `ci.yml` cible apps/web/backend) ; zips **committés** (artefacts binaires dans
  le repo) ; pas de pipeline de publication Web Store / AMO.
- **Fichiers concernés** : `apps/extension/*.zip`, `.github/workflows/`.
- **Piste d'implémentation** : job CI build extension (Chrome+Firefox) + typecheck ;
  sortir les zips du repo (artefacts CI) ; publication semi-auto signée.
- **Effort** M · **Priorité** 🟢

### 14.5 — Robustesse réseau de l'extension (backend down, CORS, retries)

- **État actuel** : `apps/extension/src/lib/api.ts` (340 l) appelle le backend (CORS via
  `isTrusted42Origin`). URL backend configurable (Options).
- **Ce qui manque / problème** : comportement non spécifié si le backend est down /
  l'origine non autorisée / le token expiré — à vérifier (spinner infini ? message
  clair ?). Pas de retry/backoff. Pas de gestion centralisée des erreurs API.
- **Fichiers concernés** : `apps/extension/src/lib/api.ts`,
  `apps/extension/src/lib/config.ts`.
- **Piste d'implémentation** : wrapper fetch avec timeout + messages d'erreur UX + 401 →
  re-auth ; tester les cas dégradés.
- **Effort** S · **Priorité** ⚪

---

## 15. Reliquats de durcissement sécurité (post-audit)

Explicitement listés non-faits dans `SECURITY.md:711-724` (« Ce qui n'est PAS encore en
place »), au-delà de ce qui précède :

- **CSP `script-src 'unsafe-inline'`** encore présent (à remplacer par des nonces) ;
  `img-src` à resserrer (`SECURITY.md:670-672`). **Effort** M · **Priorité** 🟢
- **Cloudflare/WAF en amont** : aucun proxy WAF devant Caddy (`SECURITY.md:718`).
  **Effort** M · **Priorité** 🟢
- **Honey-tokens** : aucun (`SECURITY.md:723`). **Effort** S · **Priorité** ⚪
- **HSTS preload / en-têtes** : présents côté Caddy, mais pas de revue périodique
  documentée. **Effort** S · **Priorité** ⚪
- **2FA SUPERADMIN** & **sudo mode** : cf. §3.1. **Effort** L/M · **Priorité** 🟠

---

## 16. Récapitulatif priorisé

### 🔴 Haute priorité (à traiter en premier)

| # | Manque | Effort |
|---|--------|--------|
| 7.1 | **Rotation des secrets OAuth 42** (secret leaké, toujours en service) | S |
| 12.1 | **Aucune sauvegarde DB automatisée/offsite** (perte de données possible) | M |

### 🟠 Moyenne priorité

| # | Manque | Effort |
|---|--------|--------|
| 1.1 | Scheduler durable + leader-election (jobs volatils, double-exécution multi-instance) | M |
| 1.4 | Healthcheck profond `/ready` (DB + jobs) vs `/health` | S |
| 3.1 | 2FA / sudo mode SUPERADMIN + unifier les 2 listes admin | M/L |
| 4.2 | Audit log immuable (chaînage hash, append-only) | M |
| 4.3 | Couverture d'audit complète (grant/saison/force/shop) | M |
| 5.1 | Rétention/purge des `AnalyticsEvent` (croissance illimitée) | S |
| 6.1 | Bearer web révocable / cookie HttpOnly (reliquat audit #6) | M |
| 7.2 | Rotation `SESSION_SECRET` douce + gestionnaire de secrets + webhook hardcodé | M |
| 8.1–8.4 | Observabilité : logs structurés, métriques, error-tracking, alerting runtime | M×4 |
| 9.1–9.3 | RGPD : export complet, anonymisation exhaustive, anonymisation différée fiabilisée | M |
| 10.4 | Erreurs avalées → observables | S |
| 11.1 | Réparer `migrate deploy` from scratch (DR cassée) + garde CI | M |
| 11.3 | Protection de branche `main` + gate déploiement prod | S |
| 12.2 | Runbook d'incident/DR | S |
| 13.1 | Tests d'intégration des 46 routes admin (gardes + audit) | M |
| 13.3 | Test du chemin de migration from scratch | S |

### 🟢 Basse priorité / ⚪ dette lointaine

Scalabilité mono-process (§2.1/2.2), timers OPS déterministes (§1.2), expiration pending
plus fine (§1.3), permissions modérateur fines/temporelles (§3.2), garde-fous 4-yeux
(§3.3), export GOD (§3.4), notif Discord enrichie (§4.1), analytics avancées
funnel/cohortes (§5.3), logout global/fermeture SSE au ban (§6.2), timeout fetch OAuth
(§6.3), idempotence (§10.1), ledger de coins (§10.3), nginx non-root + durcissement
compose (§11.2), zéro-downtime applicatif (§11.4), DAST/gitleaks/hadolint (§11.5),
tests analytics & charge (§13.2/13.4), extension (autocomplete, refactor `intra.ts`,
CI/publication, robustesse réseau — §14), CSP nonces / WAF / honey-tokens (§15).

---

> **Note de cohérence doc** : `DOC/pending.md:17` marque l'expiration des matchs pending
> comme non faite alors que `purgeStalePendingMatches()` existe (`index.ts:8217`) ;
> `pending.md:20` signale aussi la **plomberie contributor-stats** incomplète (script +
> Dockerfile + workflows + page About « restent à livrer »). À resynchroniser.
