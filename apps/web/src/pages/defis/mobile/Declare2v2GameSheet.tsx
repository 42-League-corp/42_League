import { useState } from 'react';
import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { Declare2v2GameFlow } from '../shared/Declare2v2GameFlow';
import { TeamNameModal } from '../../../components/TeamNameModal';
import type { LeaderboardEntry, Declare2v2Response } from '../../../lib/api';

interface Declare2v2GameSheetProps {
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

/**
 * Wrapper du Declare2v2GameFlow dans une BottomSheet mobile.
 *
 * Gère également l'ouverture automatique de la TeamNameModal si le duo
 * formé par le déclarant et son partenaire est nouveau.
 */
export function Declare2v2GameSheet({
  open,
  onClose,
  others,
  recentOpponents,
  opponentCounts,
  myLogin,
  myElo,
  locations,
  onDone,
}: Declare2v2GameSheetProps) {
  const [teamModal, setTeamModal] = useState<{
    teamId: string;
    player1Login: string;
    player2Login: string;
  } | null>(null);

  const handleSubmitted = async (result: Declare2v2Response, partnerLogin: string) => {
    await onDone();
    onClose();
    // Si l'équipe formée par le déclarant est nouvelle, proposer de la nommer.
    if (result.myTeamIsNew && myLogin) {
      setTeamModal({
        teamId: result.myTeamId,
        player1Login: myLogin,
        player2Login: partnerLogin,
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
            <span className="gradient-text-brand">Déclarer une game</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-red/80 border border-red/30 px-2 py-0.5 rounded-full">
              2 vs 2
            </span>
          </div>
        }
        snap={96}
      >
        <div className="px-5 pt-4 pb-2">
          <Declare2v2GameFlow
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

      {/* Modale de naming — monte par-dessus tout, indépendante du sheet */}
      <TeamNameModal
        teamId={teamModal?.teamId ?? null}
        player1Login={teamModal?.player1Login ?? ''}
        player2Login={teamModal?.player2Login ?? ''}
        onClose={() => setTeamModal(null)}
      />
    </>
  );
}
