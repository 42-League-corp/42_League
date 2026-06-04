import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { DeclareFfaGameFlow } from '../shared/DeclareFfaGameFlow';
import { useT } from '../../../lib/i18n';
import type { LeaderboardEntry } from '../../../lib/api';

interface DeclareFfaGameSheetProps {
  open: boolean;
  onClose: () => void;
  others: LeaderboardEntry[];
  recentOpponents: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  myLogin: string | undefined;
  myElo?: number;
  locations?: Map<string, string>;
  onDone: () => Promise<void>;
}

/** Wrapper du DeclareFfaGameFlow dans une BottomSheet mobile (Smash uniquement). */
export function DeclareFfaGameSheet({
  open,
  onClose,
  others,
  recentOpponents,
  opponentCounts,
  myLogin,
  myElo,
  locations,
  onDone,
}: DeclareFfaGameSheetProps) {
  const t = useT();

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
          <span className="gradient-text-brand">{t('ffa.cta.title')}</span>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-red/80 border border-red/30 px-2 py-0.5 rounded-full">
            FFA
          </span>
        </div>
      }
      snap={96}
    >
      <div className="px-5 pt-4 pb-2">
        <DeclareFfaGameFlow
          variant="mobile"
          others={others}
          recentOpponents={recentOpponents}
          opponentCounts={opponentCounts}
          myLogin={myLogin}
          myElo={myElo}
          locations={locations}
          onSubmitted={handleSubmitted}
        />
      </div>
    </BottomSheet>
  );
}
