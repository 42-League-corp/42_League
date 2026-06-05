import { useEffect, useRef } from 'react';

interface SwipeOptions {
  /** Désactive complètement la détection (ex. desktop). */
  enabled?: boolean;
  /** Swipe de droite à gauche (le doigt part vers la gauche). */
  onSwipeLeft?: () => void;
  /** Swipe de gauche à droite (le doigt part vers la droite). */
  onSwipeRight?: () => void;
  /** Distance horizontale minimale en px avant déclenchement (défaut 64). */
  threshold?: number;
}

/**
 * Détecte un swipe horizontal sur un conteneur, en touch natif.
 *
 * Conçu pour la navigation par onglets sur mobile. Deux garde-fous importants :
 *  - On ignore les gestes plus verticaux qu'horizontaux (laisse passer le scroll
 *    vertical de la page).
 *  - Si le geste démarre dans un élément scrollable horizontalement (ex. une
 *    table large en `overflow-x-auto`) qui a encore de la marge de scroll dans
 *    le sens du swipe, on laisse la table consommer le geste plutôt que de
 *    changer d'onglet.
 *
 * Retourne une ref à poser sur le conteneur d'écoute.
 */
export function useHorizontalSwipe<T extends HTMLElement>({
  enabled = true,
  onSwipeLeft,
  onSwipeRight,
  threshold = 64,
}: SwipeOptions) {
  const ref = useRef<T>(null);
  // Garde les callbacks à jour sans réattacher les listeners à chaque render.
  const handlers = useRef({ onSwipeLeft, onSwipeRight });
  handlers.current = { onSwipeLeft, onSwipeRight };

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    // État de l'ancêtre scrollable-x sous le doigt au début du geste.
    let scrollAtStart: { left: number; max: number } | null = null;

    // Remonte du target jusqu'au conteneur, à la recherche d'un ancêtre
    // réellement scrollable horizontalement.
    function findScrollableX(target: EventTarget | null): HTMLElement | null {
      let node = target as HTMLElement | null;
      while (node && node !== el && node instanceof HTMLElement) {
        const ox = getComputedStyle(node).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && node.scrollWidth > node.clientWidth + 1) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      const touch = e.touches[0];
      if (!touch) {
        tracking = false;
        return;
      }
      tracking = true;
      startX = touch.clientX;
      startY = touch.clientY;
      const sc = findScrollableX(e.target);
      scrollAtStart = sc ? { left: sc.scrollLeft, max: sc.scrollWidth - sc.clientWidth } : null;
    }

    function onEnd(e: TouchEvent) {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      // Pas assez ample horizontalement → on ignore.
      if (Math.abs(dx) < threshold) return;
      // Geste trop vertical → c'est du scroll, pas un swipe d'onglet.
      if (Math.abs(dx) < Math.abs(dy) * 1.5) return;

      // Une table large a-t-elle pu absorber le geste dans ce sens ?
      if (scrollAtStart) {
        if (dx < 0 && scrollAtStart.left < scrollAtStart.max - 1) return; // scroll vers la droite possible
        if (dx > 0 && scrollAtStart.left > 1) return; // scroll vers la gauche possible
      }

      if (dx < 0) handlers.current.onSwipeLeft?.();
      else handlers.current.onSwipeRight?.();
    }

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [enabled, threshold]);

  return ref;
}
