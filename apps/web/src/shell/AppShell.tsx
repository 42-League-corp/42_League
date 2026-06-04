import type { ReactNode } from 'react';
import { DesktopShell } from './DesktopShell';
import { MobileShell } from './MobileShell';
import { ViewportSwitch } from './ViewportSwitch';
import { NotifBanner } from '../components/NotifBanner';
import { OpsRevealOverlay } from '../components/OpsRevealOverlay';
import { GameModeSwitch } from '../components/GameModeSwitch';
import { TesterSwitch } from '../components/TesterSwitch';
import { GameOnboarding } from '../components/GameOnboarding';
import { GameTransitionOverlay } from '../components/GameTransitionOverlay';

interface AppShellProps {
  children: ReactNode;
}

/**
 * Racine du chrome de l'app authentifiée.
 * Choisit Mobile ou Desktop selon le viewport.
 * Le contenu (les <Routes>) est passé en children — il est rendu une seule fois
 * et reçoit le bon wrapper.
 *
 * <NotifBanner> est monté ici (hors du switch viewport) pour flotter au-dessus
 * de n'importe quelle page : duels reçus et scores à valider poppent en temps
 * réel (SSE via useLeagueData) sur toute l'app.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <>
      <ViewportSwitch
        mobile={<MobileShell>{children}</MobileShell>}
        desktop={<DesktopShell>{children}</DesktopShell>}
      />
      <NotifBanner />
      <OpsRevealOverlay />
      <GameModeSwitch />
      {/* Bouton « Tester en mode user » (staging + admins) — bas-gauche */}
      <TesterSwitch />
      <GameOnboarding />
      {/* Overlay cinématique de changement d'univers — pointer-events-none */}
      <GameTransitionOverlay />
    </>
  );
}
