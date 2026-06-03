import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { PlayerLink } from '../../../components/PlayerLink';
import type { Game, PlayedMatch } from '../../../lib/api';
import { fmtDatePair } from '../../../lib/format';
import { useT, type Lang } from '../../../lib/i18n';
import type { MyMatchStat } from './useHistoriqueLogic';

// ─── Pastille de discipline ──────────────────────────────────────────────────
const GAME_BADGE: Record<string, string> = {
  babyfoot: '⚽',
  smash: '🎮',
  chess: '♟',
  streetfighter: '🥊',
};
/** Petite pastille indiquant la discipline d'un match. */
export function GamePill({ game }: { game?: Game }) {
  const g = game ?? 'babyfoot';
  if (g === 'babyfoot') return null; // discipline par défaut : pas de pastille
  return (
    <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
      {GAME_BADGE[g] ?? g}
    </span>
  );
}

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
  lang: Lang;
  imageUrl?: string | null;
  delay?: number;
}

export function MyMatchCard({ stat, lang, imageUrl, delay = 0 }: MyMatchCardProps) {
  const t = useT();
  const { won, opponent, myScore, oppScore, delta, counted, wrAfter, wrImpact } = stat;
  const game = stat.match.game;
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
        {won ? t('lb.abbr.win') : t('lb.abbr.loss')}
      </div>

      <Avatar login={opponent} imageUrl={imageUrl ?? null} size="sm" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted">vs</span>
          <PlayerLink login={opponent} className="text-sm font-bold text-text-strong truncate">
            {opponent}
          </PlayerLink>
          <GamePill game={game} />
        </div>
        <div className="mt-1">
          <WinRateImpact wrAfter={wrAfter} wrImpact={wrImpact} />
        </div>
        <div className="text-[10px] text-muted font-medium mt-0.5">
          {fmtDatePair(stat.match.playedAt, lang).short}
          <span className="mx-1 opacity-40">·</span>
          <span className="text-muted-2">{fmtDatePair(stat.match.playedAt, lang).long}</span>
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
  lang: Lang;
  imgByLogin: Map<string, string | null>;
  delay?: number;
}

/**
 * Carte « game de la league » (historique global) — affichage tête-à-tête :
 * le VAINQUEUR à gauche (🏆 + avatar + nom + Δ ELO), le score au centre, et le
 * PERDANT à droite (nom + Δ ELO + avatar), en miroir.
 */
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
      className="relative card-hud rounded-2xl p-3.5 flex items-center gap-2.5 hover-glow border border-gold/25"
    >
      {/* Vainqueur — gauche */}
      <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-gold/15 text-base">
        🏆
      </div>

      <Avatar login={winnerLogin} imageUrl={imgByLogin.get(winnerLogin) ?? null} size="sm" />

      <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
        <PlayerLink login={winnerLogin} className="text-sm font-bold text-gold truncate max-w-full">
          {winnerLogin}
        </PlayerLink>
        <EloDeltaPill delta={winnerDelta} counted={match.countedForElo} />
      </div>

      {/* Score + date — centre */}
      <div className="flex-shrink-0 flex flex-col items-center gap-0.5 px-1">
        {match.game === 'chess' ? (
          /* Échecs : affiche Victoire / Défaite plutôt qu'un score 1-0 brut */
          <div className="text-[11px] font-extrabold text-gold text-gold-emboss uppercase tracking-wide whitespace-nowrap">
            Victoire
          </div>
        ) : (
          <div className="font-display tabular-nums text-base font-black">
            <span className="text-gold text-gold-emboss">{winnerScore}</span>
            <span className="text-muted mx-1 opacity-60">–</span>
            <span className="text-text-strong">{loserScore}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <GamePill game={match.game} />
          <div className="text-[10px] text-muted font-medium whitespace-nowrap">
            {fmtDatePair(match.playedAt, lang).short}
          </div>
        </div>
      </div>

      {/* Perdant — droite (miroir) */}
      <div className="flex-1 min-w-0 flex flex-col items-end gap-1">
        <PlayerLink login={loserLogin} className="text-sm font-semibold text-muted-2 truncate max-w-full text-right">
          {loserLogin}
        </PlayerLink>
        <EloDeltaPill delta={loserDelta} counted={match.countedForElo} />
      </div>

      <Avatar login={loserLogin} imageUrl={imgByLogin.get(loserLogin) ?? null} size="sm" />
    </motion.div>
  );
}
