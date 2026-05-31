import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { PlayedMatch } from '../../../lib/api';
import { Avatar } from '../../../components/Avatar';
import { PlayerLink } from '../../../components/PlayerLink';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { useI18n, useT } from '../../../lib/i18n';
import { fmtDatePair } from '../../../lib/format';

interface RecentMatchesListProps {
  matches: PlayedMatch[];
  myLogin: string | undefined;
}

/**
 * Liste des matches récents pour le profil mobile.
 * Affiche W/L badge + adversaire + score + delta ELO + date.
 */
export function RecentMatchesList({ matches, myLogin }: RecentMatchesListProps) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-2">
        Aucun match enregistré.
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
        Voir tout l'historique
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
  const youWon = (youAreA && match.winner === 'A') || (!youAreA && match.winner === 'B');
  const opp = youAreA ? match.playerBLogin : match.playerALogin;
  const oppImg = leaderboard.find((u) => u.login === opp)?.imageUrl ?? null;
  const myScore = youAreA ? match.scoreA : match.scoreB;
  const oppScore = youAreA ? match.scoreB : match.scoreA;
  const delta = youAreA ? match.deltaA : match.deltaB;

  const date = fmtDatePair(match.playedAt, lang);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
        youWon
          ? 'border-teal/20 bg-teal/[0.04]'
          : 'border-red/20 bg-red/[0.04]'
      }`}
    >
      {/* W/L badge */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-mono font-black text-sm ${
          youWon ? 'bg-teal/15 text-teal' : 'bg-red/15 text-red'
        }`}
      >
        {youWon ? t('lb.abbr.win') : t('lb.abbr.loss')}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted">vs</span>
          <PlayerLink login={opp} className="min-w-0">
            <Avatar login={opp} imageUrl={oppImg} size="xs" />
            <span className="text-sm font-bold text-text-strong truncate">{opp}</span>
          </PlayerLink>
        </div>
        <div className="text-[10px] text-muted font-medium">
          {date.short}
          <span className="mx-1 opacity-40">·</span>
          <span className="text-muted-2">{date.long}</span>
        </div>
      </div>

      {/* Score */}
      <div className="font-mono tabular-nums text-sm font-extrabold">
        <span className={youWon ? 'text-teal' : 'text-text-strong'}>{myScore}</span>
        <span className="text-muted mx-1 opacity-60">–</span>
        <span className={youWon ? 'text-text-strong' : 'text-red'}>{oppScore}</span>
      </div>

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
