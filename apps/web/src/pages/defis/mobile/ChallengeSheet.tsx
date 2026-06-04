import { useState } from 'react';
import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { ChallengeFlow } from '../shared/ChallengeFlow';
import { Challenge2v2Flow } from '../shared/Challenge2v2Flow';
import { Mode1v1Toggle, type DuelMode } from '../shared/Mode1v1Toggle';
import { useGameMode } from '../../../hooks/useGameMode';
import { useT } from '../../../lib/i18n';
import type { LeaderboardEntry } from '../../../lib/api';

interface ChallengeSheetProps {
  open: boolean;
  onClose: () => void;
  others: LeaderboardEntry[];
  recentOpponents: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  myLogin: string | undefined;
  locations?: Map<string, string>;
  onDone: () => Promise<void>;
}

/**
 * Wrapper du ChallengeFlow dans une BottomSheet — pendant mobile de la
 * DeclareGameSheet. Se ferme automatiquement après un défi envoyé.
 */
export function ChallengeSheet({
  open,
  onClose,
  others,
  recentOpponents,
  opponentCounts,
  myLogin,
  locations,
  onDone,
}: ChallengeSheetProps) {
  const t = useT();
  const { game } = useGameMode();
  const [mode, setMode] = useState<DuelMode>('1v1');
  const handleSubmitted = async () => {
    await onDone();
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={<span className="gradient-text-brand">{t('defis.cta.challenge')}</span>}
      snap={92}
    >
      <div className="px-5 pt-4 pb-2">
        {/* Toggle 1v1 / 2v2 — babyfoot uniquement. */}
        <Mode1v1Toggle mode={mode} onChange={setMode} game={game} className="mb-4" />
        {mode === '2v2' && game === 'babyfoot' ? (
          <Challenge2v2Flow
            variant="mobile"
            others={others}
            recentOpponents={recentOpponents}
            opponentCounts={opponentCounts}
            myLogin={myLogin}
            locations={locations}
            onSubmitted={handleSubmitted}
          />
        ) : (
          <ChallengeFlow
            variant="mobile"
            others={others}
            recentOpponents={recentOpponents}
            opponentCounts={opponentCounts}
            myLogin={myLogin}
            locations={locations}
            onSubmitted={handleSubmitted}
          />
        )}
      </div>
    </BottomSheet>
  );
}
