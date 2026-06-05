import { motion } from 'framer-motion';
import type { PlayedMatch } from '../../../lib/api';
import { Avatar } from '../../../components/Avatar';
import { PlayerLink } from '../../../components/PlayerLink';
import { SmashCharIcon } from '../../../components/SmashCharIcon';
import { SfCharIcon } from '../../../components/SfCharIcon';
import { GamePill, MatchScore } from '../../../components/MatchScore';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { useI18n, useT } from '../../../lib/i18n';
import { fmtDatePair } from '../../../lib/format';
import { outcomeFor } from '../../../lib/playerStats';

interface RecentMatchRowProps {
  match: PlayedMatch;
  /** Login du joueur dont on consulte le profil (perspective « moi »). */
  ownerLogin: string;
  /** Délai d'apparition (stagger) — 0 par défaut. */
  delay?: number;
}

/**
 * Ligne d'historique de match — rendu UNIQUE partagé entre le profil desktop et
 * mobile (avant : un tableau brut sans photo côté desktop, des cartes côté
 * mobile). Agencement harmonisé en 3 zones alignées d'une ligne à l'autre :
 *   [badge V/N/D] [avatar + nom + date]          [score]  [Δ elo]
 * Les zones de droite ont des largeurs fixes → colonnes alignées, pas tassées.
 * Couleurs conservées : or = nul, teal = victoire, rouge = défaite.
 */
export function RecentMatchRow({ match, ownerLogin, delay = 0 }: RecentMatchRowProps) {
  const t = useT();
  const { lang } = useI18n();
  const { leaderboard } = useLeagueData();

  const youAreA = match.playerALogin === ownerLogin;
  const outcome = outcomeFor(match, ownerLogin);
  const youWon = outcome === 'win';
  const isDraw = outcome === 'draw';
  const opp = youAreA ? match.playerBLogin : match.playerALogin;
  const oppImg = leaderboard.find((u) => u.login === opp)?.imageUrl ?? null;
  const isSmash = match.game === 'smash';
  const isSf = match.game === 'streetfighter';
  const oppChar = youAreA ? match.charB : match.charA;
  const winnerScore = youWon ? (youAreA ? match.scoreA : match.scoreB) : (youAreA ? match.scoreB : match.scoreA);
  const loserScore = youWon ? (youAreA ? match.scoreB : match.scoreA) : (youAreA ? match.scoreA : match.scoreB);
  const delta = youAreA ? match.deltaA : match.deltaB;
  const date = fmtDatePair(match.playedAt, lang);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
        isDraw
          ? 'border-gold/20 bg-gold/[0.04]'
          : youWon
            ? 'border-teal/20 bg-teal/[0.04]'
            : 'border-red/20 bg-red/[0.04]'
      }`}
    >
      {/* Badge résultat V / N / D — carré fixe */}
      <div
        className={`flex-shrink-0 grid place-items-center w-9 h-9 rounded-lg font-mono font-black text-sm ${
          isDraw ? 'bg-gold/15 text-gold' : youWon ? 'bg-teal/15 text-teal' : 'bg-red/15 text-red'
        }`}
      >
        {isDraw ? t('lb.abbr.draw') : youWon ? t('lb.abbr.win') : t('lb.abbr.loss')}
      </div>

      {/* Adversaire : avatar + nom + date — tout le bloc est un seul lien. */}
      <PlayerLink login={opp} className="flex-1 min-w-0 items-center gap-2.5">
        <Avatar login={opp} imageUrl={oppImg} size="sm" />
        <div className="min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-bold text-text-strong truncate leading-none">{opp}</span>
            {isSmash && oppChar && <SmashCharIcon id={oppChar} size={16} className="shrink-0" />}
            {isSf && oppChar && <SfCharIcon id={oppChar} size={16} className="shrink-0" />}
            <GamePill game={match.game} />
          </div>
          <span className="text-[11px] text-muted-2 font-medium tabular-nums leading-none">
            {date.short}
            <span className="mx-1 opacity-40">·</span>
            {date.long}
          </span>
        </div>
      </PlayerLink>

      {/* Score — zone alignée à droite, largeur mini constante. */}
      <div className="flex-shrink-0 flex justify-end min-w-[46px]">
        <MatchScore
          game={match.game}
          winnerScore={winnerScore}
          loserScore={loserScore}
          myPerspective={outcome}
          bestOf={match.bestOf}
          compact
        />
      </div>

      {/* Delta ELO — colonne fixe (espace réservé même sans delta pour aligner). */}
      <div
        className={`flex-shrink-0 w-11 text-right text-xs font-mono font-extrabold tabular-nums ${
          !match.countedForElo
            ? 'opacity-0'
            : delta > 0
              ? 'text-teal'
              : delta < 0
                ? 'text-red'
                : 'text-muted'
        }`}
      >
        {match.countedForElo ? `${delta > 0 ? '+' : ''}${delta}` : '+0'}
      </div>
    </motion.div>
  );
}
