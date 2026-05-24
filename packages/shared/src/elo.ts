export const DEFAULT_ELO = 1000;
export const PLACEMENT_MATCHES = 10;
export const K_PLACEMENT = 40;
export const K_RANKED = 20;

export type Winner = 'A' | 'B';

export interface EloUpdate {
  newA: number;
  newB: number;
  deltaA: number;
  deltaB: number;
}

export function kFactor(matchesPlayed: number): number {
  return matchesPlayed < PLACEMENT_MATCHES ? K_PLACEMENT : K_RANKED;
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function applyElo(
  ratingA: number,
  ratingB: number,
  winner: Winner,
  matchesPlayedA: number,
  matchesPlayedB: number,
): EloUpdate {
  const eA = expectedScore(ratingA, ratingB);
  const eB = 1 - eA;
  const sA = winner === 'A' ? 1 : 0;
  const sB = 1 - sA;
  const kA = kFactor(matchesPlayedA);
  const kB = kFactor(matchesPlayedB);
  const deltaA = Math.round(kA * (sA - eA));
  const deltaB = Math.round(kB * (sB - eB));
  return {
    newA: ratingA + deltaA,
    newB: ratingB + deltaB,
    deltaA,
    deltaB,
  };
}
