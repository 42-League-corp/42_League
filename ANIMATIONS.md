# Animations & cinématiques — registre

> **À LIRE par tout Claude (ou dev) qui ajoute/modifie une animation plein écran.**
>
> Le site a un **panneau de prévisualisation** dans `/GOD` → onglet **ANIMATIONS**
> (`apps/web/src/pages/GODPage.tsx`, composant `AnimationsTab`). Il permet à un
> superadmin de **déclencher manuellement** chaque cinématique avec des données
> d'exemple, sans avoir à reproduire la situation réelle (gagner un tournoi, être
> déclaré en OPS, enchaîner 6 victoires…).
>
> **RÈGLE : toute nouvelle animation plein écran DOIT être ajoutée à ce panneau.**
> Une animation qu'on ne peut pas prévisualiser est une animation qu'on ne peut pas
> tester ni montrer. Si tu en crées une (ou en trouves une non listée), branche-la.

## Comment ajouter une animation au panneau `/GOD`

Tout se passe dans `AnimationsTab` (`apps/web/src/pages/GODPage.tsx`). Deux familles :

### 1. Overlays déclenchés par un **store/fonction globale** (montés dans `AppShell`)
Ex : `fireContestRage(...)` (rage), `triggerDuelStrike({...})` (éclair de duel).
Ces overlays sont **déjà montés en permanence** dans `apps/web/src/shell/AppShell.tsx`.
Il suffit d'ajouter **un bouton** dans le tableau `items` qui appelle la fonction de
déclenchement — **rien à monter** dans l'onglet :

```ts
{ key: 'duel', label: 'Éclair de duel', desc: '…',
  onClick: () => triggerDuelStrike({ meLogin, opponentLogin: opp.login, game, kind: 'challenge' }) },
```

### 2. Overlays pilotés par **props** (`open` / `reward` / `signals` …)
Ex : `VictoryOverlay`, `PlayerReactionOverlay`, `MysteryRevealModal`,
`GlobalVersusOverlay`, `CoinFlipOverlay`, `TournamentLaunchCeremony`.
Il faut **un état local** + **un bouton** + **monter l'overlay** dans le `return` :

```ts
const [anim, setAnim] = useState<Anim>(null); // étends le type Anim avec ta clé
// …dans items :
{ key: 'victory', label: 'Champion (victoire)', desc: '…', onClick: () => setAnim('victory') },
// …dans le return, à la fin :
<VictoryOverlay open={anim === 'victory'} champion={meP} partner={opp}
  tournamentName="Tournoi de démonstration" accent={accent}
  onDone={() => setAnim(null)} t={t} />
```

Données d'exemple disponibles dans `AnimationsTab` : `meP`, `opp` (joueurs réels du
classement si dispo, sinon factices), `participants`, `pairings`, `accent`, `game`.

## Registre des animations du site

| Animation | Composant | Déclenchement réel | Dans `/GOD` ? |
|---|---|---|---|
| VERSUS matchmaking | `components/VersusOverlay.tsx` | trouvé un adversaire | ✅ `versus` |
| VERSUS tournoi | `components/tournois/VersusOverlay.tsx` | lancement d'un match de tournoi | ✅ `tversus` |
| Pile ou face | `components/tournois/CoinFlipOverlay.tsx` | tirage du serveur du match | ✅ `coin` |
| Cérémonie de lancement | `components/tournois/TournamentLaunchCeremony.tsx` | démarrage d'un tournoi | ✅ `ceremony` |
| Contestation (rage) | `lib/contestRage.ts` + overlay (AppShell) | un joueur conteste un score | ✅ `rage` |
| Éclair de duel | `components/DuelStrikeOverlay.tsx` (`triggerDuelStrike`) | lancer/accepter un duel | ✅ `duel` |
| Champion (victoire) | `components/tournois/VictoryOverlay.tsx` | victoire d'un tournoi (duo en 2v2) | ✅ `victory` |
| Réaction (meme) | `components/PlayerReactionOverlay.tsx` | série de victoires/défaites | ✅ `reaction` |
| Boîte mystère (gain/perte) | `components/shop/MysteryRevealModal.tsx` | achat d'une boîte mystère (1/10 gagne le titre, 9/10 −10 ELO) | ✅ `mystery-win` / `mystery-loss` |
| Transition de mode | cinématique au changement d'univers | changement de mode de jeu | ✅ `transition` |
| Révélation OPS | `components/OpsRevealOverlay.tsx` | **état serveur** : on devient la cible OPS | ⚠️ non (voir ci-dessous) |

### Animations NON démontrables via un simple bouton

- **`OpsRevealOverlay`** : pilotée par `useOpsStatus()` (état serveur `amTarget` +
  `hunter`), montée en permanence dans `AppShell`. La déclencher proprement
  demanderait de simuler une déclaration OPS côté serveur. Si tu veux l'ajouter au
  panneau, il faudrait exposer un `triggerOpsReveal(...)` de test dans un store local
  (comme `duelStrike`) — sinon, laisse-la documentée ici plutôt que mal câblée.

## Checklist quand tu ajoutes une animation

- [ ] Composant overlay créé et **monté** (soit dans `AppShell` si store global, soit là où l'évènement se produit).
- [ ] **Ajoutée au panneau `/GOD` → ANIMATIONS** (bouton + état/mount si piloté par props).
- [ ] Ajoutée à la **table du registre** ci-dessus.
- [ ] `cd apps/web && npm run typecheck` passe.
