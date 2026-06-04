import { useState } from 'react';
import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { DeclareGameFlow } from '../shared/DeclareGameFlow';
import { Declare2v2GameFlow } from '../shared/Declare2v2GameFlow';
import { NewTeamCelebration } from '../../../components/NewTeamCelebration';
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
}

interface CelebState {
  teamId: string;
  teamElo: number;
  player1: { login: string; imageUrl?: string | null; elo?: number };
  player2: { login: string; imageUrl?: string | null; elo?: number };
}

/**
 * Wrapper du DeclareGameFlow dans une BottomSheet — version mobile.
 * Gère le toggle 1v1/2v2 et la célébration de nouveau duo.
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
}: DeclareGameSheetProps) {
  const t = useT();
  const { game } = useGameMode();
  const { me } = useLeagueData();
  const [mode, setMode] = useState<DuelMode>('1v1');
  const [celebration, setCelebration] = useState<CelebState | null>(null);

  const myElo = me?.user ? pickRating(me.user, 'babyfoot').elo : undefined;

  // Callback 1v1 — simple fermeture
  const handleSubmitted1v1 = async () => {
    await onDone();
    onClose();
  };

  // Callback 2v2 — ferme la sheet ET déclenche la célébration si nouveau duo
  const handleSubmitted2v2 = async (result: Declare2v2Response, partnerLogin: string) => {
    await onDone();
    onClose();

    if (result.myTeamIsNew && myLogin) {
      const partnerEntry =
        others.find((p) => p.login === partnerLogin) ??
        recentOpponents.find((p) => p.login === partnerLogin);

      setCelebration({
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
    <>
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
          {/* Toggle 1v1 / 2v2 — babyfoot uniquement. */}
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

      {/* Célébration plein-écran pour un nouveau duo */}
      {celebration && (
        <NewTeamCelebration
          teamId={celebration.teamId}
          teamElo={celebration.teamElo}
          player1={celebration.player1}
          player2={celebration.player2}
          onClose={() => setCelebration(null)}
        />
      )}
    </>
  );
}
