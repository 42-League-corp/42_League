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

L'endpoint `GET /events` (auth via `getStreamLogin` : cookie / Bearer / `?token=` / dev) :
1. enregistre la connexion ;
2. envoie un événement initial `connected` `{ login }` ;
3. envoie un `ping` keep-alive **toutes les 25 s** (data = timestamp) ;
4. nettoie le registre à l'abort/fermeture.

---

## 3. Deux stratégies d'émission

- **Ciblé** (`emit`) — dans les handlers, pour ce qui ne concerne que certains joueurs :
  `match:*`, `challenge:*`, `ops:update`.
- **Global** (`broadcast`) — pour ce qui est visible de tous. Deux mécanismes :
  - explicite dans un handler (ex. `leaderboard:update` après un match confirmé) ;
  - **middleware** `broadcastOnMutation` (`index.ts`) : après toute mutation 2xx sur un préfixe,
    diffuse un événement. Mappings : `/tournaments*` → `tournament:update` ; `/admin/*` → `data:update`.

---

## 4. Catalogue des événements

| Événement | Portée | Émis par | Payload |
|---|---|---|---|
| `connected` | self | ouverture `/events` | `{ login }` |
| `ping` | self | keep-alive 25 s | timestamp |
| `match:pending` | ciblé (adversaire) | `POST /matches` | `{ id, declarerLogin, scoreDeclarer, scoreOpponent }` |
| `match:confirmed` | ciblé (2 joueurs) | `POST /matches/:id/confirm` | `PlayedMatch` |
| `match:rejected` | ciblé (déclarant) | `POST /matches/:id/reject` | `{ id, contestReason, rejectedBy }` |
| `challenge:received` | ciblé (adversaire) | `POST /challenges` | `Challenge` |
| `challenge:accepted` | ciblé (challenger) | `POST /challenges/:id/accept` | `Challenge` |
| `challenge:declined` | ciblé (l'autre) | `POST /challenges/:id/decline` | `{ id, status, eloPenalty, declinedBy }` |
| `challenge:recorded` | ciblé (2 joueurs) | `POST /challenges/:id/record` | `{ pendingId }` |
| `ops:update` | ciblé (owner, target) | `POST /ops` + timers expiry/cooldown | `Ops` ou `{ reason }` |
| `leaderboard:update` | global | confirm match, dodge | `{}` |
| `tournament:update` | global | mutations `/tournaments*` | `{}` |
| `data:update` | global | mutations `/admin/*` | `{}` |

---

## 5. Côté client (`useLeagueData.tsx`)

Le front ouvre `EventSource` sur `GET /events?token=<token>` (le token passe en query car
`EventSource` ne peut pas envoyer d'en-tête `Authorization`).

À chaque événement, il **ne recharge pas tout** : il consulte le mapping `EVENT_DOMAINS` pour savoir
quels « domaines » de données sont impactés, les marque sales, et re-fetch **uniquement ces domaines**.

Mapping (domaines = tranches de `LeagueData`) :
| Événement | Domaines re-fetchés |
|---|---|
| `match:pending` / `match:rejected` | `matches` |
| `match:confirmed` | `matches`, `me` |
| `challenge:received/accepted/declined` | `challenges` |
| `challenge:recorded` | `matches`, `challenges` |
| `leaderboard:update` | `leaderboard` |
| `tournament:update` | `tournaments` |
| `ops:update` | `ops` |
| `data:update` | **tous** les domaines |

### Debounce
Les domaines sales s'accumulent dans un `Set`. Un timer de **250 ms** se réarme à chaque événement ;
au silence, un seul fetch groupé part. Cela absorbe les rafales (3 matchs confirmés coup sur coup =
1 seul refresh). Pas de spinner global : c'est un refresh partiel silencieux ; les échecs transitoires
sont ignorés.

---

## 6. Cas particulier — timers ops

Un ops n'a pas d'« événement déclencheur » à son expiration : c'est le **temps** qui passe. Le backend
arme donc des `setTimeout` (`scheduleOpsTimers`) qui émettent `ops:update` à l'expiration et à la fin
du cooldown. Ces timers sont **ré-armés au démarrage** du serveur (sinon un reboot les perdrait).
La lecture filtre toujours `expiresAt > now`, donc même si un timer était manqué, l'état affiché reste correct.
