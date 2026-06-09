// Score G.O.A.T — la logique de calcul vit désormais dans le module PARTAGÉ
// `@42-league/shared` (cf. packages/shared/src/goat.ts), afin que le backend
// attribue le badge `goat` au #1 avec EXACTEMENT le même classement que cette page.
// Ce fichier n'est plus qu'un mince adaptateur typé avec les modèles front.

import type { LeaderboardEntry, PlayedMatch, Tournament } from './api';
import {
  computeGoat as computeGoatShared,
  GOAT_WEIGHTS,
  type GoatPlayer as GoatPlayerShared,
  type GoatMetricKey,
  type GoatMetrics,
  type GoatWeight,
} from '@42-league/shared';

export { GOAT_WEIGHTS };
export type { GoatMetricKey, GoatMetrics, GoatWeight };

/** Joueur classé au G.O.A.T, porteur d'une entrée de leaderboard front. */
export type GoatPlayer = GoatPlayerShared<LeaderboardEntry>;

/**
 * Classement G.O.A.T à partir du leaderboard (ELO), de l'historique des matchs
 * (buts, marges, séries) et des tournois (titres officiels / amicaux).
 */
export function computeGoat(
  leaderboard: LeaderboardEntry[],
  matches: PlayedMatch[],
  tournaments: Tournament[],
): GoatPlayer[] {
  return computeGoatShared(leaderboard, matches, tournaments);
}
