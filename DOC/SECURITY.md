# Sécurité — 42 League

Documentation du dispositif de sécurité applicative et CI/CD ajouté au projet.
Cible : un dev qui reprend le repo dans 6 mois et veut comprendre comment ça marche.

---

## Vue d'ensemble

On applique le principe de **défense en profondeur** : plusieurs couches indépendantes
qui se complètent. Si une couche cède, les autres protègent encore.

```
┌─────────────────────────────────────────────────────────────────┐
│  Couches de défense                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Validation des inputs        → Zod sur chaque endpoint       │
│  2. Authentification             → 42 OAuth + sessions           │
│  3. Autorisation                 → requireAdmin / requireSuper   │
│  4. Audit log (qui fait quoi)    → admin_audit_log + Discord     │
│  5. Visibilité UI conditionnelle → bouton GOD masqué aux non-adm │
│  6. Scan code source             → CodeQL (SAST)                 │
│  7. Scan dépendances             → npm audit + Dependabot        │
│  8. Scan images Docker           → Trivy                         │
│  9. Notifications temps réel     → 2 webhooks Discord            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Audit log des actions admin

### Le problème

Avant : un admin pouvait bannir, débannir, promote/demote, modifier les ELO sans
laisser aucune trace. Si un compte admin était compromis ou si un admin abusait,
on n'avait aucun moyen de savoir qui avait fait quoi.

### La solution

Chaque action sensible est **persistée en DB** + **notifiée Discord en temps réel**.

### Modèle de données

Fichier : `apps/backend/prisma/schema.prisma`

```prisma
enum AdminAction {
  SET_ROLE         // promotion/demotion USER ↔ ADMIN
  BAN_USER         // ban d'un user
  UNBAN_USER       // unban d'un user
  EDIT_STATS       // modif ELO / matchs / dodge / tournaments_won
  EDIT_TITLE       // modif du titre cosmétique
  DELETE_MATCH     // suppression d'un match joué
  EDIT_MATCH       // modif du score d'un match
  REFRESH_IMAGES   // backfill des avatars (réservé pour usage futur)
}

model AdminAuditLog {
  id          String      @id @default(uuid())
  actorLogin  String      // qui a fait l'action
  actorRole   Role        // son rôle au moment de l'action
  action      AdminAction
  targetLogin String?     // sur qui (null si action globale)
  payload     Json?       // détails ({"from": "USER", "to": "ADMIN"} etc.)
  ipAddress   String?     // IP source de la requête
  userAgent   String?     // navigateur / client
  createdAt   DateTime    @default(now())

  @@index([createdAt(sort: Desc)])
  @@index([actorLogin])
  @@index([targetLogin])
}
```

Migration appliquée : `apps/backend/prisma/migrations/20260529030000_add_admin_audit_log/`

### Le helper

Fichier : `apps/backend/src/audit.ts`

```ts
await logAdminAction(c, {
  actor: me,
  actorRole: await getUserRole(me),
  action: 'BAN_USER',
  target: 'alice42',
  payload: { reason: 'cheating' },
});
```

Le helper fait **deux choses** :
1. Insère une ligne dans `admin_audit_log`
2. Poste un message Discord dans `#audit` (fire-and-forget — si Discord pète, l'audit DB passe quand même)

Les deux opérations sont **non-bloquantes** : si elles échouent (DB down, webhook révoqué), l'action métier (ban, role change…) se termine quand même. On log l'erreur dans la console, sans casser l'UX.

### Les endpoints wrappés

Fichier : `apps/backend/src/index.ts`

| Endpoint | Action loggée |
|---|---|
| `POST /admin/users/:login/role` | `SET_ROLE` |
| `POST /admin/users/:login/ban` | `BAN_USER` |
| `POST /admin/users/:login/unban` | `UNBAN_USER` |
| `PATCH /admin/users/:login/stats` | `EDIT_STATS` |
| `POST /admin/users/:login/title` | `EDIT_TITLE` |
| `DELETE /admin/matches/:id` | `DELETE_MATCH` |
| `PATCH /admin/matches/:id` | `EDIT_MATCH` |

### Consultation

- **API** : `GET /admin/audit-log?actor=X&target=Y&action=BAN_USER&limit=200`
  Filtres validés par Zod, max 500 entrées par appel.
- **UI** : nouvel onglet **AUDIT** dans le GOD panel (`/GOD` → onglet AUDIT)
  Affiche date, acteur, rôle, action, cible, payload, IP. Filtrable.

---

## 2. Webhooks Discord

### Deux canaux distincts

| Canal | Webhook | Sert à |
|---|---|---|
| **#audit** | `DISCORD_AUDIT_WEBHOOK_URL` (env serveur) | Actions admin temps réel |
| **#security** | hardcodé dans `security-alerts.yml` | Alertes CodeQL / Trivy + résumé quotidien |

### Webhook #audit (côté backend)

- Variable : `DISCORD_AUDIT_WEBHOOK_URL` dans `/opt/42_league/.env` du serveur prod
- Lu par : `apps/backend/src/audit.ts` → fonction `notifyDiscord()`
- Si la variable est absente → l'audit fonctionne quand même (DB), juste pas de ping Discord
- Format des messages : `<emoji> **<ACTION>** by \`<actor>\` (<role>) → \`<target>\` + payload en JSON`

### Webhook #security (côté CI)

- Référencé directement dans `.github/workflows/security-alerts.yml`
- Posté par le workflow GitHub Actions quand une alerte est créée
- ⚠️ Actuellement **hardcodé dans le fichier** — pour le rotater proprement, déplace-le en
  Repo Secret GitHub (`Settings → Secrets → Actions → New repository secret`) et remplace
  l'URL par `${{ secrets.DISCORD_SECURITY_WEBHOOK_URL }}` dans le workflow.

### Rotation d'un webhook

Si un webhook est compromis (collé dans un chat, dans un screen, leak quelconque) :
1. Discord → Server Settings → Intégrations → Webhooks → **Delete Webhook**
2. **Create New Webhook** → copy URL
3. Pour `#audit` : `ssh root@<server> 'sed -i "s|DISCORD_AUDIT_WEBHOOK_URL=.*|DISCORD_AUDIT_WEBHOOK_URL=<new>|" /opt/42_league/.env'` puis redémarrer le backend
4. Pour `#security` : modifier `security-alerts.yml` (ou idéalement migrer vers un secret) et push

---

## 3. Gating de l'UI

### Le problème

L'URL `/GOD` était accessible à n'importe qui (le backend rejetait l'accès, OK,
mais l'URL était devinable et apparaissait dans le bundle). Aucun moyen pour un
admin de l'atteindre depuis l'interface — il fallait taper l'URL.

### La solution

Un bouton conditionnel apparaît dans la nav **uniquement si** `me.role === 'ADMIN' || 'SUPERADMIN'`.

| Plateforme | Fichier | Endroit |
|---|---|---|
| Desktop | `apps/web/src/shell/DesktopShell.tsx` | Sidebar, sous "Réglages", séparateur rouge |
| Mobile | `apps/web/src/mobile/primitives/MobileHeader.tsx` | Bouton rond rouge à côté de l'avatar |

Icône : `Shield` (lucide-react), couleur rouge pour signaler la zone d'action sensible.

### Sécurité

⚠️ **Ce n'est qu'une couche d'UX**, pas une couche de sécurité.
Le vrai contrôle d'accès reste côté backend (`requireAdmin` / `requireSuperAdmin`).
Cacher le bouton ne fait que rendre la fonctionnalité moins découvrable.

---

## 4. Scanners CI

Trois scanners tournent en automatique sans intervention humaine.

### CodeQL (SAST — analyse statique)

Fichier : `.github/workflows/codeql.yml`

- **Quand** :
  - Cron tous les jours à **3h UTC** (5h Paris en hiver)
  - À chaque PR vers `main` qui touche `apps/**` ou `packages/**`
  - Manuel via "Run workflow"
- **Quoi** : analyse le code TypeScript/JavaScript pour détecter :
  - Injections (SQL, command, path traversal)
  - XSS
  - Désérialisation non sûre
  - Secrets hardcodés
  - Utilisation d'APIs dangereuses
- **Output** : alertes dans l'onglet **Security → Code scanning** du repo
- **Suite security-extended** activée — couvre plus de patterns que la suite par défaut

### Trivy (scan d'images Docker)

Steps dans : `.github/workflows/deploy.yml`

- **Quand** : après chaque build d'image (backend ou frontend)
- **Quoi** : scanne l'image Docker juste pushée sur ghcr.io
  - CVE dans l'image de base (`node:20-alpine`)
  - CVE dans les paquets système installés (apk add ...)
  - CVE dans les dépendances npm copiées dans l'image
- **Sévérités scannées** : CRITICAL + HIGH uniquement (skip LOW/MEDIUM pour réduire le bruit)
- **Mode** : `ignore-unfixed: true` — on ne reporte que les CVE qui ont un fix dispo
- **Mode** : `exit-code: 0` + `continue-on-error: true` — Trivy ne **bloque pas** le déploiement,
  il remonte juste les findings dans l'onglet Security
- **Output** : SARIF uploadé dans l'onglet **Security → Code scanning** (catégories `trivy-backend` / `trivy-frontend`)

### npm audit (scan des dépendances)

Fichier : `.github/workflows/dependency-audit.yml`

- **Quand** :
  - Cron tous les jours à **4h UTC** (6h Paris)
  - À chaque PR qui touche `**/package.json` ou `**/package-lock.json`
  - Manuel
- **Quoi** : `npm audit --audit-level=high --omit=dev` — CVE connues dans les dépendances de prod
- **Mode** : `continue-on-error: true` — non bloquant
- **Output** : sortie dans le **Summary** du workflow run (visible dans l'onglet Actions)

---

## 5. Notifications Discord temps réel pour la sécu

Fichier : `.github/workflows/security-alerts.yml`

Workflow déclenché par **3 événements** :

### Event 1 — Nouvelle alerte de scan code

```yaml
on:
  code_scanning_alert:
    types: [created, reopened]
```

Quand CodeQL ou Trivy crée une nouvelle alerte dans l'onglet Security, GitHub
déclenche l'event `code_scanning_alert`. Le workflow lit les détails de l'alerte
et poste un message Discord avec :
- Emoji selon sévérité (💥 critical / 🚨 high / ⚠️ medium / 🔎 low)
- Règle déclenchée (ex: `js/sql-injection`)
- Description
- Lien direct vers l'alerte sur GitHub

### Event 2 — Résumé quotidien

```yaml
schedule:
  - cron: '0 6 * * *'  # 6h UTC = 8h Paris en été
```

Tous les matins, le workflow appelle l'API GitHub pour compter les alertes ouvertes.
- **Si 0 alerte** → ping heartbeat : `✅ Tout va bien aujourd'hui — aucune faille de sécu détectée !`
- **Si N > 0** → poste un récap groupé par sévérité

Le heartbeat est important : si Discord se tait pendant 2+ jours, tu sais qu'un truc
est cassé (webhook révoqué, Actions désactivé, repo non accessible…).

Exemple de message :
```
🛡️ Daily security summary — 3 open alert(s)
high: 1 · medium: 2
https://github.com/42-League-corp/42_League/security/code-scanning
```

### Event 3 — Manuel

Bouton "Run workflow" dans l'onglet Actions, pour tester ou forcer un résumé.

---

## 6. Validation des inputs (Zod)

Côté backend, **toutes les mutations** valident leur payload avec Zod avant d'exécuter.
La validation rejette automatiquement les types invalides, les valeurs hors bornes,
les champs manquants.

Exemples de schémas :
- `SetRoleSchema` — body de POST /admin/users/:login/role
- Schéma inline pour PATCH /admin/users/:login/stats (`elo ≥ 0`, `matchesPlayed ≥ 0`, etc.)
- `AuditQuerySchema` — query params de GET /admin/audit-log

Aucun endpoint admin mutant n'accepte de payload non validé.

---

## 7. Authentification (42 OAuth + sessions)

### Le principe

L'identité d'un utilisateur vient de l'**intra 42**. On ne stocke aucun mot de passe.
On délègue l'authentification à l'OAuth de 42.

### Le flux OAuth

Fichier : `apps/backend/src/auth.ts`

| Route | Rôle |
|---|---|
| `GET /auth/login` | Démarre le flux OAuth (redirige vers l'intra 42). |
| `GET /auth/callback` | Retour de l'intra. Vérifie le code, récupère le profil 42, crée/maj l'utilisateur. |
| `GET /auth/web/login` | Variante du démarrage pour le site web. |
| `GET /auth/extension/login` | Variante pour l'extension navigateur. |
| `POST /auth/logout` | Détruit la session. |

Étapes du callback :
1. L'intra 42 renvoie un `code` + un `state`.
2. Le `state` est vérifié via un cookie signé (anti-CSRF du flux OAuth).
3. Le backend échange le `code` contre un access token 42, puis lit le profil (`login`, `campus`, image).
4. L'utilisateur est créé ou mis à jour en DB (`getOrCreateUser`).

### Les deux preuves de session acceptées

Le backend accepte **deux** moyens de prouver son identité (`getSessionLogin`) :

1. **Token Bearer** — en-tête `Authorization: Bearer <token>`.
   - Format : `<payloadBase64url>.<signature>`.
   - Signature : **HMAC-SHA256** avec `SESSION_SECRET` (`apps/backend/src/tokens.ts`).
   - Payload : `{ login, iat, exp }`. Durée de vie : **30 jours**.
   - Vérification : comparaison **timing-safe** (`timingSafeEqual`) + contrôle de l'expiration.
   - C'est ce que le **site web** utilise : le token est stocké dans `localStorage` et envoyé à chaque requête.

2. **Cookie de session signé** — cookie `httpOnly`, `SameSite=Lax`, signé avec `SESSION_SECRET`.

`getCurrentLogin` applique l'ordre : token/cookie d'abord, puis en dernier recours l'en-tête `x-dev-login` (réservé au développement local), sinon renvoie **401**.

### Cas du temps réel (SSE)

`EventSource` ne peut pas envoyer d'en-tête `Authorization`. Pour `GET /events`, le token
est donc passé en query (`/events?token=<token>`) et vérifié par `getStreamLogin` (même
logique : token signé, sinon cookie, sinon `x-dev-login`).

### Secret

- `SESSION_SECRET` signe **à la fois** les tokens Bearer et les cookies.
- S'il est absent, `getSessionLogin` renvoie `null` (personne n'est authentifié).
- Le générer : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

---

## 8. Autorisation (requireAdmin / requireSuperAdmin)

Une fois l'utilisateur **authentifié** (section 7), on vérifie ce qu'il a le **droit** de faire.

### Les rôles

- Enum `Role` en DB : `USER`, `ADMIN`, `SUPERADMIN` (`apps/backend/prisma/schema.prisma`).
- `getUserRole(login)` (`apps/backend/src/index.ts`) calcule le rôle :
  - Si le login est dans la liste **SUPERADMINS hardcodée** (`abidaux`, `throbert`) → toujours `SUPERADMIN`.
  - Sinon → le rôle stocké en DB.
  - Sinon → `USER` par défaut.

### Les gardes

| Garde | Règle | Si échec |
|---|---|---|
| `requireAdmin(login)` | Le rôle doit être `ADMIN` ou `SUPERADMIN`. | `403` |
| `requireSuperAdmin(login)` | Le login doit être dans la liste SUPERADMINS hardcodée. | `403` |
| `assertNotBanned(login)` | L'utilisateur ne doit pas avoir `bannedAt`. | `403` |

Chaque endpoint admin appelle la garde correspondante **avant** d'exécuter quoi que ce soit.

### Le rôle SUPERADMIN est immuable

À chaque connexion, `getOrCreateUser` **réimpose** le rôle `SUPERADMIN` aux logins de la
liste hardcodée. Aucune route API ne peut accorder ou retirer ce rôle. La liste vit
uniquement dans le code (`SUPERADMINS` dans `apps/backend/src/index.ts`).

### Deux notions d'« admin » distinctes (à ne pas confondre)

1. **Rôle `ADMIN`/`SUPERADMIN`** (ci-dessus) → contrôle l'accès au **GOD panel** et aux actions admin (ban, ELO, rôles…). Gardé par `requireAdmin` / `requireSuperAdmin`.
2. **Liste `isAdmin()`** (`apps/backend/src/admins.ts`, logins `throbert`/`abidaux`) → autorise uniquement la **création/validation des tournois OFFICIELS**. C'est une liste séparée, indépendante du rôle DB.

---

## 9. Permissions GitHub Actions

Chaque workflow utilise le **principe du moindre privilège** :

| Workflow | Permissions |
|---|---|
| `codeql.yml` | `actions: read`, `contents: read`, `security-events: write` |
| `dependency-audit.yml` | `contents: read` |
| `deploy.yml` (builds) | `contents: read`, `packages: write`, `security-events: write` |
| `security-alerts.yml` | `contents: read`, `security-events: read` |

Aucun workflow n'a `write` global. `security-events: write` est nécessaire pour uploader
les SARIF de Trivy/CodeQL dans l'onglet Security.

---

## Comment opérer

### Voir les alertes de sécu actives

GitHub → onglet **Security** → **Code scanning** :
https://github.com/42-League-corp/42_League/security/code-scanning

### Voir l'audit log des admins

1. Connecte-toi en ADMIN/SUPERADMIN
2. Clique sur le bouton **Shield rouge** dans la nav
3. Onglet **AUDIT**
4. Filtre par acteur / cible / action

### Voir le webhook Discord en action

Va dans le canal #audit ou #security. Si vide depuis longtemps :
- #audit silencieux = aucune action admin récente (normal)
- #security silencieux = aucune alerte de sécu ouverte (normal)

### Rotater un secret/webhook

Voir section "Webhooks Discord → Rotation d'un webhook" plus haut.

### Désactiver temporairement un scanner

Dans son `.yml` :
```yaml
on:
  workflow_dispatch:   # garde le manuel
  # schedule: ...       # commenter le cron
  # pull_request: ...   # commenter le trigger PR
```

### Forcer un re-scan

GitHub → Actions → choisir le workflow → **Run workflow** → main → Run.

---

## Cartographie des fichiers

```
.github/workflows/
├── codeql.yml                    # SAST (CodeQL)
├── dependency-audit.yml          # npm audit
├── deploy.yml                    # build + deploy + Trivy steps
├── security-alerts.yml           # → Discord pings
└── build.yml                     # build manuel (non-sécu)

apps/backend/
├── prisma/
│   ├── schema.prisma             # enum AdminAction + model AdminAuditLog
│   └── migrations/20260529030000_add_admin_audit_log/
│       └── migration.sql
└── src/
    ├── audit.ts                  # helper logAdminAction + notifyDiscord
    └── index.ts                  # 7 endpoints wrappés + GET /admin/audit-log

apps/web/src/
├── shell/DesktopShell.tsx        # bouton GOD desktop (gated)
├── mobile/primitives/MobileHeader.tsx  # bouton GOD mobile (gated)
├── lib/
│   ├── api.ts                    # types AdminAuditEntry + méthode adminAuditLog()
│   └── i18n.tsx                  # traduction nav.god
└── pages/GODPage.tsx             # onglet AUDIT + composant AuditTab
```

---

## Ce qui n'est PAS encore en place

Liste des features sécu envisagées mais pas implémentées :

- **2FA TOTP pour SUPERADMIN** — actuellement le compte 42 seul suffit
- **Sudo mode** — re-auth avant les actions destructives (ban, role change)
- **Rate limiting** — pas de protection contre brute-force/spam
- **CSP / HSTS headers** — `helmet` middleware non installé
- **Cloudflare WAF** — pas de proxy en amont du serveur
- **Branch protection** — push direct sur `main` toujours autorisé
- **Backups DB chiffrés offsite** — non automatisé
- **DAST** — pas de scan d'app déployée
- **Honey-tokens** — pas en place

À traiter dans des PRs séparées, par ordre d'impact.

---

## Glossaire

- **SAST** (Static Application Security Testing) — analyse du code source à la recherche de vulnérabilités. Outil : CodeQL.
- **DAST** (Dynamic Application Security Testing) — attaque d'une app en cours d'exécution. Pas en place.
- **SCA** (Software Composition Analysis) — scan des dépendances tierces. Outils : npm audit + Dependabot + Trivy.
- **SARIF** (Static Analysis Results Interchange Format) — format JSON standard pour les résultats de scans de sécu. C'est ce que CodeQL et Trivy uploadent.
- **CVE** (Common Vulnerabilities and Exposures) — identifiant public d'une vulnérabilité connue (ex: CVE-2024-1234).
- **Audit log** — registre des actions sensibles, immuable. Sert au forensics post-incident.
- **Fire-and-forget** — appel asynchrone dont on n'attend pas le résultat. Utilisé pour le webhook Discord : si Discord répond pas, on s'en fiche, l'action métier doit aboutir.
- **Defense in depth** (défense en profondeur) — empiler plusieurs couches de protection indépendantes.
