import { useMemo, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
  '/defis',
  '/tournois',
  '/leaderboard',
  '/trophees',
  '/profil',
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

  return (
    // mode="popLayout" (Framer Motion 10+) :
    // - L'élément sortant est mis en position:absolute (hors du flux normal)
    //   → il n'affecte pas la hauteur du conteneur pendant l'exit animation
    // - L'élément entrant prend sa place en flux normal, animation simultanée
    // - Pas de blocage Suspense (pas de mode="wait" qui attend le commit React 18)
    // Le wrapper relatif est requis par popLayout pour positionner l'élément sortant.
    <div className="relative w-full">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, x: direction * 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -12 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className="w-full gpu"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
