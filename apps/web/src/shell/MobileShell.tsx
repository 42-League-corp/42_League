import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { MobileHeader } from '../mobile/primitives/MobileHeader';
import { MobileTabBar } from '../mobile/primitives/MobileTabBar';
import { PageTransition } from '../mobile/motion/PageTransition';
import { FABProvider } from '../mobile/primitives/FAB';
import { useViewport } from '../hooks/useViewport';
import { ScrollRootContext } from './scrollRoot';

interface MobileShellProps {
  children: ReactNode;
}

/**
 * Shell mobile premium :
 * - Hauteur figée à 100dvh, scroll interne uniquement dans <main> →
 *   évite le « double scroll » où on peut descendre sous le contenu.
 * - Le ref sur <main> est exposé via ScrollRootContext : c'est la source de
 *   vérité unique du conteneur scrollable, consommée par PullToRefresh.
 * - Header sticky (en flux, en haut) avec safe-area-top
 * - Contenu scrollable avec padding bottom = tabbar height
 * - TabBar premium fixe en bas avec safe-area-bottom
 * - FABProvider : un seul FAB rendu à la fois pour toute l'app mobile
 * - PageTransition wrap les routes pour une nav fluide (fade + slide directionnel)
 */
export function MobileShell({ children }: MobileShellProps) {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  // Hauteur visible RÉELLE (window.innerHeight, réactif au resize → suit la
  // barre d'URL mobile qui s'ouvre/se ferme). On ne se fie plus à `100dvh` qui,
  // sur certains navigateurs mobiles, sur-évalue la hauteur (≈ lvh) et laissait
  // donc <main> scroller dans le vide sous le contenu.
  const { height } = useViewport();

  // Au changement de page, on repart en haut de la nouvelle page (le <main> est
  // le seul conteneur scrollable). Les pages qui veulent un autre point d'ancrage
  // (ex. le classement qui se centre sur l'utilisateur) le font ensuite, en différé.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <ScrollRootContext.Provider value={mainRef}>
      <FABProvider>
        <div
          className="relative flex flex-col h-dvh overflow-hidden"
          style={height ? { height: `${height}px` } : undefined}
        >
          {/* Vignette dorée subtile en arrière-plan (par-dessus le bg global du body). */}
          <div className="fixed inset-0 bg-gold-vignette pointer-events-none z-0" />

          <MobileHeader />

          {/* Scroll container — padding bottom = hauteur tabbar + safe-area + 8px
              de respiration. overflow-y-auto + overscroll-contain → seul <main>
              scrolle, le rebond est bloqué (pas de zone vide sous le site). */}
          <main
            ref={mainRef}
            className="flex-1 min-w-0 w-full px-4 pt-3 overflow-x-hidden overflow-y-auto overscroll-contain relative z-[1] scrollbar-none"
            style={{
              paddingBottom: 'calc(60px + env(safe-area-inset-bottom) + 8px)',
            }}
          >
            <PageTransition>{children}</PageTransition>
          </main>

          <MobileTabBar />
        </div>
      </FABProvider>
    </ScrollRootContext.Provider>
  );
}
