export const DEFAULT_ELO = 1000;
export const K = 32;

/**
 * Bonus de points par point d'écart de rating, appliqué uniquement quand
 * l'outsider l'emporte. Le facteur de surprise Elo classique `(1 − E)` sature
 * à ~800 pts d'écart : battre quelqu'un à +400 ou à +13900 donnerait sinon
 * quasiment le même gain. Ce terme, lui, ne sature pas → un rating gonflé fond
 * réellement vers la moyenne.
 */
export const UPSET_GAP_COEFF = 0.04;

/**
 * Plafond du bonus d'upset encaissé par le GAGNANT. Le perdant gonflé prend
 * tout le bonus (il fond), mais le gagnant ne grimpe que modérément : battre un
 * seul boss gonflé ne doit pas faire exploser son propre rating.
 */
export const WINNER_BONUS_CAP = 50;

/** Variation maximale d'un joueur sur un seul match (garde-fou). */
export const MAX_DELTA_PER_MATCH = 400;

export type Winner = 'A' | 'B';

export interface EloUpdate {
  newA: number;
  newB: number;
  deltaA: number;
  deltaB: number;
}

/**
 * Calcule la variation de points Elo pour un match de babyfoot.
 * Le gagnant marque toujours 10 buts ; le perdant entre -10 et 9.
 *
 * Deux leviers :
 *  - L'écart de BUTS amplifie le transfert de base via le multiplicateur M.
 *  - L'écart de RATING amplifie le transfert via un bonus proportionnel et
 *    NON saturant, mais seulement quand l'outsider gagne (upset).
 *
 * Le système n'est PAS à somme nulle sur les gros upsets : le perdant surcoté
 * encaisse tout le bonus (deltaPerdant peut atteindre -400) tandis que le
 * gagnant ne touche qu'une part plafonnée. Sur les résultats attendus (favori
 * qui gagne, ratings égaux) le bonus est nul → transfert symétrique classique.
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

  // Étape 1 : probabilité de victoire attendue du gagnant
  const E = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));

  // Étape 2 : multiplicateur d'écart de buts (Δ = 10 − score_perdant)
  const goalDiff = 10 - loserScore;
  const M = 1 + goalDiff * 0.1;

  // Étape 3 : transfert de base façon Elo classique
  const baseP = K * M * (1 - E);

  // Étape 4 : bonus proportionnel à l'écart RÉEL de rating (upset uniquement)
  const gap = Math.max(0, loserRating - winnerRating);
  const gapBonus = gap * UPSET_GAP_COEFF;

  // Étape 5 : application asymétrique, bornée par MAX_DELTA_PER_MATCH
  const winnerGain = Math.min(baseP + Math.min(gapBonus, WINNER_BONUS_CAP), MAX_DELTA_PER_MATCH);
  const loserLoss = Math.min(baseP + gapBonus, MAX_DELTA_PER_MATCH);

  const gain = Math.round(winnerGain);
  const loss = Math.round(loserLoss);

  const deltaA = winner === 'A' ? gain : -loss;
  const deltaB = winner === 'A' ? -loss : gain;

  return {
    newA: ratingA + deltaA,
    newB: ratingB + deltaB,
    deltaA,
    deltaB,
  };
}
