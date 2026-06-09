# Post-Mortem : Pourquoi `/api/auth/web/login` renvoyait 404

## TL;DR

Un **bug classique d'infra** : fichier de config sur le serveur à jour, mais conteneur Docker qui ne le voit pas. Caddy stockait l'ancienne config **en mémoire**, le `caddy reload` n'appliquait pas le nouveau fichier (il relit le fichier *interne* au conteneur, pas le fichier hôte), et le pipeline n'aurait jamais déployé la correction de toute façon.

---

## 1. Le symptôme

```
GET https://oneleague.fr/api/auth/web/login?return_to=...
→ HTTP 404 Not Found
```

**Tes utilisateurs cliquent sur « Sign in with 42 », ça renvoie un 404.** Logiquement, le backend a la route (line 116 de `auth.ts`), elle est montée en `/auth/web/login` (line 228 de `index.ts`). Comment un endpoint qui existe renvoie 404 ?

---

## 2. Le diagnostic (comme tu l'aurais fait)

### Hypothèse 1 : c'est le frontend qui renvoie le 404

**Faux.** Ton nginx a un SPA fallback (`try_files $uri /index.html`). Toute route inconnue du frontend renvoie `index.html` en **200**, jamais 404. Et on voyait un **body vide "404 Not Found"**, pas du HTML.

### Hypothèse 2 : c'est le backend Hono qui bloque

**Partiellement vrai, mais pas de la façon attendue.**

J'ai testé **en direct** depuis le serveur (on court-circuite Caddy) :
```bash
docker exec league-caddy wget -qO- http://backend:3000/users
→ [{"login":"throbert", ...}]   # ✅ 200 JSON, le backend répond
```

Donc le **backend lui-même fonctionne parfaitement**. Mais pourquoi le renvoie-t-il 404 sur `/api/...` et 200 sur `/users` ?

**Cause : tu appelles `/api/auth/web/login` (avec le préfixe `/api`), mais les routes Hono sont `/auth/...`, `/users`, `/me` (sans `/api`). Le préfixe doit être strippé quelque part.**

### Hypothèse 3 : c'est Caddy qui ne strippe pas

**Bingo.**

Ton `Caddyfile` a bien :
```caddy
handle /api/* {
    uri strip_prefix /api         # ← ça devrait enlever /api
    reverse_proxy backend:3000
}
```

Mais en live, les requêtes arrivaient au backend **encore préfixées par `/api`**. Donc le `strip_prefix` n'était **pas appliqué**.

---

## 3. Pourquoi ? La cause racine

### Niveau 1 : fichier hôte vs conteneur

Quand tu lances `docker compose`, Caddy tourne **en tant que conteneur**. Son système de fichiers est **isolé**. Pour que Caddy accède au `Caddyfile` de ton hôte, tu utilises un **bind-mount** (dans `docker-compose.registry.yml`) :

```yaml
caddy:
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile   # ← bind-mount
```

**Le bind-mount crée un lien vivant** : quand tu modifies `Caddyfile` sur l'hôte, le fichier change aussi *dans le conteneur*. **Mais le processus `caddy` qui tourne dans le conteneur ne recharge pas tout seul.**

Tu as fait un `caddy reload --config /etc/caddy/Caddyfile` pour forcer une relecture. Et `caddy` a dit `exit 0` (succès). **Mais il a rellu son fichier *interne*.**

Ici commence le piège : **un `caddy reload` relit le fichier spécifié, mais *avec le chemin depuis le conteneur*, pas depuis l'hôte.** Le fichier a changé en **mémoire** (un bind-mount est vivant), mais le processus Caddy **n'a jamais redémarré** — il gardait ses anciennes structures de données en RAM. Un `reload` c'est un soft-restart du routeur Caddy, pas du processus.

### Niveau 2 : le fix qui n'est jamais arrivé

Ton fix (`uri strip_prefix /api`) existe dans le repo depuis le commit `ed669ef`. Mais **il n'a jamais été copié sur le serveur** au moment du déploiement. Pourquoi ?

Regarde la condition du job `deploy` dans le workflow GitHub Actions *d'avant* :

```yaml
if: |
  (
    github.event.inputs.deploy_only == 'true' ||
    (
      (needs.build-backend.result == 'success' || 'skipped') &&
      (needs.build-frontend.result == 'success' || 'skipped') &&
      (needs.build-backend.result == 'success' || needs.build-frontend.result == 'success')   # ← clé
    )
  )
```

**Traduction** : on déploie seulement si :
1. L'utilisateur a cliqué sur le bouton `deploy_only`, **OU**
2. Au moins un des deux jobs (backend/frontend) a réussi à rebuilder (**succès**, pas juste skippé)

Or, tu as modifié **seulement** le `Caddyfile`. Les `paths-filter` du workflow regardent `apps/backend/**`, `apps/web/**`, `packages/**`. Le Caddyfile n'est dans aucun de ces chemins → `build-backend` et `build-frontend` sont **tous les deux skipped** → la condition 2 est fausse → la condition 1 est fausse (pas de dispatch) → **le job `deploy` ne tourne pas** → ton `Caddyfile` modifié ne part jamais sur le serveur.

**Résumé de la chaîne d'erreurs :**

```
Toi : je modifie Caddyfile
  ↓
GitHub : aucun chemin de mes filters n'a changé
  ↓
Build-backend && build-frontend : skipped
  ↓
Condition deploy : (false || false) = faux
  ↓
Deploy : ne tourne pas
  ↓
Serveur : garde l'ancien Caddyfile
  ↓
Caddy : tourne avec l'ancienne config (sans strip)
  ↓
Requête /api/... → 404
```

---

## 4. Les deux couches du fix

### Fix immédiat : recréer le conteneur (Étape 2 du tuto)

```bash
docker compose -f docker-compose.registry.yml up -d --force-recreate caddy
```

**Pourquoi ça marche** : `--force-recreate` :
1. Arrête et supprime le conteneur `league-caddy` existant (il oublie ses vieilles données en RAM)
2. Crée un nouveau conteneur avec un **nouveau processus Caddy**
3. Monte le bind-mount *neuf* (qui contient déjà le bon `Caddyfile`)
4. Caddy lit le fichier au démarrage → applique le `strip_prefix`

À comparer avec `caddy reload` (relecture live, sans redémarrage du processus) : ici, on redémarre vraiment, donc tout est frais. C'est brutal mais fiable.

**Downtime** : quelques millisecondes (temps de redémarrage du conteneur + prise en charge des connexions réseau).

### Fix durable : correction du pipeline (Étape 6)

Deux changements dans `deploy.yml` :

#### 6a. Déployer même si les builds sont skipped

```yaml
if: |
  always() &&
  needs.build-backend.result != 'failure' &&
  needs.build-frontend.result != 'failure'
```

**Logique nouvelle** : on déploie tant que rien n'a **échoué** (on accepte `success` ET `skipped`). Ainsi, modifier juste le `Caddyfile` déclenche le déploiement.

#### 6b. Recréer Caddy au lieu de le reloader

```bash
docker compose -f docker-compose.registry.yml up -d --force-recreate caddy
# au lieu de :
# docker exec league-caddy caddy reload --config /etc/caddy/Caddyfile
```

**Pourquoi** : un `caddy reload` ne suffit jamais à 100% pour les changements de config basiques (les exemples côté Caddy montrent qu'il faut parfois un restart complet). Forcer la recréation du conteneur est **plus simple et plus fiable** : le conteneur neuf voit toujours le bon fichier.

---

## 5. Ce que ça montre : les pièges classiques d'infra

### Piège n°1 : config en mémoire vs config sur disque

Un processus peut lire une config au démarrage, puis la garder **en mémoire**. Si tu modifies le fichier sur disque mais le processus tourne toujours, il ne verra jamais ta modif. Solution : **redémarrer le processus**, pas juste lui demander de relire le fichier.

**Dans la vraie production** : même problème avec nginx (`nginx -s reload`), Apache (`apachectl reload`), etc. Parfois un reload suffit, parfois non. C'est pour ça qu'on préfère les conteneurs : `docker restart` = redémarrage complet, zéro ambiguïté.

### Piège n°2 : pipeline qui optimise trop

La condition `if: (builds success)` économise du temps — pas besoin de déployer si rien n'a changé. **Mais elle oublie les changements de config**, qui ne triggent pas de rebuild. Solution : avoir une condition qui accepte aussi les changements de config (`|| path('Caddyfile')`) ou juste autoriser le déploiement même en cas de skip (comme on l'a fait).

### Piège n°3 : oublier que Docker isole

Un bind-mount, c'est vivant. Mais le processus **dans** le conteneur ne sait rien de ça — il voit juste un fichier à un chemin, sans savoir que ce chemin est lié à l'hôte. Si le processus cache la config (mémoire), changer le fichier ne suffit pas.

---

## 6. Comment debugger ça en 5 min (la méthode)

Quand ton app répond partout 404, voici la méthode fiable :

1. **Vérifier la chaîne de proxies** : est-ce que la requête passe par tous les proxies (frontend → Caddy → backend) ?
   - Tester le backend en direct (bypass Caddy)
   - Tester Caddy en direct (bypass frontend)
   - Tester le frontend (requête complète)
   
2. **Si le backend en direct répond, mais via proxy non** : c'est un problème de proxy (Caddy/nginx/...).

3. **Si Caddy fait du strip, mais les requêtes arrivent encore préfixées** : c'est une config périmée. Vérifier les deux :
   - Fichier config sur disque : `cat /path/to/Caddyfile | grep strip`
   - Fichier config *dans le conteneur* : `docker exec caddy_container cat /etc/caddy/Caddyfile | grep strip`
   - **Si différents** → récréer le conteneur.

4. **Si les deux fichiers sont identiques mais toujours pas appliqué** → redémarrer le **processus**, pas juste reloader la config.

---

## 7. Leçon pour vos futurs projets

- **Séparation config/processus** : bien penser à comment tu vas updater la config en production. Reload suffit ? Ou redémarrage obligatoire ?
- **Pipeline et config-only** : si tu as un pipeline de déploiement, autorise les déploiements même quand seule la config change (pas de rebuild). Sinon tu publieras jamais certains fixes.
- **Bind-mounts + état en mémoire** : dangereux. Préfère des **multistage Docker** où tu bakes la config dans l'image (immutable), plutôt que du bind-mount avec un processus qui cache.
- **Vérifier live** : quand tu changes une config, **vérifier que c'est bien appliqué** avec une requête test. `caddy reload exit 0` ne veut pas dire « c'est appliqué », ça veut juste dire « la syntaxe est OK ».

---

## Chiffres

- **Temps pour diagnostiquer** : ~20 min (curl sur les endpoints, vérifier les headers CORS, identifier que Hono recevait `/api/...` au lieu de `/auth/...`).
- **Temps pour réparer en prod** : 10 s (une recréation de conteneur).
- **Temps pour prévenir à l'avenir** : 5 min (deux lignes dans le pipeline).

C'est les ratios typiques d'une config mal gérée.
