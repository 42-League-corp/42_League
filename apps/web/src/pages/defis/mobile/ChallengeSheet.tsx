import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { ChallengeFlow } from '../shared/ChallengeFlow';
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
  const handleSubmitted = async () => {
    await onDone();
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={<span className="gradient-text-brand">Défier un joueur</span>}
      snap={92}
    >
      <div className="px-5 pt-4 pb-2">
        <ChallengeFlow
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
