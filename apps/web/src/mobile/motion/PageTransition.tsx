import { useMemo, useRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Ordre des routes principales — sert à détecter le sens de la transition
 * (gauche/droite) selon que l'utilisateur navigue vers une route plus à droite
 * ou plus à gauche dans la TabBar.
 *
 * Note : on utilise `m` (mini) au lieu de `motion` pour profiter de LazyMotion
 * et garder le bundle initial plus léger.
 */
const TAB_ORDER = [
  '/challenges',
  '/tournaments',
  '/leaderboard',
  '/trophies',
  '/profile',
] as const;

function tabIndex(pathname: string): number {
  for (let i = 0; i < TAB_ORDER.length; i++) {
    const route = TAB_ORDER[i];
    if (pathname === route || pathname.startsWith(`${route}/`)) return i;
  }
  return -1;
}

/**
 * Wrapper de transitions de pages pour le shell mobile.
 *
 * Comportement :
 * - Navigation entre deux onglets de la TabBar → slide horizontal (direction selon l'ordre)
 * - Navigation profonde (sous-route) → fade simple
 * - Respect de `prefers-reduced-motion` → pas d'animation, juste un changement de clé
 *
 * Implémenté avec `AnimatePresence mode="wait"` pour éviter le double-render
 * (un seul écran à la fois en mémoire).
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const lastTabIdxRef = useRef(tabIndex(location.pathname));

  const direction = useMemo(() => {
    const current = tabIndex(location.pathname);
    if (current < 0 || lastTabIdxRef.current < 0) {
      lastTabIdxRef.current = current;
      return 0;
    }
    const dir = current === lastTabIdxRef.current ? 0 : current > lastTabIdxRef.current ? 1 : -1;
    lastTabIdxRef.current = current;
    return dir;
  }, [location.pathname]);

  // Reduced motion → skip transitions
  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  // Transition « entrée seule » : un seul écran monté à la fois.
  // - Pas d'AnimatePresence/popLayout → on évite la mesure de layout forcée de la
  //   page sortante (reflow synchrone coûteux sur une page mobile longue) et le
  //   double-montage des deux pages pendant l'animation. C'était la cause du
  //   micro-lag à chaque navigation.
  // - Le `key` sur la pathname force le remount : l'ancienne page disparaît
  //   instantanément, la nouvelle slide/fade en entrant.
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, x: direction * 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      // PAS de `gpu` ici : `will-change: transform`/`translateZ(0)` permanent
      // promeut tout le contenu scrollable en couche compositeur, et l'APZ de
      // Firefox Android mappe alors les taps sur les coords NON-transformées de
      // cette couche → dès qu'on a scrollé, les taps atterrissent décalés et
      // « presque rien ne répond » (chart, titre, badges sous la ligne de
      // flottaison). Chrome gère, pas FF. framer-motion composite déjà de lui-même
      // le temps de l'anim d'entrée — inutile de figer la couche en permanence.
      className="w-full"
    >
      {children}
    </motion.div>
  );
}
