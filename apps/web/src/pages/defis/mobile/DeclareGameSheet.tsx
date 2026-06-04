import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { DeclareGameFlow } from '../shared/DeclareGameFlow';
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
        <DeclareGameFlow
          variant="mobile"
          others={others}
          recentOpponents={recentOpponents}
          opponentCounts={opponentCounts}
          myLogin={myLogin}
          locations={locations}
          onSubmitted={handleSubmitted}
        />
      </div>
    </BottomSheet>
  );
}
