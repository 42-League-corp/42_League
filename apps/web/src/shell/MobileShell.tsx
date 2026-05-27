import { type ReactNode } from 'react';
import { MobileHeader } from '../mobile/primitives/MobileHeader';
import { MobileTabBar } from '../mobile/primitives/MobileTabBar';
import { PageTransition } from '../mobile/motion/PageTransition';

interface MobileShellProps {
  children: ReactNode;
}

/**
 * Shell mobile premium :
 * - Header sticky avec safe-area-top
 * - Contenu scrollable plein écran avec padding bottom = tabbar
 * - TabBar premium fixe en bas avec safe-area-bottom
 * - PageTransition wrap les routes pour une nav fluide (fade + slide directionnel)
 * - Pas de scrollbar visible, overscroll bloqué (géré dans index.css)
 * - DOM minimal pour perf optimale sur device modeste
 */
export function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="relative flex flex-col min-h-dvh">
      {/* Vignette dorée subtile en arrière-plan (par-dessus le bg global du body). */}
      <div className="fixed inset-0 bg-gold-vignette pointer-events-none z-0" />

      <MobileHeader />

      {/* Scroll container — padding bottom inclut safe-area + tabbar height */}
      <main
        className="flex-1 min-w-0 w-full px-4 pt-3 overflow-x-hidden relative z-[1]"
        style={{
          paddingBottom: 'calc(60px + env(safe-area-inset-bottom) + 16px)',
        }}
      >
        <PageTransition>{children}</PageTransition>
      </main>

      <MobileTabBar />
    </div>
  );
}
