import { AnimatePresence } from 'framer-motion';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useLeagueData } from '../hooks/useLeagueData';
import { VersusOverlay } from './VersusOverlay';

/**
 * Overlay VERSUS global, monté dans l'AppShell (hors du switch viewport) → il
 * s'affiche au-dessus de N'IMPORTE QUELLE page quand le matchmaking trouve un
 * adversaire, même si l'utilisateur a quitté la page des défis pendant la
 * recherche. Source de vérité : le MatchmakingProvider (cf. useMatchmaking).
 *
 * Le mode affiché (logo) est celui de l'APPARIEMENT (`matched.game`), pas le mode
 * de la page courante : on peut chercher en smash, être sur une autre page en
 * babyfoot, et voir « Adversaire trouvé · Smash ».
 */
export function MatchmakingOverlay() {
  const { matched, dismiss } = useMatchmaking();
  const { me } = useLeagueData();

  const myUser = me?.user;
  const meName =
    myUser?.firstName && myUser?.lastName
      ? `${myUser.firstName} ${myUser.lastName}`
      : myUser?.login ?? '—';
  const opponent = matched?.opponent ?? null;
  const oppName =
    opponent?.firstName && opponent?.lastName
      ? `${opponent.firstName} ${opponent.lastName}`
      : opponent?.login ?? '';

  return (
    <AnimatePresence>
      {matched && opponent && (
        <VersusOverlay
          game={matched.game}
          me={{ login: myUser?.login ?? '—', imageUrl: myUser?.imageUrl ?? null, name: meName }}
          opponent={{ login: opponent.login, imageUrl: opponent.imageUrl, name: oppName }}
          onDone={dismiss}
        />
      )}
    </AnimatePresence>
  );
}
