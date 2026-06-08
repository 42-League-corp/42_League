import type { ReactNode } from 'react';
import { DesktopShell } from './DesktopShell';
import { MobileShell } from './MobileShell';
import { ViewportSwitch } from './ViewportSwitch';
import { NotifBanner } from '../components/NotifBanner';
import { OpsRevealOverlay } from '../components/OpsRevealOverlay';
import { GameModeSwitch } from '../components/GameModeSwitch';
import { GameBackdrop } from '../components/GameBackdrop';
import { TesterSwitch } from '../components/TesterSwitch';
import { GameOnboarding } from '../components/GameOnboarding';
import { AnnouncementPopup } from '../components/AnnouncementPopup';
import { GameTransitionOverlay } from '../components/GameTransitionOverlay';
import { MatchmakingOverlay } from '../components/MatchmakingOverlay';
import { DuelStrikeOverlay } from '../components/DuelStrikeOverlay';
import { ContestRageOverlay } from '../components/ContestRageOverlay';

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
      {/* Décor d'ambiance par univers — derrière tout le contenu */}
      <GameBackdrop />
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
      {/* Annonces générales (admin) — popup « une seule fois » à la connexion */}
      <AnnouncementPopup />
      {/* Overlay cinématique de changement d'univers — pointer-events-none */}
      <GameTransitionOverlay />
      {/* Overlay VERSUS global : s'affiche sur n'importe quelle page quand le
          matchmaking trouve un adversaire (recherche persistante inter-pages) */}
      <MatchmakingOverlay />
      {/* Réaction « rage » plein écran quand une game est contestée — des deux
          côtés du litige (contesteur via API, contesté via SSE) */}
      <ContestRageOverlay />
      {/* Cinématique « coup de foudre → VERSUS » à l'acceptation/lancement d'un duel */}
      <DuelStrikeOverlay />
    </>
  );
}
