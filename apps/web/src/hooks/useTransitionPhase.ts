import { useSyncExternalStore } from 'react';
import { getTransitionPhase, subscribeTransitionPhase, type TransitionPhase } from '../lib/universeTransition';

/** Lit la phase courante de la transition d'univers (idle / exit / reveal / enter). */
export function useTransitionPhase(): TransitionPhase {
  return useSyncExternalStore(subscribeTransitionPhase, getTransitionPhase, getTransitionPhase);
}
