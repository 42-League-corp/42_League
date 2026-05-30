export const DEFAULT_ELO = 1000;
export const K = 32;

// ─── OPS (ennemi juré) ──────────────────────────────────────────────────────
// Pendant un OPS (24h), la cible doit affronter son traqueur : elle ne peut pas
// refuser ses 3 premiers matchs. Refuser l'un de ces matchs forcés coûte
// OPS_REFUSE_MULTIPLIER × l'ELO qu'une défaite « normale » aurait coûté.
export const OPS_DURATION_MS = 24 * 60 * 60 * 1000;
export const OPS_FORCED_MATCHES = 3;
export const OPS_REFUSE_MULTIPLIER = 3;

/**
 * Perte d'ELO attendue pour une défaite « neutre » (sans amplificateur d'écart
 * de buts) du `loser` face au `winner`. Sert de base au calcul de la pénalité
 * de refus d'un match forcé en OPS.
 */
export function estimatedEloLoss(loserRating: number, winnerRating: number): number {
  // Probabilité de victoire attendue du gagnant.
  const E = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  return Math.max(1, Math.round(K * (1 - E)));
}

export type Winner = 'A' | 'B';

export interface EloUpdate {
  newA: number;
  newB: number;
  deltaA: number;
  deltaB: number;
}

/**
 * Calcule le transfert de points Elo pour un match de babyfoot.
 * Le gagnant marque toujours 10 buts ; le perdant entre -10 et 9.
 * L'écart de buts amplifie ou réduit le transfert via un multiplicateur linéaire.
 * Résultat garanti à somme nulle : deltaA + deltaB === 0.
 */
export function calculateBabyfootElo(
  ratingA: number,
  ratingB: number,
  winner: Winner,
  scoreA: number,
  scoreB: number,
): EloUpdate {
  const winnerRating = winner === 'A' ? ratingA : ratingB;
  const loserRating = winner === 'A' ? ratingB : ratingA;
  const loserScore = winner === 'A' ? scoreB : scoreA;

  // Étape 1 : Probabilité de victoire attendue du gagnant
  const E = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));

  // Étape 2 : Multiplicateur d'écart de buts (Δ = 10 − score_perdant)
  const goalDiff = 10 - loserScore;
  const M = 1 + goalDiff * 0.1;

  // Étape 3 : Points transférés du perdant vers le gagnant
  const P = Math.round(K * M * (1 - E));

  // Étape 4 : Application somme-nulle
  const deltaA = winner === 'A' ? P : -P;
  const deltaB = winner === 'A' ? -P : P;

  return {
    newA: ratingA + deltaA,
    newB: ratingB + deltaB,
    deltaA,
    deltaB,
  };
}
