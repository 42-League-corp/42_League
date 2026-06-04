export const DEFAULT_ELO = 1000;
export const K = 32;

// ─── OPS (ennemi juré) ──────────────────────────────────────────────────────
export const OPS_DURATION_MS = 24 * 60 * 60 * 1000;
export const OPS_FORCED_MATCHES = 3;
export const OPS_REFUSE_MULTIPLIER = 3;

export function estimatedEloLoss(loserRating: number, winnerRating: number): number {
  const E = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  return Math.max(1, Math.round(K * (1 - E)));
}

export const UPSET_GAP_COEFF = 0.04;
export const WINNER_BONUS_CAP = 50;
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

// ─── SMASH BROS ───────────────────────────────────────────────────────────────

/** Formats de set autorisés pour Smash. */
export const SMASH_BEST_OF = [3, 5] as const;
export type SmashBestOf = (typeof SMASH_BEST_OF)[number];
/** Nombre de vies (stocks) par game. */
export const SMASH_STOCKS = 3;

/** Nombre de games à gagner pour remporter un set Bo3/Bo5. */
export function smashTarget(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

/**
 * Variation d'Elo pour un set de Smash (Bo3 / Bo5).
 *
 * Même ossature que le babyfoot (probabilité attendue + bonus d'upset non
 * saturant), mais le multiplicateur de domination `M` est dérivé de DEUX
 * signaux propres à Smash :
 *   - l'écart de games du set (2-0 plus net qu'un 2-1) ;
 *   - les vies (stocks) restantes du gagnant au game décisif.
 *
 * `gamesA`/`gamesB` = games gagnés par chaque joueur dans le set.
 * `winnerStocks` = vies restantes du gagnant au dernier game (1..SMASH_STOCKS).
 */
export function calculateSmashElo(
  ratingA: number,
  ratingB: number,
  winner: Winner,
  gamesA: number,
  gamesB: number,
  bestOf: number,
  winnerStocks: number = 1,
): EloUpdate {
  const winnerRating = winner === 'A' ? ratingA : ratingB;
  const loserRating = winner === 'A' ? ratingB : ratingA;

  const winnerGames = Math.max(gamesA, gamesB);
  const loserGames = Math.min(gamesA, gamesB);
  const maxSetMargin = smashTarget(bestOf); // 2 (Bo3) ou 3 (Bo5)
  const setMargin = Math.max(1, winnerGames - loserGames);
  const setDom = maxSetMargin > 1 ? (setMargin - 1) / (maxSetMargin - 1) : 0; // 0..1
  const stocks = Math.min(SMASH_STOCKS, Math.max(1, winnerStocks));
  const stockDom = SMASH_STOCKS > 1 ? (stocks - 1) / (SMASH_STOCKS - 1) : 0; // 0..1

  // M ∈ [1, 2] — même amplitude que le babyfoot (1 + goalDiff*0.1).
  const M = 1 + 0.5 * setDom + 0.5 * stockDom;

  const E = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const baseP = K * M * (1 - E);

  const gap = Math.max(0, loserRating - winnerRating);
  const gapBonus = gap * UPSET_GAP_COEFF;

  const winnerGain = Math.min(baseP + Math.min(gapBonus, WINNER_BONUS_CAP), MAX_DELTA_PER_MATCH);
  const loserLoss = Math.min(baseP + gapBonus, MAX_DELTA_PER_MATCH);

  const gain = Math.round(winnerGain);
  const loss = Math.round(loserLoss);

  const deltaA = winner === 'A' ? gain : -loss;
  const deltaB = winner === 'A' ? -loss : gain;

  return { newA: ratingA + deltaA, newB: ratingB + deltaB, deltaA, deltaB };
}

// ─── SMASH FFA (Free-For-All, N>=3) ──────────────────────────────────────────

/**
 * Variation d'Elo pour un Free-For-All Smash à N joueurs, modèle round-robin
 * SENSIBLE AU RATING.
 *
 * `ratings` est fourni dans l'ORDRE DU CLASSEMENT FINAL : `ratings[0]` = 1er,
 * … `ratings[N-1]` = dernier. On considère que chaque joueur a « battu » tous
 * ceux classés EN DESSOUS de lui et « perdu » contre tous ceux AU-DESSUS. On
 * somme les deltas de chaque duel (via `calculateChessElo` — résultat binaire,
 * même bonus d'upset non saturant que les autres jeux) puis on MOYENNE sur les
 * (N-1) adversaires pour garder l'amplitude d'un match unique.
 *
 * Propriétés : le 1er gagne le plus, le dernier perd le plus, le haut du milieu
 * gagne, le bas du milieu perd, et — à ratings égaux — le milieu exact (N impair)
 * reste à ~0. Les écarts de rating comptent (battre plus fort rapporte plus).
 * Chaque delta de duel respecte déjà `MAX_DELTA_PER_MATCH`, donc la moyenne aussi.
 *
 * Retourne les deltas alignés sur `ratings` (`deltas[i]` correspond à `ratings[i]`).
 */
export function calculateFfaElo(ratings: number[]): number[] {
  const n = ratings.length;
  if (n < 2) return ratings.map(() => 0);
  const sum = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // i est mieux classé que j → i gagne ('A'), j perd ('B').
      // i,j ∈ [0,n) → accès garantis (non-null sous noUncheckedIndexedAccess).
      const { deltaA, deltaB } = calculateChessElo(ratings[i]!, ratings[j]!, 'A');
      sum[i]! += deltaA;
      sum[j]! += deltaB;
    }
  }
  // Moyenne sur les adversaires (arrondie une seule fois pour limiter la dérive).
  return sum.map((s) => Math.round(s / (n - 1)));
}

// ─── ÉCHECS ─────────────────────────────────────────────────────────────────

/**
 * Variation d'Elo pour une partie d'échecs : résultat binaire (pas de marge),
 * donc multiplicateur M = 1. On conserve le bonus d'upset non saturant pour
 * récompenser les exploits, comme aux autres jeux.
 */
export function calculateChessElo(
  ratingA: number,
  ratingB: number,
  winner: Winner,
): EloUpdate {
  const winnerRating = winner === 'A' ? ratingA : ratingB;
  const loserRating = winner === 'A' ? ratingB : ratingA;

  const E = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const baseP = K * (1 - E); // M = 1 : pas de marge aux échecs

  const gap = Math.max(0, loserRating - winnerRating);
  const gapBonus = gap * UPSET_GAP_COEFF;

  const winnerGain = Math.min(baseP + Math.min(gapBonus, WINNER_BONUS_CAP), MAX_DELTA_PER_MATCH);
  const loserLoss = Math.min(baseP + gapBonus, MAX_DELTA_PER_MATCH);

  const gain = Math.round(winnerGain);
  const loss = Math.round(loserLoss);

  const deltaA = winner === 'A' ? gain : -loss;
  const deltaB = winner === 'A' ? -loss : gain;

  return { newA: ratingA + deltaA, newB: ratingB + deltaB, deltaA, deltaB };
}
