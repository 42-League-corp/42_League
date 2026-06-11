import { useSyncExternalStore } from 'react';
import { getRankUp, subscribeRankUp, type RankUp } from '../lib/rankUp';

/** Expose à React l'état courant de la cinématique « PASSAGE DE RANG ». */
export function useRankUp(): RankUp | null {
  return useSyncExternalStore(subscribeRankUp, getRankUp, getRankUp);
}
