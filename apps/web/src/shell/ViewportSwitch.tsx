import type { ReactNode } from 'react';
import { useViewport } from '../hooks/useViewport';

interface ViewportSwitchProps {
  mobile: ReactNode;
  desktop: ReactNode;
  /** Forcer un rendu (override useful pour Storybook / tests). */
  force?: 'mobile' | 'desktop';
}

/**
 * Ne monte qu'un seul des deux arbres React — pas de double DOM.
 * Bascule réactif à chaque resize/orientation grâce à useViewport().
 *
 * Pattern volontairement simple : un seul booléen `isMobile` décide.
 * Pour des cas tablet-spécifiques, utiliser useViewport directement dans la page.
 */
export function ViewportSwitch({ mobile, desktop, force }: ViewportSwitchProps) {
  const { isMobile } = useViewport();
  const showMobile = force ? force === 'mobile' : isMobile;
  return <>{showMobile ? mobile : desktop}</>;
}
