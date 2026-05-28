import { type ReactNode } from 'react';
import { MobileHeader } from '../mobile/primitives/MobileHeader';
import { MobileTabBar } from '../mobile/primitives/MobileTabBar';
import { PageTransition } from '../mobile/motion/PageTransition';
import { FABProvider } from '../mobile/primitives/FAB';

interface MobileShellProps {
  children: ReactNode;
}

/**
 * Shell mobile premium :
 * - Hauteur figée à 100dvh, scroll interne uniquement dans <main> →
 *   évite le « double scroll » où on peut descendre sous le contenu.
 * - Header sticky (en flux, en haut) avec safe-area-top
 * - Contenu scrollable avec padding bottom = tabbar height
 * - TabBar premium fixe en bas avec safe-area-bottom
 * - FABProvider : un seul FAB rendu à la fois pour toute l'app mobile
 * - PageTransition wrap les routes pour une nav fluide (fade + slide directionnel)
 */
export function MobileShell({ children }: MobileShellProps) {
  return (
    <FABProvider>
      <div className="relative flex flex-col h-dvh overflow-hidden">
        {/* Vignette dorée subtile en arrière-plan (par-dessus le bg global du body). */}
        <div className="fixed inset-0 bg-gold-vignette pointer-events-none z-0" />

        <MobileHeader />

        {/* Scroll container — padding bottom = hauteur tabbar + safe-area + 8px
            de respiration. overflow-y-auto + overscroll-contain → seul <main>
            scrolle, le rebond est bloqué (pas de zone vide sous le site). */}
        <main
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
  );
}
