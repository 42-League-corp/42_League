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

/**
 * Bonus d'Elo (points) du champion d'un tournoi, selon son type (`Tournament.kind`).
 * Versé une seule fois à la finale. Les officiels « comptent double » : un tournoi
 * officiel rapporte 100 au vainqueur, un amical seulement 50. Les paliers inférieurs
 * sont interpolés sur ce plafond → ils se répartissent en conséquence (cf.
 * `tournamentEloReward`).
 */
export const TOURNAMENT_ELO_WINNER_OFFICIAL = 100;
export const TOURNAMENT_ELO_WINNER_FRIENDLY = 50;

/** Plafond d'Elo (gain du champion) d'un tournoi selon son `kind`. */
export function tournamentEloMax(kind: string): number {
  return kind === 'official' ? TOURNAMENT_ELO_WINNER_OFFICIAL : TOURNAMENT_ELO_WINNER_FRIENDLY;
}

/** @deprecated Utiliser `tournamentEloMax(kind)`. Conservé = plafond officiel (100). */
export const TOURNAMENT_ELO_WINNER = TOURNAMENT_ELO_WINNER_OFFICIAL;

/**
 * Bonus d'Elo gagné par un participant au terme d'un tournoi, selon le palier
 * atteint. Le champion touche `max` (100 par défaut), un joueur sorti dès la
 * phase de qualification touche 0, et les paliers intermédiaires sont interpolés
 * linéairement jusqu'au champion.
 *
 * La « phase de qualification » dépend du format (cf. schéma `Tournament.format`) :
 *   - `elimination` : le 1er tour du bracket EST la qualif. 0 tour gagné → 0 ;
 *     champion (`totalBracketRounds` tours) → `max`. bonus = round(max · k / R).
 *   - `pools` / `league` : franchir les poules / la phase de ligue est un palier à
 *     part entière. Non qualifié (absent du bracket) → 0. Sinon le palier de
 *     qualification compte comme un tour, et le total devient `R + 1` :
 *     bonus = round(max · (1 + k) / (R + 1)) — un qualifié sorti au 1er tour de
 *     bracket touche donc déjà max/(R+1), et le champion `max`.
 *
 * @param qualified présent dans le bracket (a franchi poules/ligue) — ignoré en
 *   élimination directe où tout le monde démarre dans le bracket.
 * @param bracketRoundsWon tours de bracket gagnés (byes compris), borné à `R`.
 */
export function tournamentEloReward(params: {
  format: string;
  qualified: boolean;
  bracketRoundsWon: number;
  totalBracketRounds: number;
  max?: number;
}): number {
  const max = params.max ?? TOURNAMENT_ELO_WINNER;
  const R = params.totalBracketRounds;
  if (R <= 0 || max <= 0) return 0;
  const k = Math.max(0, Math.min(params.bracketRoundsWon, R));
  if (params.format === 'pools' || params.format === 'league') {
    if (!params.qualified) return 0;
    return Math.round((max * (1 + k)) / (R + 1));
  }
  // Élimination directe : pas de palier de qualification distinct.
  return Math.round((max * k) / R);
}
