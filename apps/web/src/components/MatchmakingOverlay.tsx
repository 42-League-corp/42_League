import { AnimatePresence } from 'framer-motion';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useLeagueData } from '../hooks/useLeagueData';
import { useGameMode } from '../hooks/useGameMode';
import { VersusOverlay } from './VersusOverlay';

/**
 * Overlay VERSUS global, monté dans l'AppShell (hors du switch viewport) → il
 * s'affiche au-dessus de N'IMPORTE QUELLE page quand le matchmaking trouve un
 * adversaire, même si l'utilisateur a quitté la page des défis pendant la
 * recherche. Source de vérité : le MatchmakingProvider (cf. useMatchmaking).
 */
export function MatchmakingOverlay() {
  const { state, opponent, dismiss } = useMatchmaking();
  const { me } = useLeagueData();
  const { game } = useGameMode();

  const myUser = me?.user;
  const meName =
    myUser?.firstName && myUser?.lastName
      ? `${myUser.firstName} ${myUser.lastName}`
      : myUser?.login ?? '—';
  const oppName =
    opponent?.firstName && opponent?.lastName
      ? `${opponent.firstName} ${opponent.lastName}`
      : opponent?.login ?? '';

  return (
    <AnimatePresence>
      {state === 'matched' && opponent && (
        <VersusOverlay
          game={game}
          me={{ login: myUser?.login ?? '—', imageUrl: myUser?.imageUrl ?? null, name: meName }}
          opponent={{ login: opponent.login, imageUrl: opponent.imageUrl, name: oppName }}
          onDone={dismiss}
        />
      )}
    </AnimatePresence>
  );
}
