import { useState } from 'react';
import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { DeclareGameFlow } from '../shared/DeclareGameFlow';
import { Declare2v2GameFlow } from '../shared/Declare2v2GameFlow';
import { Mode1v1Toggle, type DuelMode } from '../shared/Mode1v1Toggle';
import { useGameMode } from '../../../hooks/useGameMode';
import { useT } from '../../../lib/i18n';
import type { LeaderboardEntry } from '../../../lib/api';

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

/**
 * Wrapper du DeclareGameFlow dans une BottomSheet — version mobile.
 * La sheet se ferme automatiquement après une déclaration réussie.
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
  const [mode, setMode] = useState<DuelMode>('1v1');
  const handleSubmitted = async () => {
    await onDone();
    onClose();
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
        {/* Toggle 1v1 / 2v2 — babyfoot uniquement. */}
        <Mode1v1Toggle mode={mode} onChange={setMode} game={game} className="mb-4" />
        {mode === '2v2' && game === 'babyfoot' ? (
          <Declare2v2GameFlow
            variant="mobile"
            others={others}
            recentOpponents={recentOpponents}
            opponentCounts={opponentCounts}
            myLogin={myLogin}
            locations={locations}
            onSubmitted={handleSubmitted}
          />
        ) : (
          <DeclareGameFlow
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
