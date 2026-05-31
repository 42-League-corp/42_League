# Logique métier & concepts — 42 League

Tout ce qui fait « les règles du jeu » : ELO, anti-farming, cycle de vie d'un match, défis,
tournois, ops, rôles, et les schémas de validation partagés. Le code de référence vit dans
`packages/shared/src/` (importé sous `@42-league/shared` par le front **et** le back, en source,
sans build dédié).

---

## 1. Le score d'un match

Le babyfoot se joue en **10 buts**. Particularité : le perdant peut descendre **sous 0** à cause
des *gamelles* (auto-but qui retire un point). D'où :

- `MatchScoreSchema = z.number().int().min(-10).max(10)`.
- Un match valide a **exactement un camp à 10** (refine : `scoreSelf===10 || scoreOpponent===10`,
  et **pas les deux** : `!(scoreSelf===10 && scoreOpponent===10)`). Pas de match nul.
- Le score du perdant va donc de `-10` (10 gamelles) à `9` (10-9 serré).

---

## 2. ELO — `calculateBabyfootElo` (`elo.ts`)

ELO classique **adapté au babyfoot**, avec deux leviers : l'écart de **buts** module le transfert de
base, et l'écart de **rating** ajoute un bonus d'upset asymétrique et non saturant.

> ⚠️ **Refonte (mai 2026).** Le modèle n'est **plus à somme nulle** sur les gros upsets. L'ancienne
> version transférait `P` symétriquement (`+P` / `−P`) ; désormais, quand l'outsider gagne, le perdant
> surcoté encaisse tout le bonus tandis que le gagnant n'en touche qu'une part plafonnée.

### Constantes
- `DEFAULT_ELO = 1000` — note de départ de tout joueur.
- `K = 32` — facteur K de base.
- `UPSET_GAP_COEFF = 0.04` — bonus de points **par point d'écart de rating**, appliqué uniquement
  quand l'outsider l'emporte. Contrairement au facteur de surprise Elo `(1 − E)` qui sature vers
  ~800 pts d'écart, ce terme **ne sature pas** → un rating gonflé fond réellement vers la moyenne.
- `WINNER_BONUS_CAP = 50` — plafond du bonus d'upset encaissé par le **gagnant** (battre un seul boss
  gonflé ne doit pas faire exploser son rating).
- `MAX_DELTA_PER_MATCH = 400` — variation maximale (en magnitude) d'un joueur sur un seul match (garde-fou).

### Signature
```ts
calculateBabyfootElo(ratingA, ratingB, winner: 'A'|'B', scoreA, scoreB): {
  newA, newB, deltaA, deltaB
}
```

### Formule exacte
1. **Probabilité attendue** que le **gagnant** l'emporte :
   `E = 1 / (1 + 10^((ratingPerdant − ratingGagnant) / 400))`
2. **Multiplicateur d'écart de buts** :
   `goalDiff = 10 − scorePerdant` (1 pour un 10-9, jusqu'à 20 pour un 10‑(−10))
   `M = 1 + goalDiff × 0.1` → varie de **1.1** (10-9) à **3.0** (10‑(−10) gamelle totale)
3. **Transfert de base** (façon Elo classique, non arrondi) : `baseP = K × M × (1 − E)`
4. **Bonus d'upset** (proportionnel à l'écart RÉEL, upset uniquement) :
   `gap = max(0, ratingPerdant − ratingGagnant)` ; `gapBonus = gap × UPSET_GAP_COEFF`
5. **Application asymétrique**, bornée par `MAX_DELTA_PER_MATCH` :
   - `gain = round( min( baseP + min(gapBonus, WINNER_BONUS_CAP), 400 ) )` → `deltaGagnant = +gain`
   - `loss = round( min( baseP + gapBonus, 400 ) )` → `deltaPerdant = −loss`

### En clair
- **Résultat attendu** (favori qui gagne, ou ratings égaux) : `gap = 0` → bonus nul → transfert
  **symétrique classique** `±baseP` (identique à l'ancienne formule).
- **Upset** (outsider qui gagne) : le perdant gonflé **fond** (perte jusqu'à −400), le gagnant ne
  grimpe que modérément (bonus plafonné à +50 au-dessus du transfert de base). La somme n'est plus nulle.
- **Bonus de marge** : un 10-0 transfère plus qu'un 10-9 ; une gamelle (10‑(−10)) transfère le plus.

### Exemples (1000 vs 1000, donc `E = 0.5`, `gap = 0` → symétrique)
| Score | `M` | `±round(32·M·0.5)` |
|---|---|---|
| 10-9 | 1.1 | **±18** |
| 10-5 | 1.5 | **±24** |
| 10-0 | 2.0 | **±32** (= K) |
| 10‑(−10) | 3.0 | **±48** |

Gros upset (un joueur à **100** bat un joueur à **2800**, 10-0) : `E≈0`, `M=2.0` → `baseP≈64`,
`gap=2700` → `gapBonus=108`. Gagnant `+round(64+min(108,50))=+114`, perdant `−round(64+108)=−172`
(asymétrique : le rating gonflé fond). Si `gapBonus` dépasse 400, le perdant est plafonné à **−400**.

### Invariants verrouillés par les tests (`elo.test.ts`)
- Sur un résultat attendu / ratings égaux : `deltaA + deltaB === 0` (symétrie préservée).
- Deltas entiers ; bornés à `±400` ; aucun NaN/Infinity même pour des ratings 0–15000.

---

## 3. Anti-farming — `shouldCountForElo` (`anti-farming.ts`)

Empêche deux complices de farmer de l'ELO en jouant 50 fois.

- `ANTI_FARMING_WINDOW_DAYS = 7`
- `MAX_COUNTED_PER_PAIR_PER_WINDOW = 2`

```ts
shouldCountForElo(priors: {playedAt, countedForElo}[], newMatchAt): boolean
```
Compte les matchs **déjà comptés** (`countedForElo===true`) de la paire dans la fenêtre glissante
`[newMatchAt − 7j, newMatchAt[`. Retourne `true` si ce compte est `< 2`.

**Conséquence** : une paire peut faire bouger son ELO **au plus 2 fois par 7 jours glissants**.
Les matchs au-delà sont **enregistrés quand même** (`PlayedMatch.countedForElo = false`, deltas 0)
mais ne changent ni l'ELO ni `matchesPlayed`. La fenêtre étant glissante, le quota se rouvre dès
que le plus ancien match compté sort des 7 jours.

> Bornes (testées dans `anti-farming.test.ts`) : `playedAt >= windowStart` inclusif, `< newMatchAt`
> exclusif ; seuls les matchs `countedForElo===true` consomment le quota.

---

## 4. Cycle de vie d'un match

```
DÉCLARATION                CONFIRMATION (par l'adversaire)
PendingMatch  ──────────►  scores miroir ? ──┬── oui → PlayedMatch (+ ELO si compté)
(POST /matches)            (POST .../confirm) └── non → pending supprimé, 409 (à redéclarer)
       │
       └── REJET (POST .../reject) → RejectedMatch (litige tracé), pending supprimé
```

**Validation bilatérale** : le déclarant envoie `{scoreSelf, scoreOpponent}` de **son** point de vue ;
l'adversaire ressaisit `{scoreSelf, scoreOpponent}` du **sien**. La confirmation ne passe que si les
deux saisies sont le miroir l'une de l'autre — sinon le match est annulé (à redéclarer). C'est la
défense anti-spoofing de score (voir `security-patches.md` Patch 001).

---

## 5. Défis (challenges)

Un défi planifie une rencontre **avant** qu'elle ait lieu. États :
`pending → accepted → recorded` (chemin nominal) ou `declined` / `cancelled`.

- **decline** par le challenger = `cancelled` (aucune pénalité).
- **decline** par l'adversaire d'un défi `pending` = `declined` (aucune pénalité).
- **decline** par l'adversaire d'un défi **`accepted`** = **dodge** : `−10 ELO` + `dodgeCount++`.
- **record** (sur un défi `accepted`) crée un `PendingMatch` → on rejoint la confirmation bilatérale.

Le **dodge** matérialise le coût social de se désister après avoir dit oui.

---

## 6. Tournois

Bracket à élimination directe, capacité **2 ou 4** (puissance de 2). `kind` `friendly` ou `official`
(officiel réservé à `isAdmin`). États : `registration → in_progress → finished` (ou `cancelled`).

- Inscription via `join` ; auto-démarrage quand le bracket est plein, ou `start` manuel par l'organisateur.
- L'**organisateur** (ou un `isAdmin`) peut aussi **inviter** un joueur existant via `add-player` ;
  remplir la dernière place déclenche l'auto-démarrage.
- Chaque `TournamentMatch` se joue en **record → confirm** (confirmé par l'**autre** joueur, jamais
  celui qui a saisi). À la confirmation, le vainqueur avance ; la finale clôt le tournoi
  (`winnerLogin`, `tournamentsWon++`). Génération/avancement dans `apps/backend/src/tournament.ts`.

---

## 7. Ops (« droit de vantardise »)

Mécanique sociale : un joueur déclare un **ops** sur un autre (« je te tiens »). Durée **7 jours**,
puis **cooldown 7 jours** avant de pouvoir redéclarer. Règles à la déclaration (`POST /ops`) :
1 seul ops actif par owner ; pas pendant le cooldown ; la cible ne doit pas déjà être engagée
(en tant que cible ou owner). Les transitions (expiration, fin de cooldown) sont pilotées par des
`setTimeout` serveur, ré-armés au démarrage (`scheduleOpsTimers`).

---

## 8. Rôles & permissions

Deux notions d'« admin » **distinctes** (voir [SECURITY.md §8](./SECURITY.md)) :
1. **Rôle DB** `USER`/`ADMIN`/`SUPERADMIN` → accès GOD panel + modération. `SUPERADMIN` hardcodé,
   réimposé à chaque login, jamais attribuable par l'API (`SetRoleSchema` n'accepte que `USER`/`ADMIN`).
2. **Liste `isAdmin()`** (`admins.ts`) → autorise la création de tournois **officiels** et la pose de **titres**.

Un `bannedAt` non nul bloque la déclaration de match (`assertNotBanned`).

---

## 9. Schémas Zod partagés (`schemas.ts`)

Source de vérité de la validation, utilisée par le back (rejet 400) et le front (UX).

| Schéma | Forme | Contraintes clés |
|---|---|---|
| `LoginSchema` | string | 1–32 car., `^[a-z0-9_-]+$` (format login intra). |
| `MatchScoreSchema` | int | −10 … 10. |
| `DeclareMatchSchema` | `{ opponentLogin, scoreSelf, scoreOpponent }` | un camp = 10, pas les deux. |
| `ConfirmMatchSchema` | `{ scoreSelf, scoreOpponent }` | idem. |
| `RejectMatchSchema` | `{ contestReason, contestMessage }` | reason ∈ `never_played\|wrong_score` ; message 10–500. |
| `CreateChallengeSchema` | `{ opponentLogin, scheduledAt }` | ISO + offset ; futur (tolérance 60 s passé). |
| `RecordResultSchema` | `{ scoreSelf, scoreOpponent }` | un camp = 10, pas les deux. |
| `CreateTournamentSchema` | `{ name, capacity, kind }` | name 2–60 ; capacity ∈ `{2,4}` ; kind défaut `friendly`. |
| `TournamentRecordSchema` | `{ scoreA, scoreB }` | un camp = 10, pas les deux. |
| `SetTitleSchema` | `{ title }` | string trim ≤40, nullable. |
| `DeclareOpsSchema` | `{ targetLogin }` | login valide. |
| `FeatureRequestSchema` | `{ text }` | 10–500 car. |
| `SetRoleSchema` | `{ role }` | `USER\|ADMIN` (SUPERADMIN **interdit** par l'API). |
| `SetFeatureRequestStatusSchema` | `{ status }` | `pending\|accepted\|rejected`. |

Le package réexporte tout via `src/index.ts` (`export * from './elo.js' | './anti-farming.js' | './schemas.js'`).

---

## 10. Glossaire métier

- **ELO** — note de classement. Départ 1000. Évolue selon le résultat et la marge ; symétrique sur un
  résultat attendu, **asymétrique sur un upset** (le rating surcoté fond, bonus plafonné pour le gagnant).
- **Upset bonus** — bonus proportionnel et non saturant à l'écart de rating quand l'outsider gagne
  (`UPSET_GAP_COEFF`) ; plafonné à +50 côté gagnant, jusqu'à −400 côté perdant gonflé.
- **Gamelle** — auto-but ; fait descendre le score du fautif (jusqu'à −10), d'où le bonus de marge max.
- **Match pending** — déclaré, en attente de confirmation de l'adversaire.
- **Validation bilatérale** — l'adversaire ressaisit le score ; il doit être le miroir, sinon annulation.
- **Anti-farming** — plafond de 2 matchs comptés par paire et par 7 jours.
- **Défi (challenge)** — rencontre planifiée ; peut mener à un match.
- **Dodge** — se désister d'un défi déjà accepté ; pénalité −10 ELO + `dodgeCount++`.
- **Ops** — droit de vantardise temporaire (7 j) d'un joueur sur un autre, avec cooldown.
- **Tournoi officiel** — créable seulement par un membre de la liste `isAdmin`.
- **SUPERADMIN** — rôle hardcodé immuable, non attribuable par l'API.
- **Titre** — libellé cosmétique posé par un admin (≤40 car.).
