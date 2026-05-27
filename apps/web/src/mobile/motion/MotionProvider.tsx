import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

interface MotionProviderProps {
  children: ReactNode;
}

/**
 * Wrapper Framer Motion racine — respecte la pref système `prefers-reduced-motion`
 * via MotionConfig. Désactive automatiquement les animations agressives pour les
 * users qui préfèrent moins de mouvement (accessibilité + batterie).
 *
 * Note : on n'utilise volontairement PAS `LazyMotion` ici car ça forcerait à
 * migrer tous les `motion.*` en `m.*`. Trade-off bundle vs simplicité retenu.
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
