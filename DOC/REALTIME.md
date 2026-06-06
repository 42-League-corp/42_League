# Temps réel (SSE) — 42 League

Comment le backend pousse les changements et comment le front réagit, sans WebSocket : tout passe
par **Server-Sent Events** (SSE). Fichiers : `apps/backend/src/sse.ts`, l'endpoint `GET /events`
(`index.ts`), et `apps/web/src/hooks/useLeagueData.tsx` côté front.

---

## 1. Pourquoi SSE (et pas WebSocket)

Besoin : « quand une donnée change, le client concerné rafraîchit cette donnée ». Unidirectionnel
(serveur → client), sur HTTP simple, reconnexion automatique native d'`EventSource`. SSE suffit et
évite l'infra WebSocket. Le client n'envoie jamais rien par ce canal — il ne fait que recevoir des
signaux et **re-fetch** via l'API REST classique.

---

## 2. Côté serveur (`sse.ts`)

Registre en mémoire : `Map<login, Set<flux SSE>>` (un même user peut avoir plusieurs onglets).

| Fonction | Rôle |
|---|---|
| `registerSse(login, stream)` | Enregistre une connexion, renvoie une fonction de cleanup (appelée à la déconnexion). |
| `emit(logins[], event)` | **Ciblé** : envoie l'événement aux connexions de ces logins. Ignore les flux morts. |
| `broadcast(event)` | **Global** : `emit` vers tous les logins connectés. |

Format d'un événement SSE : `{ event: <type>, data: JSON.stringify(payload) }`.

L'endpoint `GET /events` (auth via `getStreamLogin` : cookie / Bearer / `?token=` éphémère / dev) :
1. enregistre la connexion ;
2. envoie un événement initial `connected` `{ login }` ;
3. envoie un `ping` keep-alive **toutes les 25 s** (data = timestamp) ;
4. nettoie le registre à l'abort/fermeture.

> **Token de stream éphémère (sécu).** `EventSource` ne peut pas envoyer d'en-tête `Authorization`,
> donc le token passe en query (`?token=`) — où il peut fuiter (logs d'accès, header `Referer`).
> Plutôt que d'y mettre le Bearer 30 j, le front appelle d'abord `GET /auth/stream-token` (auth
> complète) qui renvoie un **token de scope `sse`, TTL 60 s**, redemandé à chaque (re)connexion.
> `verifyStreamToken` n'accepte que ce scope ; `verifyToken` (routes mutantes) le **refuse**
> explicitement — un token de stream qui fuite ne peut donc qu'ouvrir le flux en lecture.

---

## 3. Deux stratégies d'émission

- **Ciblé** (`emit`) — dans les handlers, pour ce qui ne concerne que certains joueurs :
  `match:*`, `challenge:*`, `ffa:*`, `darts:*`, `ops:update`, `notification`, `tournament:invite`,
  `tournament:invite_declined`, et les `panel:update` ciblés (gain de coins / résolution de pari).
- **Global** (`broadcast`) — pour ce qui est visible de tous. Deux mécanismes :
  - explicite dans un handler (ex. `leaderboard:update` après un match confirmé) ;
  - **middleware** `broadcastOnMutation` (`index.ts`) : après toute mutation 2xx sur un préfixe,
    diffuse un événement. Mappings : `/tournaments*` → `tournament:update` ; `/admin/*` → `data:update` ;
    `/matches*`, `/challenges*`, `/feature-requests*`, `/bug-reports*` → `panel:update`.

> **`panel:update`** est un signal **léger dédié au GOD panel**. Les mutations de matchs/défis/idées/bugs
> n'émettent qu'en **ciblé** (aux joueurs concernés) → un admin qui regarde le panel ne les verrait
> jamais. Ce broadcast comble le trou ; seul le front du panel l'écoute (les autres clients n'ont pas
> de listener pour ce type → l'event est ignoré, aucun re-fetch inutile). Le même type `panel:update`
> est aussi **émis en ciblé** (`emit([login], …)`) hors broadcast pour pousser un **rafraîchissement de
> solde** au gagnant d'un pari, au vainqueur récompensé d'un tournoi et aux parieurs remboursés.

> **Matchmaking : pas de SSE.** Le « match aléatoire » fonctionne par **polling** (`GET /queue/status`
> toutes les 2,5 s, cf. `useMatchmaking`). Quand deux joueurs sont appariés, le backend crée un duel et
> émet un `challenge:received` **ciblé** (pour rafraîchir la liste des défis) + une notif `matchmaking` ;
> il n'existe **pas** d'événement SSE `matchmaking`. L'overlay VERSUS est piloté par le résultat du poll.

---

## 4. Catalogue des événements

| Événement | Portée | Émis par | Payload |
|---|---|---|---|
| `connected` | self | ouverture `/events` | `{ login }` |
| `ping` | self | keep-alive 25 s | timestamp |
| `match:pending` | ciblé (adversaire) | `POST /matches` | `{ id, declarerLogin, scoreDeclarer, scoreOpponent }` |
| `match:confirmed` | ciblé (2 joueurs) | `POST /matches/:id/confirm` | `PlayedMatch` |
| `match:rejected` | ciblé (déclarant) | `POST /matches/:id/reject` | `{ id, contestReason, rejectedBy }` |
| `match:cancelled` | ciblé (adversaire / 2 joueurs) | `POST /matches/:id/cancel`, `DELETE /admin/pending-matches/:id` | `{ id, cancelledBy }` |
| `match:expired` | ciblé (joueurs, +coéquipiers en 2v2) | `POST /admin/matches/:id/force-cancel` + **purge quotidienne** des matchs en attente trop vieux | `{ id }` |
| `challenge:received` | ciblé (adversaire ; matchmaking : 2 joueurs) | `POST /challenges`, appariement `/queue/join` | `Challenge` ou `{}` |
| `challenge:accepted` | ciblé (challenger) | `POST /challenges/:id/accept` | `Challenge` |
| `challenge:declined` | ciblé (l'autre) | `POST /challenges/:id/decline` | `{ id, status, eloPenalty, declinedBy }` |
| `challenge:recorded` | ciblé (2 joueurs) | `POST /challenges/:id/record` | `{ pendingId }` |
| `ffa:pending` | ciblé (autres participants) | `POST /matches/ffa` | `{ id, declarerLogin }` |
| `ffa:progress` | ciblé (participants restants) | `POST /matches/ffa/:id/confirm` (confirmation partielle) | `{ id, confirmed, total }` |
| `ffa:confirmed` | ciblé (participants) | `POST /matches/ffa/:id/confirm` (dernière confirmation) | `PlayedFfa` |
| `ffa:contested` | ciblé (déclarant) | `POST /matches/ffa/:id/contest` | `{ id, contestedBy, claimedPosition, proposedPosition }` |
| `ffa:cancelled` | ciblé (participants) | `POST /matches/ffa/:id/contest` ou `/cancel` (incl. indispo) | `{ id, cancelledBy?, reason? }` |
| `darts:pending` / `darts:progress` / `darts:confirmed` / `darts:contested` / `darts:cancelled` | ciblé (participants) | `POST /matches/darts*` — **mêmes sémantiques que `ffa:*`** (modèle fléchettes) | idem `ffa:*` (`PlayedFfa` pour `confirmed`) |
| `ops:update` | ciblé (owner, target) | `POST /ops`, `DELETE /admin/ops/:id` + timers expiry/cooldown | `Ops` ou `{ reason }` |
| `tournament:invite` | ciblé (invité) | `POST /tournaments/:id/invite` | `{ tournamentId, inviteId }` |
| `tournament:invite_declined` | ciblé (organisateur/invitant) | `POST /tournaments/:id/invites/:inviteId/decline` | `{ tournamentId, inviteeLogin }` |
| `notification` | ciblé (destinataire(s)) | toute création de notif (`notify`/`notifyMany`) | `{}` (signal → re-fetch `/notifications`) |
| `leaderboard:update` | global | confirm match, dodge/OPS, clôture saison | `{}` |
| `tournament:update` | global | mutations `/tournaments*` (inclut le changement d'`activeMatchId`) | `{}` |
| `data:update` | global | mutations `/admin/*` | `{}` |
| `panel:update` | global (GOD panel) **ou** ciblé (solde) | mutations `/matches*`, `/challenges*`, `/feature-requests*`, `/bug-reports*` ; **ciblé** au gain de coins / résolution de pari (gagnant, parieurs, remboursés) | `{}` |

---

## 5. Côté client (`useLeagueData.tsx`)

Le front ouvre `EventSource` sur `GET /events?token=<token>` (le token passe en query car
`EventSource` ne peut pas envoyer d'en-tête `Authorization`).

À chaque événement, il **ne recharge pas tout** : il consulte le mapping `EVENT_DOMAINS` pour savoir
quels « domaines » de données sont impactés, les marque sales, et re-fetch **uniquement ces domaines**.

Mapping (domaines = tranches de `LeagueData`) :
| Événement | Domaines re-fetchés |
|---|---|
| `match:pending` / `match:rejected` / `match:cancelled` / `match:expired` | `matches` |
| `match:confirmed` | `matches`, `me` |
| `challenge:received/accepted/declined` | `challenges` |
| `challenge:recorded` | `matches`, `challenges` |
| `ffa:pending` / `ffa:progress` / `ffa:contested` / `ffa:cancelled` | `ffa` |
| `ffa:confirmed` | `ffa`, `matches`, `me`, `leaderboard` |
| `darts:pending` / `darts:progress` / `darts:contested` / `darts:cancelled` | `ffa` |
| `darts:confirmed` | `ffa`, `matches`, `me`, `leaderboard` |
| `leaderboard:update` | `leaderboard` |
| `tournament:update` | `tournaments` |
| `ops:update` | `ops` |
| `data:update` | **tous** les domaines |

> Le domaine **`ffa`** couvre à la fois le **FFA Smash** et les **manches de fléchettes** (même modèle
> de données) : son fetcher recharge `pendingFfas`/`playedFfas`/`pendingDarts`/`playedDarts`.

> Plusieurs types **ne sont pas** dans `EVENT_DOMAINS` (donc ignorés par `useLeagueData`) car consommés
> ailleurs par des `useServerEvents` locaux (cf. §6) : `notification` (cloche), `panel:update`
> (GOD panel), `tournament:invite` / `tournament:invite_declined` (page détail de tournoi), et les
> `*:contested` qui pilotent aussi l'overlay « rage ». La **balance de coins** suit le domaine `me`
> (rafraîchi par les events qui touchent `me` : `match:confirmed`, `ffa:confirmed`, `data:update`…) ;
> les `panel:update` ciblés « solde » ne déclenchent un re-fetch que sur les vues qui les écoutent.

### Debounce
Les domaines sales s'accumulent dans un `Set`. Un timer de **250 ms** se réarme à chaque événement ;
au silence, un seul fetch groupé part. Cela absorbe les rafales (3 matchs confirmés coup sur coup =
1 seul refresh). Pas de spinner global : c'est un refresh partiel silencieux ; les échecs transitoires
sont ignorés.

---

## 6. Consommateur alternatif — `useServerEvents` (`hooks/useServerEvents.ts`)

`useLeagueData` est le consommateur principal (état global de la ligue). Mais certaines vues ont leur
**propre state local** et ne veulent rafraîchir que sur un sous-ensemble d'événements — typiquement le
**GOD panel**, dont chaque onglet recharge ses données en silence.

```ts
useServerEvents(onEvent, types, { enabled?, debounceMs = 300 })
```
- Ouvre son propre `EventSource` sur `/events?token=...`, n'écoute que les `types` passés
  (ex. `['data:update', 'panel:update']`) et appelle `onEvent` **débouncé** (300 ms par défaut).
- Le callback est gardé dans une `ref` → changer son identité ne relance pas la connexion ; seuls
  `types`/`enabled` le font (clé stable `types.join(',')`).
- Reconnexion automatique d'`EventSource` ; cleanup complet au démontage.

### Consommateurs `useServerEvents` (hors `useLeagueData`)
| Vue / composant | Types écoutés | Effet |
|---|---|---|
| `NotificationBell` | `notification` | re-fetch `/notifications` (badge non-lues) |
| GOD panel (`GODPage`, chaque onglet) | `data:update`, `panel:update` (+ `tournament:update` pour l'onglet tournois) | rechargement silencieux de l'onglet |
| `TournoiDetailPage` | `tournament:update`, `tournament:invite`, `tournament:invite_declined` | refresh silencieux de la page détail (bracket, invitations, `activeMatchId`) **sans re-blanchir l'écran** ; un changement d'`activeMatchId` arme l'overlay VERSUS |
| `ContestRageOverlay` (monté dans l'`AppShell`) | `match:rejected`, `ffa:contested`, `darts:contested` | déclenche l'overlay « rage » côté **contesté** (le côté contesteur le déclenche localement depuis `lib/api.ts` via un `CustomEvent`, sans SSE) |

---

## 7. Cas particulier — timers ops

Un ops n'a pas d'« événement déclencheur » à son expiration : c'est le **temps** qui passe. Le backend
arme donc des `setTimeout` (`scheduleOpsTimers`) qui émettent `ops:update` à l'expiration (après **24 h**,
`OPS_DURATION_MS`) et à la fin du cooldown (7 j). Ces timers sont **ré-armés au démarrage** du serveur
(sinon un reboot les perdrait).
La lecture filtre toujours `expiresAt > now`, donc même si un timer était manqué, l'état affiché reste correct.
