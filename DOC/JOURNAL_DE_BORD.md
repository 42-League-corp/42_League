# Journal de bord — 42 League, de 0 au déploiement

> Carnet chronologique de **tout** l'avancement du projet : à chaque étape, le problème
> rencontré, ce qu'on a **tenté**, ce qui **n'a pas marché** et **pourquoi**, puis **comment
> on a fixé**. Reconstruit à partir de l'historique git (`main` + `develop`/staging), du **25 mai
> au 6 juin 2026** (du premier commit aux features communautaires — notifications, badges, suivi,
> saisons — puis au multi-disciplines, à l'économie de League Coin, aux paris, et à la refonte des
> tournois).
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
| **6. Communauté & ères** | 1–31 mai | Tournois privés/poules, OPS « chasse », H2H, notifs, badges, suivi, saisons | Brackets non-pow2, fuite du Bearer en SSE, open access |
| **7. Multi-disciplines** | 31 mai–2 juin | Smash, Échecs, Street Fighter, fléchettes, babyfoot 2v2, game registry | Le « 10-0 aux échecs », FFA Smash vs fléchettes mêlés |
| **8. Économie & paris** | 2–6 juin | League Coin (gains/quêtes hebdo), paris sur le vainqueur de tournoi, grades GM, GOAT | Farming de coins, paris sur soi-même, paris par match |
| **9. Refonte tournois** | 5–6 juin | Pile-ou-face cinématique, `activeMatchId`, byes & capacités pow2, animations VERSUS/bracket | Page qui rechargeait tout, byes sur capacité non-pow2 |
| **10. God, staging & durcissement** | 5–6 juin | Panneau god tournois, synchro ELO prod→staging, TesterSwitch, audit cyber, build | Boot staging cassé, builds CI hors-ligne |

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

## Phase 6 — Communauté & ères (1–31 mai)

Une fois le produit stable et déployé, la suite vise l'**engagement** : faire vivre la ligue dans la
durée et lui donner une dimension sociale. Plusieurs gros chantiers s'enchaînent.

### 6.1 Tournois plus riches : privés, image de couverture, **byes** et **poules**

**Contexte.** Le format « 2 ou 4 joueurs, puissance de 2 » était trop rigide. On l'ouvre :
- **Capacité 6 à 64**, **privés** (sur invitation), **image de couverture** (`0cf8bb7`, `4ab8624`).
- Les UIs de tournoi passent en **cases carrées** avec visuel (`TournamentCup`).

**Le vrai morceau technique.** Accepter une capacité **non puissance de 2** oblige à gérer les
**byes** : `generateBracket` calcule la taille de bracket comme la puissance de 2 supérieure, ordonne
les joueurs par **seeding canonique** (1 vs dernier…) pour que les byes tombent face aux têtes de
série, qui passent le 1er tour d'office. Puis le format **poules** (`add_tournament_format_pools`,
`0cf8bb7`) : poules de 4 en round-robin, qualification du top 2 par poule avec seeding croisé pour le
bracket final. Le nombre de rounds est recalculé **sur les matchs réels** (byes + poules font diverger
taille de bracket et capacité). Ces fonctions pures sont **testées** (`tournament.test.ts`).

**Leçon.** Dès qu'on quitte la puissance de 2, le bracket cesse d'être « évident » — d'où l'extraction
de la logique dans `tournament.ts` et sa couverture par des tests unitaires.

### 6.2 Comptes hors-jeu non ciblables

**Symptôme.** Un compte banni / en suppression / anonymisé restait ciblable (OPS, tournoi, suivi) et
apparaissait par endroits. **Fix** (`20d6ad3`, `0cf8bb7`) : un prédicat unique `VISIBLE_USER_WHERE` +
`assertTargetable` ferme partout les vues publiques et les actions à ces comptes ; supprimer son compte
purge aussi ses tournois et annule ses défis.

### 6.3 Refonte OPS — « la chasse » 24 h + matchs forcés

**Contexte** (`4677426`, `add_ops_forced_used`). L'OPS devient une **traque** : 24 h (au lieu de 7 j),
pendant lesquelles la cible doit affronter le traqueur. Ses **3 premiers refus** coûtent **3× la perte
d'ELO** d'une défaite estimée (au lieu du dodge −10) ; le quota est suivi par `forcedUsed`. Révélation
**cinématique** côté front (`OpsRevealOverlay`). Constantes partagées dans `@42-league/shared`.

### 6.4 Head-to-Head (`/h2h`)

`4ab8624` : une page de **confrontation directe** entre deux joueurs (bilan des duels, historique).

### 6.5 La trilogie communautaire C1 / C2 / C3

- **C1 — Notifications in-app** (`d787bd2`). Modèle `Notification`, cloche `NotificationBell`, signal
  SSE `notification` (best-effort : une notif ratée ne casse jamais l'action métier).
- **C2 — Badges** (`88b2124`). Catalogue front (`lib/badges.ts`), badges **dérivés du rôle**
  (founder/admin/superadmin) + **gagnés** (`UserBadge` : `beta_tester`, `season_champion`), rendu animé.
- **C3 — Suivi** (`0876ae5`). `Follow` + **préférences de notif par personne suivie**
  (tournoi / top 3 / trophée / OPS) ; `notifyFollowers` n'alerte que selon ces préférences, et le top 3
  ne notifie qu'à la **transition** (entrée dans le top 3).

### 6.6 Phase D — Saisons & reset ELO

**Contexte** (`08dd246`, `add_seasons`). Le classement devient cyclique : `Season` (une active),
chaque `PlayedMatch` taggé `seasonId`. **Clôturer** une saison fige le classement (`SeasonStanding`),
donne le badge **champion** au 1er, puis **remet toute la ligue à 1000 ELO** — l'historique est
conservé. Le **palmarès** (`/me`, `/users/:login`) agrège ces classements ; sélecteur de saison côté
front (desktop **et** mobile, `de301b0`). Migration : « Saison Bêta » rétro-rattachée à l'historique.

### 6.7 GOD panel : sudo, confirmations, sélection multi-lignes, All History

`3ffb3dc`, `c290295`, `1519b6e`, `de301b0` : l'onglet **All History** unifie défis / matchs / rejets /
OPS (filtrable), avec **édition/suppression inline** (nouvelles actions d'audit `DELETE_*`) et
**sélection multi-lignes** pour agir en masse. Les actions destructrices passent par un **mode sudo** +
des **confirmations soignées**. C'est, encore, la leçon de 4.1/5.5 : rendre le destructeur difficile à
déclencher par accident.

### 6.8 Sécu — token SSE éphémère & open access

- **Token de stream éphémère** (`4fa4c1b`). On cessait d'exposer le **Bearer 30 j en query string**
  pour ouvrir le flux SSE (il fuit dans les logs / le `Referer`). Désormais : `GET /auth/stream-token`
  → token **scope `sse`, TTL 60 s**, redemandé à chaque (re)connexion ; refusé sur toute route mutante.
- **Suppression de la whitelist** (`7e0b5dd`). Passage en **open access** : tout login 42 valide est
  admis (`whitelist.ts` supprimé), le contrôle de privilèges reposant entièrement sur les rôles.
- **Audit sécurité quotidien consolidé** (`c3454c7`) : un rapport unique sur Discord (tests + npm audit
  + sondes live + alertes CodeQL), et CI sur runtime **Node 24** (`ef23e90`).

---

## Phase 7 — Multi-disciplines : la ligue n'est plus que du babyfoot (31 mai–2 juin)

Le produit était mono-jeu. À partir du 31 mai au matin, la ligue s'ouvre à **plusieurs
disciplines** — chacune avec son **classement ELO parallèle**, ses persos, son format de score.
C'est le chantier qui a le plus structuré (et fragilisé) le back : ce qui était implicitement
« babyfoot » devait devenir **agnostique au jeu**.

### 7.1 Smash, puis Échecs : le mode babyfoot qui contamine tout

**Contexte.** `Add: mode Smash Bros` (a59dda7) puis `Add: mode Échecs` (f2ddc2d) : classements
parallèles, persos & sets Bo3/Bo5 (vies) pour le Smash, thème par jeu. Chaque discipline a ses
**colonnes ELO/compteurs** propres (`elo_smash`, `matches_played_smash`…).

**Symptôme révélateur** (`Add: mode Échecs… + fix le graphe ELO`, e81a7cc puis 9732b73). Le mode
Échecs renvoyait les **données babyfoot** : un `?game=` manquant dans plusieurs requêtes faisait
retomber le serveur sur la discipline par défaut. Le GOD panel a dû devenir **multi-mode granulaire**
pour confirmer l'**indépendance réelle** des classements.

### 7.2 ⭐ Le « 10-0 aux échecs » : le score qui ne respectait pas sa discipline

**Symptôme.** Une partie d'échecs s'affichait **10-0**. Aux échecs on gagne **1-0**, pas 10-0.

**Cause détaillée** (`fix(games): saisie & affichage des matchs agnostiques au jeu`, 1d29e3f). Le flux
« défier un joueur » (`RecordResultForm`) enregistrait **tous** les résultats au format babyfoot
(10-x) **sans envoyer la discipline**. Le backend stockait alors le match sous `game: ch.game` (donc
échecs) mais avec un **score babyfoot**. Pire : l'affichage déterminait le vainqueur par « score = 10 »
— faux pour un 1-0 (échecs) ou un 2-1 (smash).

**Le fix, en deux couches :**
- **Backend, autorité de vérité** : `/challenges/:id/record` **revalide** le résultat contre la
  discipline **réelle du défi** (`ch.game`), pas le `game` envoyé par le client. Un défi d'échecs ne
  peut plus être stocké avec un score babyfoot.
- **Front, game-aware** : `RecordResultForm` adapte la saisie (échecs en 1-0, smash redirigé vers
  « Déclarer une partie »), et le vainqueur est déterminé par **comparaison de scores**, plus par une
  égalité magique à 10.

**Leçon.** Le client ne doit jamais être la source de vérité du **type** d'un objet métier : le
backend doit revalider contre l'état qu'il possède déjà. Écho direct à l'anti-escalation (4.1).

### 7.3 La dette de tous ces ternaires → un Game Registry

**Problème.** Avec 3 jeux, le back était truffé de `isSmash ? … : isChess ? …` éparpillés
(leaderboard, clôture de saison, settlement ELO, crédit des titres). Ajouter une 4ᵉ discipline aurait
voulu dire **rouvrir tous ces sites**.

**Le fix** (`refactor(games): centralise la logique multi-jeux dans un Game Registry`, 0868d15). Un
**registry partagé unique** (`packages/shared/src/games.ts`) + un **pont Prisma**
(`apps/backend/src/games.ts`) qui isole les colonnes par-jeu. Comportement **strictement identique**
(shared 214 + backend 177 tests verts), mais **ajouter une discipline = une entrée de config**. C'est
ce qui a rendu les phases suivantes (Street Fighter, fléchettes) rapides. Détail dans
[DOMAIN.md](./DOMAIN.md) §12.

### 7.4 Street Fighter : une discipline « presque gratuite »

**Contexte.** `feat(streetfighter): nouvelle discipline` (bb9dda9). Grâce au registry (7.3), SF
**réutilise** la mécanique Smash (`calculateSmashElo`, sets Bo3/Bo5, persos) : il « suffit » d'ajouter
l'entrée de jeu, les colonnes `elo_sf`/`matches_played_sf` (migration additive), le roster (40 puis 80
persos, portraits locaux, fallback pastille) et le branding. La preuve que le refacto 7.3 a payé.

### 7.5 Babyfoot 2v2 : le carry et l'ELO d'équipe

**Contexte.** `feat(babyfoot): mode 2v2 complet` (f9838c0). Un duo n'est pas la somme de deux solos —
il fallait un **ELO d'équipe** (`BabyfootTeam`, duo canonique, ELO pondéré 65/35) **et** un report
individuel **anti-carry** : `calculateIndividualEloIn2v2` (« Calcul B ») évite qu'un joueur faible
monte uniquement en étant porté par un fort. Validation **obligatoire des 3 non-déclarants** avant le
settlement ELO (8714951) — comme en 1v1, on ne crédite pas sur la seule parole du déclarant. Page
`/team/:id`, trophées de duo (« Le Plus Gros Carry », « Duo de Choc »). Schéma + migration
`add_babyfoot_2v2`.

### 7.6 Fléchettes : un ELO multijoueur (pas un duel)

**Contexte.** `feat(flechettes): nouveau mode multijoueur 301/501 (2-8 joueurs)` (a118fbb). Rupture :
les fléchettes ne sont **pas** un 1v1. `calculateDartsElo` pondère **par points restants** (moitié
haute gagne, moitié basse perd, milieu neutre). **Pas de tournoi fléchettes** (multijoueur incompatible
avec un bracket binaire). Les fléchettes **réutilisent les tables FFA** existantes (Smash multijoueur) +
`startScore`/`remaining`.

**Le piège qui en a découlé** (`fix: séparation FFA Smash/fléchettes`, 78d2272 & 043217f). Réutiliser
les tables FFA signifiait que les **manches de fléchettes remontaient dans les listes FFA Smash**, et
inversement. Fix : un **filtre `game`** systématique partout (listes, stats, standings de saison).
Idem `bcc2578` : les **standings de fin de saison** ne savaient afficher ni Street Fighter ni les
fléchettes — il manquait simplement les 2 disciplines récentes dans l'itération sur les 5 jeux.

**Leçon.** Partager une table physique entre deux concepts métier est économique mais **dangereux** :
sans clé de discrimination (`game`) appliquée **partout**, les vues fuient l'une dans l'autre.

### 7.7 Cloisonnement par discipline (badges, fiches, trophées)

Plusieurs fixes pour que rien ne « bave » d'un jeu à l'autre : badges de palmarès **cloisonnés par
discipline** (9eb75b8), fiche d'un autre joueur **isolée par discipline** (785847d), saisie de score de
tournoi **par jeu** (échecs/smash/babyfoot, 6b49c5a). Le multi-jeux force à se demander, partout :
« de quelle discipline parle-t-on ici ? ».

---

## Phase 8 — Économie de League Coin, quêtes & paris (2–6 juin)

Une fois plusieurs disciplines en place, on attaque l'**engagement par l'économie** : une monnaie
virtuelle, des moyens de la **gagner**, et un marché de **paris**.

### 8.1 League Coin : d'abord une boutique, sans encore de gains

**Contexte.** `feat(shop): boutique League Coin` (1d462f4). On pose la **monnaie** (`User.leagueCoins`),
les modèles `ShopItem` + `ShopInventory`, l'onglet Boutique, et un **back-office Shop GOD** (admins) pour
créer des cosmétiques et **donner des coins**. À ce stade, **aucun gain automatique** : seul un admin
peut créditer (un encart « Bientôt » annonce les gains à venir). Voir [DOMAIN.md](./DOMAIN.md) §13.

### 8.2 Gains de match & quêtes hebdo : le volet « earn »

**Contexte.** `feat(coins): gains de match, quêtes hebdo et paris (backend)` (f3d897b). Trois volets
d'un coup :
- **Volet A — gains de match** : **+20 joué / +50 victoire** crédités au **règlement** de chaque match
  **classé** (1v1, 2v2, FFA, fléchettes), **jamais** sur un dodge / un match forcé / non-classé.
- **Volet B — quêtes hebdo** : `WeeklyQuestProgress`, `GET /quests` + `POST /quests/:id/claim`, 4 quêtes
  réinitialisées par **semaine ISO**, **anti double-claim** verrouillé.
- **Volet C — paris** : `Bet`, cote fixe **x2**, règlement auto à la confirmation, remboursement à
  l'annulation.

Le front suit avec les **onglets Quêtes & Paris** du profil (7649f42) et l'animation « +N » au gain
(57807c3).

### 8.3 ⭐ L'intégrité de l'économie : farming de coins & paris sur soi-même

**Symptôme (audit, cf. Phase 10.4).** L'audit cyber a montré que l'économie était **exploitable** :
- deux comptes complices pouvaient **farmer des coins** (et valider des quêtes) en jouant en boucle ;
- on pouvait **parier sur un tournoi où l'on joue**, voire sur soi-même.

**Le fix** (`fix(security): corrige les failles de l'audit cyber`, bceb30a). L'**anti-farming**
(déjà appliqué à l'ELO depuis 3.2) est **étendu aux coins ET aux quêtes** (1v1 + 2v2) : un match qui ne
compte pas pour l'ELO ne crédite **ni coin ni progression de quête**. Et on **interdit de parier sur un
tournoi où l'on joue**.

**Leçon.** Une monnaie crée une **incitation** ; dès qu'on récompense un comportement, il faut se
demander **comment on le triche**. L'anti-farming, conçu pour l'ELO, devient une primitive
**transverse** à toute la couche « récompense ».

### 8.4 Les paris : du « par match » au « vainqueur du tournoi », et le verrou

**Problème.** Les premiers paris portaient **match par match**. Deux ennuis : (a) on pouvait parier
pendant la **phase d'inscription** (avant que le bracket soit figé), et (b) un pari par match ouvre la
porte à des **scores divulgués** (on parie en connaissant déjà l'issue).

**Le fix, en plusieurs passes :**
- `feat(bets): paris limités au tournoi EN COURS + verrou à la pose` (23f20cf) : `GET /bets` & `POST
  /bets` n'ouvrent plus les paris que sur les tournois `in_progress` ; le pari est **verrouillé dès la
  pose** (aucun endpoint de modification, garde anti-doublon).
- `feat(paris): pari unique sur le vainqueur du tournoi (fin des paris par match)` (81413c8) puis
  b9b7c75 : on **abandonne les paris par match** au profit d'**un seul pari sur le vainqueur du
  tournoi**, ouvert **avant le 1er résultat seulement**.
- Verrou permanent côté DB : `betsLockedAt` (migration `tournament_bets_lock`, bceb30a) — **le marché
  ne se rouvre plus** une fois qu'un score a été divulgué.

**Le bug d'argent qu'on a failli laisser passer** (`fix(coins): rembourse les paris ouverts sur les
suppressions de tournoi en masse`, 434ae8a). Les chemins de **suppression groupée** (ban /
anonymisation / suppression de compte, suppression d'un faux joueur, reset total de la base) effaçaient
les paris **par cascade SQL** sans **rendre la mise** : des coins disparaissaient dans le vide. Helper
`refundBetsTx` généralisé, remboursement **avant** chaque cascade delete. Cas typique « la suppression
en cascade oublie les effets de bord métier ».

### 8.5 Grades Grand Master : un grade **positionnel**, hors barème

**Problème.** Les grades (Étain → Diamant) sont des **paliers d'ELO**. Mais on voulait un grade
d'**élite** qui ne soit pas qu'« avoir beaucoup d'ELO » : être **dans le top**.

**Le fix** (`feat(grades): grade Grand Master pour le top 5`, 719c718 puis cce15a2). **Grand Master**
est **positionnel** (hors barème) : attribué au **top N** (5) de **chaque discipline**.
`rankTierForRank(elo, rank)` renvoie GM si `1 ≤ rank ≤ 5`, sinon le palier d'ELO. `RankBadge` gagne une
prop `rank` optionnelle (couronne violette). Branché sur les profils, puis sur les **lignes de
classement** (923158b) — qui en a profité pour remplacer l'**auto-scroll au montage** par un bouton
**« Où suis-je ? »** à la demande (le scroll automatique surprenait l'utilisateur). Voir
[DOMAIN.md](./DOMAIN.md) §2 bis.

### 8.6 G.O.A.T : scope saison et vue nuage

**Contexte.** `feat(leaderboard): G.O.A.T en 3e vue` (dd4a09e), `feat(goat): scope saison` (bd151a8),
`nuage + g.o.a.t sur les saisons passées` (2014ae3). Le G.O.A.T (greatest of all time) devient une
**3ᵉ vue** du classement (liste / nuage / G.O.A.T) et accepte un **classement scopé à la saison** : les
saisons passées recalculent nuage + G.O.A.T **depuis les matchs taggés** `seasonId`.

**Perf au passage.** Le recalcul des stats du leaderboard à **chaque navigation** était coûteux : extrait
dans une fonction **à cache module** (`computeLeaderboardStats`) → instantané au remontage. Le bouton
**« Où suis-je ? »** fonctionne dans les **3 vues** (commande impérative `locateMe` du nuage). G.O.A.T
**masqué pour la BETA** tant que le volume de données est faible.

---

## Phase 9 — Refonte des tournois : cinématique et lisibilité (5–6 juin)

Les tournois marchaient mais l'expérience était frustrante. Trois douleurs : la page **rechargeait
tout** au moindre clic, le **pile-ou-face** était minuscule et coupé, et on ne savait pas **quel match
jouer maintenant**.

### 9.1 ⭐ La page détail qui « rechargeait » tout l'écran

**Symptôme.** Au moindre clic (toss, avantage, score, invite, join, start) **et** à chaque refresh SSE
ou retour de focus, la page tournoi **rechargeait en entier** (skeleton plein écran). Pire : l'animation
de pile-ou-face en cours était **démontée** → on « sortait » de l'animation.

**Cause & fix** (`fix(tournois): la page détail ne recharge plus tout l'écran`, a343f8c). Le `load()`
repassait **systématiquement** par `setLoading(true)`. Fix : `load(silent)` — le skeleton n'apparaît
plus qu'au **1er chargement** / changement de tournoi ; les refresh de fond (SSE, `runAction`,
`onChange` des matchs) **swappent les données en place**. C'est ce fix qui a **rendu possible** la
cinématique de la 9.2 (sans lui, l'animation se faisait démonter à chaque tick).

### 9.2 Le pile-ou-face en cinématique plein écran (et juste pour désigner le gagnant)

**Symptôme.** Le lancer de pièce s'affichait **inline** dans la petite carte du match, coupé dès qu'on
« sortait ».

**Le fix** (`feat(tournois): pile-ou-face en cinématique plein écran`, c66c07a). Nouveau
`CoinFlipOverlay` : la pièce s'affiche **en grand, centrée**, et reste pendant la rotation **puis**
l'annonce du gagnant (~2 s, `b2c6aa1`) avant de laisser place à la suite. Couplé au refresh silencieux
de 9.1, l'animation n'est **plus interrompue**.

**Décision produit.** `feat(tournois): retire le choix d'avantage` (ec2e277) : l'avantage se règle
**IRL** (qui commence, etc.) ; le pile-ou-face ne sert plus qu'à **désigner le gagnant** d'un amical
arbitré. On **simplifie** le flux plutôt que d'empiler des écrans. L'organisateur d'un **amical** (et les
admins) peut **officier** : lancer la pièce et saisir un **score d'autorité** sans jouer (b9b7c75).

### 9.3 `activeMatchId` : « le match en cours », désigné par l'organisateur

**Problème.** Dans un bracket, rien n'indiquait **quel duel** se joue **maintenant** — chaque
spectateur voyait le bracket « à plat ».

**Le fix** (`feat(tournois): match « en cours » désigné par l'organisateur`, 7dd1bd9 + animations
a374df9). Un pointeur **`activeMatchId`** sur le tournoi + `POST
/tournaments/:id/matches/:matchId/announce` (organisateur/admin, hors échecs). Désigner un match
déclenche, **chez tous les spectateurs** (via SSE), un **écran VERSUS** plein écran (2 photos) et un
badge **« EN COURS »** sur le duel dans l'arbre. Le pointeur est **effacé à la confirmation**. S'ajoutent
le **tirage au sort animé** (chaque duel se place tour à tour) et l'**avancée du bracket** (le perdant
grisé, l'avatar du vainqueur « monte » l'arbre).

### 9.4 Capacités puissances de 2 & byes : la complexité qu'on a fini par trancher

**Rappel.** En Phase 6.1, on avait ouvert les capacités **6–64** avec gestion des **byes** (joueur exempt
au 1er tour quand la capacité n'est pas une puissance de 2) et des **poules**. C'était puissant mais
source d'edge-cases (taille de bracket ≠ capacité, rounds recalculés sur les matchs réels).

**La décision** (`feat(tournois): capacites en puissances de 2 uniquement (8/16/32)`, 87b7a67). On
**re-restreint** aux **puissances de 2** : le bracket est **toujours plein**, **jamais** de joueur
exempt au 1er tour. `CreateTournamentSchema` (et `AdminUpdateTournamentSchema` côté god) **imposent** une
puissance de 2 (min 8) ; l'UI ne propose que **8/16/32**.

**Leçon.** On avait généralisé (byes/poules) pour la flexibilité ; à l'usage, la **simplicité** (bracket
plein) valait mieux que de gérer tous les cas limites. Revenir en arrière sur une feature est une
décision **valide** — d'autant que la logique reste **testée** (`tournament.test.ts`). Au passage,
`fix(tournois): retire bracketRounds mort du destructuring` (d874267) nettoie un reliquat de cette
généralisation qui cassait le build `tsc -b`.

---

## Phase 10 — God, staging & durcissement (5–6 juin)

Le déploiement bascule sur un vrai **environnement de staging** (`develop` → staging, `main` → prod ;
cf. [GUIDE-GIT.md](./GUIDE-GIT.md)). Cette phase concentre l'**outillage admin**, un **audit cyber**, et
une série de **galères d'infra** très « Phase 2 ».

### 10.1 Panneau god des tournois : forcer l'avancement

**Contexte.** `feat(god/tournois): panneau de gestion par tournoi` (b45ec09, 06f964a, f892b34, 62b91ab).
Deux endpoints admin : **`force-accept`** (forcer une invitation en attente) et **`force-result`**
(valider/forcer un match). Point clé : la **propagation est partagée** avec la confirmation normale
(poules → bracket → finale → récompense → **paris**) — on ne **duplique pas** la logique métier, on
**réutilise** le même chemin de settlement. C'est ce qui évite qu'un match forcé oublie de créditer une
récompense ou de régler un pari. Voir [DOMAIN.md](./DOMAIN.md) §6.

### 10.2 Synchro ELO prod → staging (en lecture seule)

**Problème.** Sur **staging**, on veut des **vraies courbes ELO** pour tester (nuage, GOAT, grades) sans
recopier toute la prod ni risquer d'**écraser** des données sensibles.

**Le fix** (`feat(god): synchro ELO/stats prod → staging`, ccd206f). Bouton GOD › Saisons (**staging
only**, superadmin) qui recopie ELO + compteurs depuis la **DB de prod en LECTURE SEULE**
(`PROD_READONLY_URL`, rôle **SELECT-only**). N'écrase **que** l'ELO/compteurs par discipline —
**jamais** les rôles, permissions, League Coins ni l'historique. Comptes de test staging **préservés** ;
comptes prod absents **créés en identité minimale** (USER). Endpoint `POST
/admin/seasons/sync-elo-from-prod` **fail-secure sur `APP_ENV`** (ne tourne qu'en staging), action
d'audit `SYNC_ELO_FROM_PROD`. Encore la règle de 4.1 : un outil puissant, **gated** par l'environnement.

### 10.3 TesterSwitch : tester « en mode user » sans se déloguer

**Contexte.** `feat(staging): bouton « Tester en mode user »` (df4216f, f0288f3). Un admin voit tout en
god — du coup il ne voit **jamais** l'app comme un simple user. Le **TesterSwitch** permet d'**impersonner
le compte tester** (staging, admins), **réservé à throbert/jagharra**, abidaux reconnu **founder**.
Quelques fixes de **positionnement** du bouton (chevauchement bas-gauche : 891a693, ad1a2c3, cd0260e) —
détail UI mais récurrent.

### 10.4 L'audit cyber : 16 failles, toutes corrigées

**Contexte.** `fix(security): corrige les failles de l'audit cyber` (bceb30a), documenté dans
[AUDIT_CYBER_2026-06-05.md](./AUDIT_CYBER_2026-06-05.md). Audit **multi-agents (8 zones)** avec
**vérification adversariale** : **16 failles confirmées** sur 24 remontées. La seule **high** : le flux
**SSE `/events` sans plafond** (un compte peut accumuler des milliers de streams et saturer le pool).

**Corrections principales :**
- **SSE** : plafond de **5 flux/login** (admins illimités) ; **body-limit 1 Mo** global (admins
  exemptés).
- **Sur-exposition de PII** : les routes publiques (`/users`, `/leaderboard`) renvoyaient l'objet `User`
  **brut** (avec `ftId`, `moderatorPermissions`, horodatages RGPD). `toPublicUser` les **retire** + `take
  1000` ; comptes bannis/anonymisés en **404** (sauf admin).
- **Économie** (cf. 8.3) : anti-farming sur coins **et** quêtes, interdiction de parier sur un tournoi où
  l'on joue, **verrou de marché** `betsLockedAt`.
- **Backdoor** `x-dev-login` **neutralisée en dur en prod** (`NODE_ENV !== 'production'`).
- **Infra** : CSP Caddy (`connect-src 'self'` bloque l'exfil du token), **anti-spoof
  `X-Forwarded-For`** (`header_up {remote_host}` — sans ça, un client falsifie son IP et annule tout le
  rate-limit), Postgres avec mot de passe paramétrable, port dev en **loopback**, **`USER node`**
  (non-root) dans le Dockerfile backend, token OAuth d'extension lu dans le **fragment** (`#`) plutôt que
  la query string.

Les **admins sont exemptés** des garde-fous anti-abus (rate-limit / body-limit / plafond SSE) pour
pouvoir **tester** librement (7b53464, 7353c92). Tout est ajouté à la mémoire de sécurité
([security-patches.md](./security-patches.md)).

### 10.5 ⭐ Le boot staging cassé par un import jamais commité

**Symptôme — 502 sur `staging.42league.fr`.** Le backend staging **bouclait en crash**.

**Cause** (`fix(backend): commit contributor-stats manquant`, aec39eb). `index.ts:82` importait
`./contributor-stats.js`, mais **le fichier n'avait jamais été commité** → `ERR_MODULE_NOT_FOUND` au
démarrage → boucle de crash. Le module étant **autonome** (repli env puis stats vides), le **simple
ajout du fichier** restaure le boot.

**Leçon.** Un import vers un fichier **non versionné** marche en local (le fichier est là) et casse
partout ailleurs — variante directe du fil rouge « l'environnement de dev ≠ l'environnement cible ». Le
typecheck ne l'attrape pas forcément si le fichier existe sur la machine du dev.

### 10.6 Les builds CI qui n'atteignaient plus Docker Hub

**Symptôme.** Les builds CI échouaient **en boucle** sur `node:20-alpine: dial tcp … i/o timeout` —
`registry-1.docker.io` **injoignable** depuis les runners (rate-limit / réseau). Le **deploy staging**
exige `build-backend` **ET** `build-frontend` en succès → **rien ne partait**.

**Le fix** (`fix(ci): images de base via miroir AWS ECR Public`, bd03eb2). Bascule des `FROM`
(`node:20-alpine`, `nginx:alpine`) vers **`public.ecr.aws/docker/library/*`** (miroir officiel Docker
Hub, sans rate-limit anonyme bloquant). Encore une fois, la **mise en prod** déborde de cas
d'infrastructure hors de notre code.

### 10.7 Build front : les classiques du strict-mode et des imports morts

Plusieurs `fix(build)` de cette période, tous dans la veine de la Phase 4.7 (« ça marche en dev ≠ ça
build en prod ») : `SortableTh` manquant qui cassait le tri des colonnes GOD (51b08f6), `bracketRounds`
mort dans un destructuring (d874267), variables/imports inutilisés sous `noUnusedLocals`. Et une optim
de bundle : `perf(build): isole react et framer-motion dans des chunks vendor` (cc539ba) — `vendor-react`
et `vendor-motion` séparés pour un cache long et un téléchargement parallèle.

---

## Fils rouges du projet (ce qui revient sans cesse)

1. **« L'environnement de dev ≠ l'environnement cible. »** WSL (0.1), conteneurs Docker (2.5),
   build sans `.git` (5.3), typecheck strict au build (4.7), **import vers un fichier jamais commité**
   (10.5), **registre Docker injoignable** en CI (10.6). À chaque fois, le code « marchait »
   quelque part et pas là où il fallait.

2. **Config en mémoire ≠ config sur disque.** Le 404 Caddy (2.5) en est l'archétype : recréer
   le processus, ne pas juste lui demander de relire.

3. **Tout raccourci / tout outil puissant doit être gardé par défaut.** La backdoor `x-dev-login`
   (4.1), la confirmation manuelle du reset ligue (5.5), la synchro ELO prod→staging **gated par
   `APP_ENV`** (10.2) et le TesterSwitch réservé (10.3) sont les facettes de la même règle.

4. **Un incident → un test.** Anti-farming (3.2), privacy SSE (3.4), anti-escalation (4.1) sont
   tous devenus des tests de la suite DB-free (4.3) ; toute logique non triviale (brackets/byes/poules
   en 6.1, multi-jeux/ELO en 7.3) est extraite en fonctions pures et testée (`tournament.test.ts`,
   `games.ts`). On corrige une fois, on régresse jamais.

5. **Le client n'est jamais la source de vérité du métier.** Le « 10-0 aux échecs » (7.2) : le
   backend revalide le **type** du match contre l'état qu'il possède, jamais contre le `game` envoyé.

6. **Une récompense crée une incitation à tricher.** Dès qu'on gagne des coins (8.2), il faut se
   demander comment on les farme : l'anti-farming devient transverse (coins + quêtes, 8.3), les paris
   se verrouillent (8.4), on n'autorise pas à parier sur soi-même (10.4).

7. **Généraliser puis re-trancher est valide.** On avait ouvert les tournois aux byes/poules (6.1)
   pour la flexibilité, on est revenu aux **puissances de 2** (9.4) parce que la simplicité valait mieux
   que tous les cas limites.

8. **Honnêteté sur l'inachevé.** Le harness d'intégration (4.4) est explicitement marqué
   « Phase 2 — incomplet » dans le commit et la doc, plutôt que maquillé en terminé.

---

> **Pour aller plus loin :** [POST_MORTEM_404_BUG.md](./POST_MORTEM_404_BUG.md) (l'incident en
> détail), [AUDIT_CYBER_2026-06-05.md](./AUDIT_CYBER_2026-06-05.md) (l'audit complet), et dans `DOC/`
> [security-patches.md](./security-patches.md) (mémoire de sécurité, patches numérotés)
> et [pending.md](./pending.md) (backlog). Index général : [README.md](./README.md).
