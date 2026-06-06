// ─────────────────────────────────────────────────────────────────────────────
// Économie des tournois : multiplicateur de pari progressif + cash-prize par palier.
// Logique PURE (aucun accès DB) → testable et partagée backend/front.
//
// Principe commun : tout est indexé sur le NOMBRE DE TOURS GAGNÉS par le sujet
// (joueur/équipe) dans le bracket à élimination directe.
//   - 0 tour gagné            → rien (mise de pari perdue, cash-prize nul) ;
//   - `totalRounds` tours     → champion (gain maximal) ;
//   - paliers intermédiaires  → interpolés linéairement.
//
// `totalRounds` = nombre de tours du bracket (8 équipes → 3, 16 → 4, 32 → 5…).
// ─────────────────────────────────────────────────────────────────────────────

/** Multiplicateur final par défaut d'un pari sur le vainqueur (amicaux). */
export const DEFAULT_BET_FINAL_MULT = 2;

/**
 * Multiplicateur de gain d'un pari, selon les tours franchis par le pronostic.
 *
 *   mult(k) = 1 + (finalMult − 1) · k / totalRounds     (k ≥ 1)
 *   mult(0) = 0  → mise perdue (« pas de gain si tu passes aucun tour »).
 *
 * Le champion (k = totalRounds) atteint exactement `finalMult`. Ex. bracket de
 * 16 (4 tours), final ×2 : 1 tour → ×1.25, 2 → ×1.5, 3 → ×1.75, 4 → ×2.
 */
export function betMultiplier(roundsWon: number, totalRounds: number, finalMult: number): number {
  if (roundsWon <= 0 || totalRounds <= 0) return 0;
  const k = Math.min(roundsWon, totalRounds);
  return 1 + (finalMult - 1) * (k / totalRounds);
}

/** Gain (coins) d'un pari de mise `stake` pour un pronostic ayant franchi `roundsWon` tours. */
export function betPayout(
  stake: number,
  roundsWon: number,
  totalRounds: number,
  finalMult: number,
): number {
  return Math.round(stake * betMultiplier(roundsWon, totalRounds, finalMult));
}

/**
 * Cash-prize (coins) d'un participant selon les tours franchis — proportionnel au
 * tour atteint, le champion touchant `base` :
 *
 *   prize(k) = round(base · k / totalRounds)      (k ≥ 1)
 *   prize(0) = 0
 *
 * Ex. base 10000 sur un bracket de 16 (4 tours) : champion 10000, finaliste 7500,
 * demi-finaliste 5000, éliminé au 1er tour gagné 2500, sorti d'entrée 0.
 */
export function cashPrizeForRounds(roundsWon: number, totalRounds: number, base: number): number {
  if (roundsWon <= 0 || totalRounds <= 0 || base <= 0) return 0;
  const k = Math.min(roundsWon, totalRounds);
  return Math.round(base * (k / totalRounds));
}
