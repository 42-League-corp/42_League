import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
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

interface RecentMatchesListProps {
  matches: PlayedMatch[];
  myLogin: string | undefined;
}

/**
 * Liste des matches récents pour le profil mobile.
 * Affiche W/L badge + adversaire + score + delta ELO + date.
 */
export function RecentMatchesList({ matches, myLogin }: RecentMatchesListProps) {
  const t = useT();
  if (matches.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-2">
        {t('profil.noMatchYet')}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {matches.map((m, i) => (
        <RecentMatchRow key={m.id} match={m} myLogin={myLogin} delay={i * 0.03} />
      ))}
      <Link
        to="/history"
        className="flex items-center justify-center gap-1 py-2.5 mt-2 text-xs font-bold text-muted-2 hover:text-teal uppercase tracking-wider tap-transparent transition-colors"
      >
        {t('profil.seeFullHistory')}
        <ChevronRight className="w-3 h-3" strokeWidth={2.5} />
      </Link>
    </div>
  );
}

interface RecentMatchRowProps {
  match: PlayedMatch;
  myLogin: string | undefined;
  delay: number;
}

function RecentMatchRow({ match, myLogin, delay }: RecentMatchRowProps) {
  const t = useT();
  const { lang } = useI18n();
  const { leaderboard } = useLeagueData();
  const youAreA = match.playerALogin === myLogin;
  const outcome = outcomeFor(match, myLogin ?? '');
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
      {/* V / N / D badge */}
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-mono font-black text-sm ${
          isDraw ? 'bg-gold/15 text-gold' : youWon ? 'bg-teal/15 text-teal' : 'bg-red/15 text-red'
        }`}
      >
        {isDraw ? t('lb.abbr.draw') : youWon ? t('lb.abbr.win') : t('lb.abbr.loss')}
      </div>

      {/* Adversaire : avatar en ancre à gauche, puis nom + méta en colonne.
          Tout le bloc est un seul lien (un seul tap-target, une seule hover-card). */}
      <PlayerLink login={opp} className="flex-1 min-w-0 gap-2.5">
        <Avatar login={opp} imageUrl={oppImg} size="sm" />
        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] text-muted shrink-0">vs</span>
            <span className="text-sm font-bold text-text-strong truncate">{opp}</span>
            {isSmash && oppChar && <SmashCharIcon id={oppChar} size={16} className="shrink-0" />}
            {isSf && oppChar && <SfCharIcon id={oppChar} size={16} className="shrink-0" />}
            <GamePill game={match.game} />
          </div>
          <div className="text-[10px] text-muted font-medium mt-0.5">
            {date.short}
            <span className="mx-1 opacity-40">·</span>
            <span className="text-muted-2">{date.long}</span>
          </div>
        </div>
      </PlayerLink>

      {/* Score atomic — rendu par discipline */}
      <MatchScore
        game={match.game}
        winnerScore={winnerScore}
        loserScore={loserScore}
        myPerspective={outcome}
        bestOf={match.bestOf}
        compact
      />

      {/* Delta ELO */}
      {match.countedForElo && (
        <div
          className={`text-[10px] font-mono tabular-nums font-extrabold min-w-[36px] text-right ${
            delta > 0 ? 'text-teal' : delta < 0 ? 'text-red' : 'text-muted'
          }`}
        >
          {delta > 0 ? '+' : ''}
          {delta}
        </div>
      )}
    </motion.div>
  );
}
