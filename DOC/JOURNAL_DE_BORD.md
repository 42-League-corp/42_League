# Journal de bord — 42 League, de 0 au déploiement

> Carnet chronologique de **tout** l'avancement du projet : à chaque étape, le problème
> rencontré, ce qu'on a **tenté**, ce qui **n'a pas marché** et **pourquoi**, puis **comment
> on a fixé**. Reconstruit à partir de l'historique git (78 commits sur `main`, du
> 25 mai au 31 mai 2026).
>
> Cible : un dev qui reprend le repo et veut comprendre non seulement *ce que fait* le code
> (voir [STACK](./STACK.md), [DOMAIN](./DOMAIN.md), [API](./API.md)…) mais *par quels
> tâtonnements on y est arrivés*. Les incidents les plus profonds ont leur propre
> post-mortem : voir [POST_MORTEM_404_BUG](./POST_MORTEM_404_BUG.md).

---

## Vue d'ensemble : les grandes phases

| Phase | Dates | Thème | Où ça a fait mal |
|-------|-------|-------|------------------|
| **0. Amorçage** | 25 mai | Premier commit, extension Chrome sur l'intra | WSL, CORS, Private Network Access |
| **1. Le produit** | 26–27 mai | Déclaration de match, score, abaque, trophées, refonte UI | Voir les scores des autres, fluidité du flow |
| **2. Mise en prod** | 28–29 mai | Docker, CI/CD, Caddy, domaine, OAuth en prod | Le **404 sur login**, www→apex, port exposé |
| **3. Le métier** | 29 mai | ELO babyfoot, anti-farming, rôles, SSE temps réel | Seuils anti-farming, popups SSE |
| **4. Durcissement** | 29 mai | Sécurité, backdoor dev, cookies, tests, RGPD | Backdoor `x-dev-login`, build qui casse |
| **5. Polish & scale** | 30–31 mai | i18n, mobile, OPS, GOD panel, classement graphique, reset ligue | Sheets mobiles inatteignables, numéro de build |

---

## Phase 0 — Amorçage : faire vivre une extension dans l'intra 42

### 0.1 « L'extension ne marche pas sous WSL »

**Contexte.** Le projet démarre (`first commit`, 25 mai) comme une **extension Chrome MV3**
greffée sur l'intra 42 (voir [EXTENSION.md](./EXTENSION.md)). Premier mur dès le lendemain.

**Symptôme.** L'extension chargée depuis un environnement WSL ne se comportait pas comme en
natif (chemins / build).

**Fix.** `Fix: Extention now compatible with WSL environment` (7e6d954). Premier rappel d'une
constante du projet : **l'environnement de dev n'est pas l'environnement cible**, thème qui
reviendra en force en prod (conteneurs Docker, cf. Phase 2).

### 0.2 Le blocage CORS / Private Network Access sur l'intra

**Contexte.** L'idée forte : afficher l'ELO et le W/L **directement sur la page de profil
intra** d'un joueur. Le content script doit donc appeler **notre backend en `localhost`**
depuis une page servie par `intra.42.fr`.

**Symptôme.** Chrome bloquait les requêtes : erreur stricte **Private Network Access (PNA)** —
une page publique (intra) n'a pas le droit d'appeler une ressource du réseau privé (localhost),
et la **CSP de l'intra** interdisait de toute façon ces appels depuis le content script.

**Ce qu'on a tenté.** Appeler le backend directement depuis le content script (le réflexe
naturel). Bloqué par la politique du navigateur — ce n'est pas contournable côté page.

**Le fix** (`feat(extension): intégration stats intra et fix du blocage CORS`, d907766).
On **déplace les appels réseau hors de la page** : le content script ne fait plus de `fetch`,
il envoie un message au **service worker (background)**, qui lui n'est pas soumis à la CSP de
l'intra et peut appeler `localhost`. Refacto de `api.ts` autour de ce **proxy via background**.

**Leçon.** Sur MV3, le content script vit *dans* la page hôte et hérite de ses contraintes
(CSP, PNA). Tout appel sensible doit transiter par le service worker. C'est le motif central
de l'architecture extension, documenté dans [EXTENSION.md](./EXTENSION.md).

### 0.3 CORS côté backend en local

**Symptôme.** Même après le proxy, les origines `localhost` (front Vite + extension) étaient
refusées par le middleware CORS du backend.

**Fix.** `fix(backend): allow localhost origins in CORS middleware` (190d7d8). On autorise
explicitement les origines locales en dev. Le parsing de `WEB_APP_URLS` deviendra plus tard une
primitive **testée** (cf. Phase 4, suite de tests sécurité).

---

## Phase 1 — Le produit : déclarer un match sans se tromper

### 1.1 Rendre la déclaration de match agréable… et exacte

**Contexte.** Cœur du produit : déclarer une partie de babyfoot. Plusieurs itérations rapides
les 26–27 mai (`possibilite de mettre un score apres la game`, abaque, recherche d'adversaire).

**Ce qui a été conçu, et pourquoi.**
- **Abaque type babyfoot** (`AbacusSlider`, e98a248) : une bille 3D qui glisse sur une tige
  métallique avec snap magnétique. Choix esthétique assumé (le babyfoot), mais aussi
  ergonomique : un score se règle au doigt, sans clavier, sur mobile.
- **Recherche d'adversaire triée par fréquence** (9ac2289) : on remonte les adversaires les
  plus joués en premier — sur un babyfoot on rejoue souvent les mêmes personnes. La liste
  affiche un badge « X games jouées » / « Jamais joué ».
- **Capacité de tournoi 2 ou 4** (1e4b5ee) : on a *réduit* les options plutôt que d'en
  offrir trop — décision produit pour coller au format réel.

### 1.2 « Je n'arrive pas à voir le score des autres joueurs »

**Symptôme.** Depuis la page intra d'un autre joueur, impossible de voir son score.

**Fix.** Corrigé dans le même lot que l'ajout du score post-game (32d039c). À ce stade le
produit bascule de « mon profil » vers « la ligue » : il faut pouvoir consulter **tout le
monde**, ce qui préfigure le besoin d'un vrai backend partagé et d'une mise en prod.

### 1.3 Refonte UI « premium gris/or RPG » + version mobile

**Contexte.** Première grosse refonte visuelle (PR #1 `refonte-ui-gold`, fb40b9d, mergée par
throbert) puis **version mobile 2.0** (aea327f). C'est le début du **split desktop/mobile**
qui structurera tout le front (voir [FRONTEND.md](./FRONTEND.md)) — et qui sera aussi une
source de bugs récurrents (sheets inatteignables, cf. Phase 5).

---

## Phase 2 — Mise en prod : là où tout se complique

C'est la phase la plus douloureuse, et celle qui a généré le plus de post-mortems.

### 2.1 Infra Docker de production

**Contexte.** 28 mai : `Ajout de l'infrastructure Docker de production` (70632a7, committé par
`server 42league` — donc directement sur la machine cible). On passe d'un projet local à une
stack conteneurisée (front + backend + DB + reverse proxy Caddy). Détails dans
[STACK.md](./STACK.md).

### 2.2 Le CI/CD : déployer automatiquement (et ses chausse-trappes)

**Contexte.** 29 mai au petit matin : mise en place de GitHub Actions (`ci: add GitHub Actions
deploy workflow`, ff57c951 ; `Add: CI/CD`, a71e0a6 ; `add: ci manuel action`, bcc06a6).

**Problèmes successifs rencontrés sur le pipeline :**

1. **Le front ne buildait pas du tout** (`fix: front issue cannot build`, ce34915). Build
   bloquant — on ne déploie rien tant que `vite build` casse.
2. **Besoin de forcer un déploiement sans rebuild** (`Add force build workflow + deploy_only
   option`, 7b2e378). On ajoute un `workflow_dispatch` avec une option `deploy_only` — qui se
   révélera **être à la fois la solution et la cause** du bug 404 (cf. 2.5).
3. **`trivy-action` épinglée sur une version inexistante** (`fix: pin trivy-action to existing
   version 0.24.0`, 584379d). Classique : une action référencée en `@latest`/version fantôme
   casse le job. Fix = **pin sur une version qui existe vraiment**.
4. **Nettoyage Docker qui faisait échouer le déploiement** : `a prune operation is already
   running` faisait planter le job sous `set -e`. Fix (77d1465) : nettoyer **avant** le pull
   et rendre l'étape **non bloquante** (`|| true`).
5. **Clé SSH loggée en clair** : un step `Debug SSH key` fuyait la clé dans les logs CI.
   Supprimé (77d1465). Cf. Phase 4 (durcissement).

### 2.3 OAuth 42 et URL d'API en prod

**Symptôme.** En local tout marche ; en prod l'app ne sait plus où taper l'API.

**Fix.** `chore: rebuild frontend with new API URL` (7376b41) + `compatible with online
version` (22dd090). L'URL d'API est **bakée au build** du front : changer de cible = **rebuild
obligatoire**. Ce couplage build/config reviendra mordre (cf. 2.5 et Phase 4 build TS).

### 2.4 `www` vs apex

**Symptôme.** `www.42league.fr` ne se comportait pas comme `42league.fr`.

**Fix.** `fix: redirect www to apex domain` (8c218ca) — redirection `www` → apex côté Caddy.
Petit, mais typique du travail de mise en prod : la config DNS/proxy déborde de cas limites.

### 2.5 ⭐ Le bug 404 sur `Sign in with 42` — l'incident majeur

**Symptôme.** `GET /api/auth/web/login` → **404**. Les utilisateurs cliquent sur « Sign in with
42 » et tombent sur un 404, alors que la route **existe** côté backend.

**Tentatives & fausses pistes** (résumé — le détail vaut la lecture intégrale du
[post-mortem dédié](./POST_MORTEM_404_BUG.md)) :
- Hypothèse « c'est le front » → **faux** (le SPA fallback renvoie du 200, pas un body
  `404 Not Found`).
- Hypothèse « le backend bloque » → **partiellement** : en testant le backend **en direct**
  (`docker exec … wget backend:3000/users`), il répond 200. Donc le backend va bien.
- Cause réelle : le front appelle `/api/...` mais les routes Hono sont `/auth/...` **sans**
  préfixe. **Caddy devait stripper `/api` et ne le faisait pas.**

**Double cause racine :**
1. **Config en mémoire vs disque.** Le `Caddyfile` corrigé était sur l'hôte (bind-mount), mais
   `caddy reload` relit le fichier *interne au conteneur* et ne redémarre pas le processus :
   l'ancienne config restait **en RAM**.
2. **Le fix n'arrivait même jamais sur le serveur.** Le pipeline ne déployait que si un build
   backend/front **réussissait**. Modifier **seulement** le `Caddyfile` (hors des `paths-filter`)
   → builds *skipped* → condition de deploy fausse → **rien n'est déployé**.

**Le fix, en deux couches** (`fix: strip /api prefix…`, 860319a ; `ci: deploy on config-only
changes + recreate caddy`, d54dc54) :
- **Immédiat** : `docker compose up -d --force-recreate caddy` → nouveau processus, config
  fraîche.
- **Durable** : (a) déployer tant que rien n'a **échoué** (`always() && result != 'failure'`),
  pour que les changements config-only partent aussi ; (b) **recréer** Caddy au lieu de le
  `reload`.

**Leçon.** Trois pièges classiques d'infra, tous documentés : config en mémoire ≠ sur disque,
pipeline qui « optimise trop » et oublie les changements de config, et l'isolation Docker qu'on
oublie. → [POST_MORTEM_404_BUG.md](./POST_MORTEM_404_BUG.md).

### 2.6 Port 3000 exposé + reload Caddy

**Fix.** `fix: caddy reload on deploy + remove exposed port 3000` (1a68b63). On **ferme le port
backend** exposé inutilement (surface d'attaque) : tout passe par Caddy. Première brique
sécurité avant la Phase 4.

---

## Phase 3 — Le métier : ELO babyfoot, anti-farming, temps réel

### 3.1 Un ELO « babyfoot », pas un ELO d'échecs

**Contexte.** `new ELO calcul` (4ac460f). L'ELO standard ne suffit pas pour un babyfoot : on
veut récompenser l'**upset** (battre un plus fort) et prendre en compte l'**écart de score**.
La formule exacte (somme nulle, symétrie, bonus d'upset, gamelles) est devenue un **invariant
testé** — voir la suite de tests ELO en Phase 4 et la formule dans [DOMAIN.md](./DOMAIN.md).

### 3.2 L'anti-farming trop agressif

**Symptôme.** Le détecteur d'**anti-farming** (jouer en boucle contre un faible pour grimper)
flaggait du **jeu normal**.

**Ce qui n'allait pas.** Seuil initial : **8 matchs en 7 jours**. Or un joueur casual fait
~3 matchs/semaine — mais une bonne soirée de babyfoot dépasse vite 8 parties. Le seuil
attrapait des faux positifs.

**Le fix** (`fix: increase recent_farming threshold to 15+ matches/week`, 527edb0). Relevé à
**15+ matchs/semaine** (2+/jour), sévérité `high` à **20+**. On calibre sur le **comportement
réel** de farming, pas sur la peur du faux négatif.

**Leçon.** Un seuil de détection se règle avec des données d'usage, pas a priori. Trop bas = on
punit les joueurs assidus ; trop haut = on laisse passer les tricheurs. Détail dans
[DOMAIN.md](./DOMAIN.md).

### 3.3 Rôles & SSE temps réel

**Contexte.** `feat: add role system (SUPERADMIN/ADMIN), feature requests, real-time SSE`
(a582c09). Trois choses d'un coup :
- **Rôles** USER / ADMIN / SUPERADMIN, avec **SUPERADMIN hardcodé** pour `abidaux` & `throbert`,
  imposé **au login** (et non modifiable via l'API — garde anti-escalation, cf. Phase 4).
- **Demandes de feature** + endpoint de review admin.
- **SSE** (`/events`) : push temps réel des événements match/défi vers le front, plutôt que du
  polling. Catalogue complet dans [REALTIME.md](./REALTIME.md).

### 3.4 La popup SSE qui s'emballe

**Symptôme.** `fix: SSE on notif` (86f935f) puis `fix: popup sse` (ea60f82). Les notifications
temps réel déclenchaient des popups en double / mal ciblées.

**Fix.** Ciblage des événements SSE (ne pas notifier tout le monde de tout) et **dédoublonnage
/ debounce** côté front. La **privacy des events** (ne pas fuiter un événement à un client qui
ne devrait pas le voir) deviendra elle aussi un **test** en Phase 4. Voir le mapping
domaine + debounce dans [REALTIME.md](./REALTIME.md).

---

## Phase 4 — Durcissement : sécurité, tests, conformité

### 4.1 La backdoor `x-dev-login` ouverte en prod

**Symptôme — le plus grave du projet.** Un header `x-dev-login` permettait de se logger en tant
que n'importe qui **sans OAuth** — pratique en dev, mais **honoré en prod**. C'était un bypass
d'authentification *et* d'élévation jusqu'à SUPERADMIN.

**Le fix** (`harden: gate x-dev-login backdoor…`, 77d1465). Le header n'est désormais honoré
**que si `ALLOW_DEV_LOGIN=true`** — **fail-secure**, OFF par défaut. En prod la variable n'est
pas posée → la backdoor est fermée. (Même commit : suppression du `Debug SSH key`, nettoyage
Docker robuste — cf. 2.2.)

**Leçon.** Tout raccourci de dev doit être **gated par défaut OFF**, pas « on désactivera en
prod ». Le défaut sûr est l'absence de privilège. C'est ce qui rend la primitive **testable**
(cf. 4.3).

### 4.2 Cookies sécurisés

**Fix.** `Add: secured cookie and backend secure tests` (db80931) : flags de cookie de session
durcis (sécurité de la session côté navigateur), accompagnés de tests backend. Voir
[SECURITY.md](./SECURITY.md).

### 4.3 Une suite de tests sécurité… sans base de données

**Problème.** Comment tester sérieusement les primitives de sécurité **en CI**, sans dépendre
d'une vraie DB (lente, fragile, à provisionner) ?

**Ce qu'on a fait** (`test: comprehensive security test suite (365 tests, DB-free)`, d82c82d).
**365 tests qui tournent sans DB**, donc directement en CI :
- **tokens** : forgerie, tamper signature/payload, usurpation de login, extension d'expiry,
  malformés, comparaison **constant-time** (timing attack) ;
- **schémas Zod** : bornes de score, format de login, **garde anti-escalation SUPERADMIN**,
  payloads adversariaux (XSS / SQL / unicode / DoS) ;
- **elo** : invariant somme nulle, symétrie, monotonicité, valeurs exactes, gamelles ;
- **anti-farming** : cap par fenêtre glissante, scénario de farming bloqué ;
- **sse** : ciblage/privacy (pas de fuite), multi-onglets, éviction des connexions *stale* ;
- **cors** : parsing de `WEB_APP_URLS`.

Chaque incident des phases précédentes (3.2 anti-farming, 3.4 privacy SSE, 4.1 anti-escalation,
0.3 CORS) devient ici un **test de non-régression**.

### 4.4 Le harness d'intégration (Phase 2 — laissé incomplet, assumé)

**Contexte.** `wip(test): harness d'intégration des routes (Phase 2 — incomplet)` (55dae7d).
On voulait tester les **45 endpoints** réels sur une vraie DB.

**Le problème technique à résoudre d'abord :** importer l'app Hono dans un test **sans démarrer
le serveur HTTP**. Fix : `export` de `app` + `serve()` gardé derrière `NODE_ENV !== 'test'`.
Helpers `resetDb` (TRUNCATE), `seedUser`, auth via `x-dev-login` (réactivé **uniquement** en
env de test, cohérent avec 4.1).

**Statut assumé.** Infra verte (smoke OK), mais les tests des 45 endpoints sont **laissés en
TODO** — c'est documenté honnêtement dans le message de commit et dans [TESTING.md](./TESTING.md),
plutôt que prétendu fini.

### 4.5 Alertes sécurité → Discord

**Contexte.** `add: security layer — audit log, Discord webhook, CodeQL, Trivy, npm audit`
(9676a88) et suites. Un **audit log** applicatif + des **scanners CI** (CodeQL, Trivy, npm
audit) qui poussent leurs alertes sur **Discord**.

**Petit accroc de config.** `fix: hardcode security webhook URL inline` (762a777) puis
`feat: send daily heartbeat to Discord even when no alerts` (d2bd01b). Le **heartbeat
quotidien** résout un piège du monitoring : *l'absence d'alerte est ambiguë* (tout va bien, ou
le job est cassé ?). Un battement quotidien lève l'ambiguïté.

### 4.6 RGPD & conformité API 42

**Fix.** `RGPD & 42 API conform` (2b932d7) + `add: Oauth compliance reassuring` (d9b7d9f).
Mise en conformité (CGU, textes rassurants OAuth, traitement des données). La **suppression de
compte** sera reprise plus proprement en Phase 5 (grâce différée).

### 4.7 Le build prod cassé par le mode strict TS

**Symptôme.** Le build Docker du front (`tsc -b && vite build`) échouait sur **5 erreurs
TypeScript strict-mode** — bloquant le déploiement.

**Cause détaillée** (`fix(web): unblock prod build — strict-mode typecheck errors`, 565865b) :
- `useLeagueData` : le `setData` **omettait `locations`** (pourtant requis par `LeagueData`).
  Fix : updater **fonctionnel** qui préserve l'existant (`locations` vient d'un poller séparé).
- `vite.config` / `formatDate` : `datePart` / `timePart` / `month` / `day` *possibly undefined*.
  Fix : **valeurs par défaut au destructuring**.

**Leçon.** « Ça marche en dev » ≠ « ça build en prod » : le typecheck strict ne tourne qu'au
build. Aucune modif de comportement, mais sans ça **rien ne se déploie**. Écho direct au
couplage build/config de la Phase 2.

---

## Phase 5 — Polish & passage à l'échelle (30–31 mai)

### 5.1 Les sheets mobiles dont on n'atteignait pas le bas

**Symptôme.** Sur mobile, dans les *sheets* de déclaration de game / défi, **le bas du
formulaire (le bouton de validation) était inatteignable** — impossible de scroller jusqu'en
bas.

**Cause & fix** (`feat(web): i18n espagnol, fixes mobile…`, 3dab0c2). Problème de hauteur en
flexbox : un conteneur flex ne rétrécit pas sous son contenu sans `min-h-0`. Fix : **`flex-1
min-h-0`** sur le conteneur scrollable. Bug flexbox classique mais piégeux.

### 5.2 Le seuil mobile/desktop mal placé

**Symptôme.** Des tablettes / petits laptops tombaient du mauvais côté du split responsive.

**Fix.** `Fix: seuil mobile/desktop abaissé de 1024px à 768px` (98b78de). On déplace le
breakpoint à 768px pour coller à l'usage réel. (Le split desktop/mobile, né en Phase 1.3, reste
le point sensible du front — voir [FRONTEND.md](./FRONTEND.md).)

### 5.3 Le numéro de build absent en prod → `v0.4.?`

**Symptôme.** L'app affiche sa version à partir du **nombre de commits**, mais en prod ce
numéro était absent → affichage `v0.4.?`.

**Cause.** Le **build Docker** ne dispose pas de l'historique git (contexte de build sans
`.git`, ou clone *shallow*) → impossible de compter les commits à la construction de l'image.

**Fix.** `Fix: numero de build (commit count) absent en prod` (820cac5) — injection du compte
de commits **au moment du build**. Encore un cas « le conteneur ne voit pas ce que voit
l'hôte » (le thème de la Phase 2).

### 5.4 Refonte des OPS

**Contexte.** `Add: refonte OPS — 24h, 3 matchs forcés (refus = 3x ELO), révélation cinématique`
(4677426). Refonte d'un mode de jeu « ops » : fenêtre 24h, 3 matchs forcés, **refuser coûte
3× l'ELO** (incitation à jouer), révélation cinématique. Le détail des timers ops est dans
[REALTIME.md](./REALTIME.md) et [DOMAIN.md](./DOMAIN.md).

### 5.5 GOD panel : modération et historique complet

**Contexte.** Le panneau admin grossit : `add GOD pannel` (333c91c, Phase 3) → `All History`
(c290295) → `edit/delete + modération inline par ligne` (3ffb3dc) → **reset total de la ligue**
(f215ac1). Le reset (SUPERADMIN) supprime matchs & tournois, remet tout le monde à **1000 ELO**,
purge les comptes désactivés — **derrière une phrase de confirmation manuelle** et une action
d'audit `RESET_DATABASE`. La confirmation manuelle est la leçon de 4.1 appliquée : une action
destructrice doit être **difficile à déclencher par accident**.

### 5.6 Annuler sa propre déclaration

**Fix.** `Add: annulation de sa propre declaration de match par le declarant` (6b4bcb5). On
permet au déclarant d'**annuler sa déclaration** — boucle de validation bilatérale assouplie
(voir le cycle de vie d'un match dans [DOMAIN.md](./DOMAIN.md)).

### 5.7 Suppression de compte différée (grâce 30 jours)

**Problème.** La suppression RGPD immédiate est **irréversible** : un clic de trop et le compte
(et son historique) disparaissent.

**Le fix** (f215ac1). **Suppression différée avec période de grâce de 30 jours**
(`deletionScheduledAt`) : retrait **immédiat** du classement, **anonymisation définitive par un
job quotidien**, **annulable** en se reconnectant avant l'échéance. Reprend proprement la
conformité ébauchée en 4.6. Migration + champ schema + textes i18n FR/EN. Voir
[DATABASE.md](./DATABASE.md).

### 5.8 i18n & données de test

**i18n.** Espagnol ajouté sur tout le site + **détection de la langue navigateur** (fr/es sinon
en), y compris pour le message de login OAuth (3dab0c2).

**Données de test.** `add: commande to add fake users in db` (1cae1ac) — une commande pour
peupler la DB de faux joueurs, indispensable pour tester le **classement graphique** (nuage de
points ELO × matchs joués) à l'échelle.

---

## Fils rouges du projet (ce qui revient sans cesse)

1. **« L'environnement de dev ≠ l'environnement cible. »** WSL (0.1), conteneurs Docker (2.5),
   build sans `.git` (5.3), typecheck strict au build (4.7). À chaque fois, le code « marchait »
   quelque part et pas là où il fallait.

2. **Config en mémoire ≠ config sur disque.** Le 404 Caddy (2.5) en est l'archétype : recréer
   le processus, ne pas juste lui demander de relire.

3. **Tout raccourci de dev doit être OFF par défaut.** La backdoor `x-dev-login` (4.1) et la
   confirmation manuelle du reset ligue (5.5) sont les deux faces de la même règle.

4. **Un incident → un test.** Anti-farming (3.2), privacy SSE (3.4), anti-escalation (4.1) sont
   tous devenus des tests de la suite DB-free (4.3). On corrige une fois, on régresse jamais.

5. **Honnêteté sur l'inachevé.** Le harness d'intégration (4.4) est explicitement marqué
   « Phase 2 — incomplet » dans le commit et la doc, plutôt que maquillé en terminé.

---

> **Pour aller plus loin :** [POST_MORTEM_404_BUG.md](./POST_MORTEM_404_BUG.md) (l'incident en
> détail), et à la racine du repo `security-patches.md` (mémoire de sécurité, patches numérotés)
> et `pending.md` (backlog). Index général : [README.md](./README.md).
