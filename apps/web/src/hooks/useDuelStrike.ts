import { useSyncExternalStore } from 'react';
import { getDuelStrike, subscribeDuelStrike, type DuelStrike } from '../lib/duelStrike';

/** Expose à React l'état courant de la cinématique « coup de foudre → VERSUS ». */
export function useDuelStrike(): DuelStrike | null {
  return useSyncExternalStore(subscribeDuelStrike, getDuelStrike, getDuelStrike);
}
