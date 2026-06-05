import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { DeclareDartsGameFlow } from '../shared/DeclareDartsGameFlow';
import { useT } from '../../../lib/i18n';
import type { LeaderboardEntry } from '../../../lib/api';

interface DeclareDartsGameSheetProps {
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

/** Wrapper du DeclareDartsGameFlow dans une BottomSheet mobile (Fléchettes uniquement). */
export function DeclareDartsGameSheet({
  open,
  onClose,
  others,
  recentOpponents,
  opponentCounts,
  myLogin,
  myElo,
  locations,
  onDone,
}: DeclareDartsGameSheetProps) {
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
          <span style={{ color: '#14b8a6' }}>🎯 {t('darts.cta.title')}</span>
          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border" style={{ color: 'rgba(20,184,166,0.85)', borderColor: 'rgba(20,184,166,0.3)' }}>
            301/501
          </span>
        </div>
      }
      snap={96}
    >
      <div className="px-5 pt-4 pb-2">
        <DeclareDartsGameFlow
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
