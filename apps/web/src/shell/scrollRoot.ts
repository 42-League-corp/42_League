import { createContext, useContext, type RefObject } from 'react';

/**
 * Source de vérité unique du conteneur scrollable mobile.
 * Posée par MobileShell sur le <main> (le seul élément qui scrolle dans le shell).
 * Consommée par PullToRefresh — au lieu de créer son propre conteneur de geste
 * qui rentrerait en conflit avec le scroll natif.
 */
export const ScrollRootContext = createContext<RefObject<HTMLElement> | null>(null);

export function useScrollRoot(): RefObject<HTMLElement> | null {
  return useContext(ScrollRootContext);
}
