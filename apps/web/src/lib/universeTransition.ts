/**
 * Store hors-React de la phase courante d'une transition d'univers.
 *
 *   idle   : aucun changement en cours
 *   exit   : les blocs du contenu se dispersent radialement vers les bords
 *   reveal : les blocs sont hors-champ → le backdrop change (cross-fade des photos)
 *   enter  : les blocs reviennent à leur place depuis l'opposé
 *
 * Le store est aussi exposé en attribut `data-transition` sur <html> par
 * UniverseTransition → utilisé par les règles CSS globales (index.css) et par
 * GameBackdrop (qui éclaircit son scrim pour révéler la photo, et cross-fade
 * les deux images entre exit et enter).
 */
export type TransitionPhase = 'idle' | 'exit' | 'reveal' | 'enter';

let current: TransitionPhase = 'idle';
const listeners = new Set<() => void>();

export function getTransitionPhase(): TransitionPhase {
  return current;
}

export function setTransitionPhase(p: TransitionPhase): void {
  if (p === current) return;
  current = p;
  if (typeof document !== 'undefined') {
    if (p === 'idle') document.documentElement.removeAttribute('data-transition');
    else document.documentElement.setAttribute('data-transition', p);
  }
  for (const l of listeners) l();
}

export function subscribeTransitionPhase(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
