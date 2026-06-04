import { useState } from 'react';
import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { Declare2v2GameFlow } from '../shared/Declare2v2GameFlow';
import { NewTeamCelebration } from '../../../components/NewTeamCelebration';
import { useT } from '../../../lib/i18n';
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

interface CelebState {
  teamId: string;
  teamElo: number;
  player1: { login: string; imageUrl?: string | null; elo?: number };
  player2: { login: string; imageUrl?: string | null; elo?: number };
}

/**
 * Wrapper du Declare2v2GameFlow dans une BottomSheet mobile.
 *
 * Quand un nouveau duo est détecté (`myTeamIsNew === true`), remplace
 * la TeamNameModal par la NewTeamCelebration — animation plein écran qui
 * intègre le naming et redirige ensuite vers la page équipe.
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
  const t = useT();
  const [celebration, setCelebration] = useState<CelebState | null>(null);

  const handleSubmitted = async (result: Declare2v2Response, partnerLogin: string) => {
    await onDone();
    onClose();

    if (result.myTeamIsNew && myLogin) {
      // Enrichit avec les données du partenaire depuis le classement.
      const partnerEntry = others.find((p) => p.login === partnerLogin)
        ?? recentOpponents.find((p) => p.login === partnerLogin);

      setCelebration({
        teamId: result.myTeamId,
        // ELO équipe calculé côté back (65 / 35) — on l'approche localement
        // pour l'affichage immédiat (avant fetch de la vraie page équipe).
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

      {/* Célébration plein-écran — remplace TeamNameModal pour les nouveaux duos */}
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
