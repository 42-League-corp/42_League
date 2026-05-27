import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { DeclareGameFlow } from '../shared/DeclareGameFlow';
import type { LeaderboardEntry } from '../../../lib/api';

interface DeclareGameSheetProps {
  open: boolean;
  onClose: () => void;
  others: LeaderboardEntry[];
  recentOpponents: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  myLogin: string | undefined;
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
  onDone,
}: DeclareGameSheetProps) {
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
          <span className="gradient-text-brand">Déclarer une game</span>
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
          onSubmitted={handleSubmitted}
        />
      </div>
    </BottomSheet>
  );
}
