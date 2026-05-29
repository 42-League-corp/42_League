import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { PlayerLink } from '../../../components/PlayerLink';
import type { PlayedMatch } from '../../../lib/api';
import { fmtDayLabel } from '../../../lib/format';
import type { MyMatchStat } from './useHistoriqueLogic';

// ─── Badges réutilisables ────────────────────────────────────────────────────

/** Pastille « +15 ELO » verte / « -5 » rouge. */
export function EloDeltaPill({ delta, counted }: { delta: number; counted: boolean }) {
  if (!counted) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold text-muted-2 bg-bg-2/60 border border-border">
        hors ELO
      </span>
    );
  }
  const positive = delta > 0;
  const neutral = delta === 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-extrabold tabular-nums border ${
        neutral
          ? 'text-muted-2 bg-bg-2/60 border-border'
          : positive
            ? 'text-accent bg-accent/10 border-accent/30'
            : 'text-red bg-red/10 border-red/30'
      }`}
    >
      {positive ? '+' : ''}
      {delta}
      <span className="opacity-70 font-sans ml-0.5">ELO</span>
    </span>
  );
}

/** Impact win-rate : « 54% ▲ » (vert) / « 48% ▼ » (rouge). */
export function WinRateImpact({ wrAfter, wrImpact }: { wrAfter: number; wrImpact: number }) {
  const up = wrImpact > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-2">
      <span className="font-mono tabular-nums text-muted-2">WR {wrAfter}%</span>
      <span className={`inline-flex items-center gap-0.5 ${up ? 'text-accent' : 'text-red'}`}>
        <Icon className="w-3 h-3" strokeWidth={2.75} />
        <span className="font-mono tabular-nums">
          {up ? '+' : ''}
          {wrImpact.toFixed(1)}
        </span>
      </span>
    </span>
  );
}

// ─── Carte « ma game » (historique perso) ────────────────────────────────────

interface MyMatchCardProps {
  stat: MyMatchStat;
  lang: 'fr' | 'en';
  imageUrl?: string | null;
  delay?: number;
}

export function MyMatchCard({ stat, lang, imageUrl, delay = 0 }: MyMatchCardProps) {
  const { won, opponent, myScore, oppScore, delta, counted, wrAfter, wrImpact } = stat;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className={`relative card-hud rounded-2xl p-3.5 flex items-center gap-3 hover-glow border ${
        won ? 'border-accent/25' : 'border-red/20'
      }`}
    >
      {/* Badge W/L */}
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-display font-black text-sm ${
          won ? 'bg-accent/15 text-accent' : 'bg-red/15 text-red'
        }`}
      >
        {won ? 'W' : 'L'}
      </div>

      <Avatar login={opponent} imageUrl={imageUrl ?? null} size="sm" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted">vs</span>
          <PlayerLink login={opponent} className="text-sm font-bold text-text-strong truncate">
            {opponent}
          </PlayerLink>
        </div>
        <div className="mt-1">
          <WinRateImpact wrAfter={wrAfter} wrImpact={wrImpact} />
        </div>
        <div className="text-[10px] text-muted font-medium mt-0.5">
          {fmtDayLabel(stat.match.playedAt, lang)}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <div className="font-display tabular-nums text-base font-black">
          <span className={won ? 'text-accent' : 'text-text-strong'}>{myScore}</span>
          <span className="text-muted mx-1 opacity-60">–</span>
          <span className={won ? 'text-text-strong' : 'text-red'}>{oppScore}</span>
        </div>
        <EloDeltaPill delta={delta} counted={counted} />
      </div>
    </motion.div>
  );
}

// ─── Carte « game de la league » (historique global) ─────────────────────────

interface GlobalMatchCardProps {
  match: PlayedMatch;
  lang: 'fr' | 'en';
  imgByLogin: Map<string, string | null>;
  delay?: number;
}

export function GlobalMatchCard({ match, lang, imgByLogin, delay = 0 }: GlobalMatchCardProps) {
  const aWon = match.winner === 'A';
  const winnerLogin = aWon ? match.playerALogin : match.playerBLogin;
  const loserLogin = aWon ? match.playerBLogin : match.playerALogin;
  const winnerScore = aWon ? match.scoreA : match.scoreB;
  const loserScore = aWon ? match.scoreB : match.scoreA;
  const winnerDelta = aWon ? match.deltaA : match.deltaB;
  const loserDelta = aWon ? match.deltaB : match.deltaA;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="relative card-hud rounded-2xl p-3.5 hover-glow"
    >
      {/* Ligne gagnant */}
      <PlayerRow
        login={winnerLogin}
        imageUrl={imgByLogin.get(winnerLogin) ?? null}
        score={winnerScore}
        delta={winnerDelta}
        counted={match.countedForElo}
        winner
      />
      <div className="my-2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      {/* Ligne perdant */}
      <PlayerRow
        login={loserLogin}
        imageUrl={imgByLogin.get(loserLogin) ?? null}
        score={loserScore}
        delta={loserDelta}
        counted={match.countedForElo}
      />

      <div className="mt-2.5 text-[10px] text-muted font-medium text-right">
        {fmtDayLabel(match.playedAt, lang)}
      </div>
    </motion.div>
  );
}

interface PlayerRowProps {
  login: string;
  imageUrl: string | null;
  score: number;
  delta: number;
  counted: boolean;
  winner?: boolean;
}

function PlayerRow({ login, imageUrl, score, delta, counted, winner = false }: PlayerRowProps) {
  return (
    <div className="flex items-center gap-2.5">
      {winner ? (
        <span aria-hidden className="text-sm w-5 text-center">🏆</span>
      ) : (
        <span aria-hidden className="w-5 text-center text-muted-2 text-xs">·</span>
      )}
      <Avatar login={login} imageUrl={imageUrl} size="sm" />
      <PlayerLink
        login={login}
        className={`flex-1 min-w-0 text-sm font-bold truncate ${
          winner ? 'text-gold' : 'text-muted-2'
        }`}
      >
        {login}
      </PlayerLink>
      <span
        className={`font-display tabular-nums text-base font-black ${
          winner ? 'text-gold text-gold-emboss' : 'text-text-strong'
        }`}
      >
        {score}
      </span>
      <div className="w-[68px] flex justify-end">
        <EloDeltaPill delta={delta} counted={counted} />
      </div>
    </div>
  );
}
