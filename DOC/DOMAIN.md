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

Capacité **6 à 64 joueurs** (refonte mai 2026 ; plus besoin d'une puissance de 2 — les **byes**
sont gérés). `kind` `friendly` ou `official` (officiel réservé à `isAdmin`). Un tournoi peut être
**privé** (`isPrivate` : visible/rejoignable sur invitation uniquement) et porter une **image de
couverture** (`imageUrl`). États : `registration → in_progress → finished` (ou suppression directe).

**Deux formats** (`format`) :
- **`elimination`** — bracket à élimination directe. `generateBracket` ordonne les joueurs par
  seeding canonique (1 vs dernier…) et place les **byes** face aux têtes de série (qualifiées d'office
  au tour 2). Le nombre de rounds est calculé sur les matchs réels, pas la capacité.
- **`pools`** — phase de **poules de 4** (round-robin, répartition en serpent), réservée aux tournois
  de **≥ 12 joueurs**. Quand toutes les poules sont terminées, les **2 premiers de chaque poule**
  (tri victoires → diff. de buts → buts marqués) sont qualifiés et seedés en croisé pour le bracket
  final (deux qualifiés d'une même poule ne se recroisent pas avant la fin).

- Inscription via `join` ; auto-démarrage quand le tournoi est plein (génère bracket **ou** poules
  selon le format), ou `start` manuel par l'organisateur. Tournoi **privé** → pas d'inscription libre.
- L'**organisateur** (ou un `isAdmin`) peut **inviter** un joueur existant via `add-player` ;
  remplir la dernière place déclenche l'auto-démarrage.
- Chaque `TournamentMatch` se joue en **record → confirm** (confirmé par l'**autre** joueur). À la
  confirmation : un match de poule ne propage rien (déclenche le bracket une fois les poules finies) ;
  un match de bracket avance le vainqueur, et la finale clôt le tournoi (`winnerLogin`,
  `tournamentsWon++`). Génération/avancement/poules dans `apps/backend/src/tournament.ts` (testé,
  voir [TESTING.md](./TESTING.md)).

---

## 7. Ops (« la chasse »)

Mécanique sociale : un joueur (le **traqueur**) déclare un **ops** sur un autre (« je te tiens »).
Durée **24 h** (`OPS_DURATION_MS`, refonte mai 2026), puis **cooldown 7 jours** avant de pouvoir
redéclarer. Règles à la déclaration (`POST /ops`) : 1 seul ops actif par owner ; pas pendant le
cooldown ; cible non hors-jeu ; la cible ne doit pas déjà être engagée (en tant que cible ou owner).
Les transitions (expiration, fin de cooldown) sont pilotées par des `setTimeout` serveur, ré-armés
au démarrage (`scheduleOpsTimers`).

**Matchs forcés.** Pendant les 24 h, la cible doit affronter le traqueur : ses **3 premiers défis**
face à lui (`forcedUsed < OPS_FORCED_MATCHES = 3`) sont *forcés*. **Refuser** un match forcé coûte
**3× la perte d'ELO** d'une défaite estimée (`OPS_REFUSE_MULTIPLIER × estimatedEloLoss(cible, traqueur)`)
au lieu du dodge standard (−10), et incrémente `forcedUsed`. Jouer un match forcé l'incrémente aussi.
Une fois le quota épuisé, l'OPS n'impose plus rien jusqu'à expiration. Les constantes vivent dans
`@42-league/shared` (`elo.ts`), partagées front/back. Côté front, un **OpsRevealOverlay** met en scène
la révélation cinématique de la cible.

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
| `CreateTournamentSchema` | `{ name, capacity, kind, format, private, imageUrl? }` | name 2–60 ; capacity 6–64 ; kind défaut `friendly` ; format `elimination`\|`pools` (pools ⇒ capacity ≥ 12) ; imageUrl URL ≤500. |
| `TournamentRecordSchema` | `{ scoreA, scoreB }` | un camp = 10, pas les deux. |
| `SetTitleSchema` | `{ title }` | string trim ≤40, nullable. |
| `DeclareOpsSchema` | `{ targetLogin }` | login valide. |
| `FeatureRequestSchema` | `{ text }` | 10–500 car. |
| `SetRoleSchema` | `{ role }` | `USER\|ADMIN` (SUPERADMIN **interdit** par l'API). |
| `SetFeatureRequestStatusSchema` | `{ status }` | `pending\|accepted\|rejected`. |

Le package réexporte tout via `src/index.ts` (`export * from './elo.js' | './anti-farming.js' | './schemas.js'`).
`elo.ts` exporte aussi les constantes OPS (`OPS_DURATION_MS`, `OPS_FORCED_MATCHES`, `OPS_REFUSE_MULTIPLIER`)
et `estimatedEloLoss`. Schémas inline côté backend : `CreateSeasonSchema` (`{ name 2–40 }`),
`FollowPrefsSchema` (`{ notifyTournament?, notifyTop3?, notifyTrophy?, notifyOps? }`).

---

## 10. Badges & suivi (followers)

**Badges** (catalogue front `apps/web/src/lib/badges.ts`). Le backend renvoie une liste de **codes**
(`badgesFor`) ; le front résout libellé/couleur/icône. Deux origines :
- **Dérivés du runtime** (non stockés) : `founder` (login `throbert`), `superadmin`, `admin` (selon le rôle).
- **Gagnés** (table `UserBadge`) : `beta_tester` (inscrits de la saison bêta), `season_champion`
  (vainqueur d'une saison), etc. Un badge inconnu retombe sur un rendu générique.

**Suivi (followers/following).** Un joueur peut en suivre d'autres (`Follow`) et régler, **par
personne suivie**, quatre préférences de notification : `notifyTournament`, `notifyTop3`,
`notifyTrophy`, `notifyOps`. Les helpers `notifyFollowers` n'alertent que les abonnés ayant la
préférence active. L'entrée top 3 ne notifie qu'à la **transition** (un joueur qui *entre* dans le top 3).

## 11. Saisons, reset ELO & palmarès

Le classement est découpé en **saisons** (`Season` ; une seule active). Tout `PlayedMatch` est taggé
de sa `seasonId`. Le cycle est administré (`requireAdmin`) :
- **Créer** une saison (`POST /seasons`) — refusé s'il y en a déjà une active.
- **Clôturer** la saison active (`POST /seasons/close`) : on **fige** le classement final dans
  `SeasonStanding` (rang, ELO, W/L de chaque joueur visible), on octroie le badge `season_champion`
  au 1er, puis on **remet toute la ligue à 1000 ELO / 0 match joué**. L'historique des matchs est
  **conservé** (taggé par saison) — seules les notes repartent à zéro. Action **irréversible**.

Le **palmarès** d'un joueur (`palmaresFor`, exposé sur `/me` et `/users/:login`) agrège ses
`SeasonStanding` (classements finaux par saison, récents d'abord). La première saison est la
« Saison Bêta », créée par migration et rattachée à tout l'historique pré-existant.

---

## 12. Glossaire métier

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
- **Ops (la chasse)** — droit de traque temporaire (**24 h**) d'un joueur sur un autre, avec cooldown 7 j ;
  impose **3 matchs forcés** (refus = 3× la perte d'ELO estimée).
- **Tournoi officiel** — créable seulement par un membre de la liste `isAdmin`.
- **Tournoi privé** — visible et rejoignable uniquement sur invitation.
- **Format poules** — phase de poules de 4 (≥12 joueurs) → bracket des top 2 de chaque poule.
- **Bye** — place vide d'un bracket non-puissance-de-2 : la tête de série passe le 1er tour d'office.
- **Saison** — ère de classement ; sa clôture fige le palmarès et remet tous les ELO à 1000.
- **Palmarès** — classements finaux d'un joueur, saison par saison (`SeasonStanding`).
- **Badge** — distinction affichée sur le profil (rôle, fondateur, beta-tester, champion de saison…).
- **Suivi (follow)** — abonnement à un joueur, avec préférences de notification par personne suivie.
- **SUPERADMIN** — rôle hardcodé immuable, non attribuable par l'API.
- **Titre** — libellé cosmétique posé par un admin (≤40 car.).
