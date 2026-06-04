import { useState } from 'react';
import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { DeclareGameFlow } from '../shared/DeclareGameFlow';
import { Declare2v2GameFlow } from '../shared/Declare2v2GameFlow';
import { Mode1v1Toggle, type DuelMode } from '../shared/Mode1v1Toggle';
import { useGameMode } from '../../../hooks/useGameMode';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { useT } from '../../../lib/i18n';
import { pickRating } from '../../../lib/gameStats';
import type { LeaderboardEntry, Declare2v2Response } from '../../../lib/api';

interface DeclareGameSheetProps {
  open: boolean;
  onClose: () => void;
  others: LeaderboardEntry[];
  recentOpponents: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  myLogin: string | undefined;
  locations?: Map<string, string>;
  onDone: () => Promise<void>;
  /**
   * Appelé quand un premier 2v2 ensemble est déclaré (myTeamIsNew === true).
   * La célébration est gérée par le parent (DefisMobile) pour éviter les
   * problèmes de cycle de vie liés au re-render de onDone/onClose.
   */
  onNewTeam?: (params: {
    teamId: string;
    teamElo: number;
    player1: { login: string; elo?: number };
    player2: { login: string; imageUrl?: string | null; elo?: number };
  }) => void;
}

/**
 * Wrapper du DeclareGameFlow dans une BottomSheet — version mobile.
 * Gère le toggle 1v1/2v2. La célébration nouveau duo est déléguée à onNewTeam
 * (géré par DefisMobile) pour garantir qu'elle s'affiche même après onClose.
 */
export function DeclareGameSheet({
  open,
  onClose,
  others,
  recentOpponents,
  opponentCounts,
  myLogin,
  locations,
  onDone,
  onNewTeam,
}: DeclareGameSheetProps) {
  const t = useT();
  const { game } = useGameMode();
  const { me } = useLeagueData();
  const [mode, setMode] = useState<DuelMode>('1v1');

  const myElo = me?.user ? pickRating(me.user, 'babyfoot').elo : undefined;

  const handleSubmitted1v1 = async () => {
    await onDone();
    onClose();
  };

  const handleSubmitted2v2 = async (result: Declare2v2Response, partnerLogin: string) => {
    // 1. Rafraîchir les données en arrière-plan
    await onDone();
    // 2. Fermer la sheet
    onClose();
    // 3. Signaler la célébration au parent (APRÈS onClose pour éviter les conflits)
    if (result.myTeamIsNew && myLogin && onNewTeam) {
      const partnerEntry =
        others.find((p) => p.login === partnerLogin) ??
        recentOpponents.find((p) => p.login === partnerLogin);
      onNewTeam({
        teamId: result.myTeamId,
        teamElo: Math.round(
          Math.max(myElo ?? 1000, partnerEntry?.elo ?? 1000) * 0.65 +
          Math.min(myElo ?? 1000, partnerEntry?.elo ?? 1000) * 0.35,
        ),
        player1: { login: myLogin, elo: myElo },
        player2: {
          login: partnerLogin,
          imageUrl: partnerEntry?.imageUrl,
          elo: partnerEntry?.elo,
        },
      });
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-baseline gap-2">
          <span className="gradient-text-brand">{t('defis.cta.declare')}</span>
        </div>
      }
      snap={92}
    >
      <div className="px-5 pt-4 pb-2">
        <Mode1v1Toggle mode={mode} onChange={setMode} game={game} className="mb-4" />
        {mode === '2v2' && game === 'babyfoot' ? (
          <Declare2v2GameFlow
            variant="mobile"
            others={others}
            recentOpponents={recentOpponents}
            opponentCounts={opponentCounts}
            myLogin={myLogin}
            myElo={myElo}
            locations={locations}
            onSubmitted={handleSubmitted2v2}
          />
        ) : (
          <DeclareGameFlow
            variant="mobile"
            others={others}
            recentOpponents={recentOpponents}
            opponentCounts={opponentCounts}
            myLogin={myLogin}
            locations={locations}
            onSubmitted={handleSubmitted1v1}
          />
        )}
      </div>
    </BottomSheet>
  );
}
