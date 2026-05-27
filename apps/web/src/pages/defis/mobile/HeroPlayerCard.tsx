import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Crown, Flame, MapPin, Trophy, Zap } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { AnimatedCounter } from '../../../mobile/primitives/AnimatedCounter';
import { useLeagueData } from '../../../hooks/useLeagueData';

/**
 * Hero card "NBA 2K" du joueur — pièce maîtresse de la page Défis mobile.
 *
 * Features visuelles :
 * - Background holographique animé (conic gradient qui tourne)
 * - Shimmer layer en surimpression
 * - Border néon teal avec glow
 * - Rank badge (couronne/médaille/star) en haut à droite
 * - Avatar XL avec ring néon
 * - ELO en monospace géant avec count-up à l'apparition
 * - Stats row : W / L / WIN% + streak en feu
 * - Footer : trophées débloqués, % du top
 */
export function HeroPlayerCard() {
  const { me, matches, leaderboard } = useLeagueData();
  const user = me?.user;
  const myLogin = me?.login;
  const reducedMotion = useReducedMotion();

  const stats = useMemo(() => {
    if (!user || !myLogin) {
      return { wins: 0, losses: 0, total: 0, winRate: 0, streak: 0, rank: 0 };
    }
    const mine = matches
      .filter((m) => m.playerALogin === myLogin || m.playerBLogin === myLogin)
      .sort((a, b) => +new Date(b.playedAt) - +new Date(a.playedAt));
    let wins = 0;
    let losses = 0;
    let streak = 0;
    let streakBroken = false;
    for (const m of mine) {
      const youAreA = m.playerALogin === myLogin;
      const youWon = (youAreA && m.winner === 'A') || (!youAreA && m.winner === 'B');
      if (youWon) wins++;
      else losses++;
      if (!streakBroken) {
        if (youWon) streak++;
        else streakBroken = true;
      }
    }
    const total = wins + losses;
    const winRate = total === 0 ? 0 : Math.round((wins / total) * 100);
    const rank = leaderboard.find((u) => u.login === myLogin)?.rank ?? 0;
    return { wins, losses, total, winRate, streak, rank };
  }, [user, myLogin, matches, leaderboard]);

  if (!user) return null;

  const isTop1 = stats.rank === 1;
  const isTop3 = stats.rank > 0 && stats.rank <= 3;
  const isTop10 = stats.rank > 0 && stats.rank <= 10;
  const topPercent = leaderboard.length > 0 && stats.rank > 0
    ? Math.max(1, Math.round((stats.rank / leaderboard.length) * 100))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-3xl border border-teal/40 neon-border no-select gpu"
      style={{
        background:
          'linear-gradient(135deg, rgba(0,217,220,0.06) 0%, rgba(17,24,39,0.95) 50%, rgba(255,183,27,0.04) 100%)',
        boxShadow:
          '0 12px 32px -8px rgba(0,217,220,0.25), 0 0 0 1px rgba(0,217,220,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Couche 1 : conic gradient qui tourne très lentement (effet holographique).
          Désactivé en prefers-reduced-motion pour la batterie + accessibilité. */}
      {!reducedMotion && (
        <motion.div
          aria-hidden
          className="absolute inset-0 opacity-30 pointer-events-none gpu"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(0,217,220,0.3) 60deg, transparent 120deg, rgba(255,183,27,0.2) 200deg, transparent 260deg, rgba(0,217,220,0.2) 340deg, transparent 360deg)',
            filter: 'blur(40px)',
            willChange: 'transform',
          }}
        />
      )}

      {/* Couche 2 : shimmer subtil */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-20 pointer-events-none shimmer"
      />

      {/* Couche 3 : grille technique (cyber feel) */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,217,220,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,220,1) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* CONTENU */}
      <div className="relative z-10 px-5 pt-5 pb-4 flex flex-col items-center text-center">
        {/* Rank badge top-right */}
        {stats.rank > 0 && (
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.3 }}
            className={`absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs font-extrabold tabular-nums tracking-wide ${
              isTop1
                ? 'bg-gradient-to-br from-gold to-[#d6920b] text-[#1a1100] shadow-gold-glow'
                : isTop3
                  ? 'bg-bg-1/80 text-gold border border-gold/40 backdrop-blur'
                  : isTop10
                    ? 'bg-bg-1/80 text-teal border border-teal/40 backdrop-blur'
                    : 'bg-bg-1/80 text-muted-2 border border-border backdrop-blur'
            }`}
          >
            {isTop1 && <Crown className="w-3 h-3" strokeWidth={2.5} />}
            <span>#{stats.rank}</span>
          </motion.div>
        )}

        {/* Avatar XL avec ring */}
        <div className="relative mb-3">
          <div
            className="absolute -inset-2 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(0,217,220,0.3) 0%, transparent 70%)',
              filter: 'blur(8px)',
            }}
          />
          <Avatar
            login={user.login}
            imageUrl={user.imageUrl}
            size="xl"
            className="relative ring-2 ring-teal/60 ring-offset-2 ring-offset-bg-1"
          />
        </div>

        {/* Login + title + campus */}
        <div className="mb-4">
          <h2 className="text-xl font-extrabold text-text-strong tracking-tight">
            {user.login}
          </h2>
          {user.title && (
            <div className="text-[11px] text-gold italic mt-0.5 px-2 truncate max-w-[260px]">
              « {user.title} »
            </div>
          )}
          {user.campus && (
            <div className="inline-flex items-center gap-1 text-[10px] text-muted mt-1 font-medium uppercase tracking-wider">
              <MapPin className="w-3 h-3" strokeWidth={2.5} />
              <span>{user.campus}</span>
            </div>
          )}
        </div>

        {/* ELO géant */}
        <div className="relative mb-1">
          <div
            className="font-mono text-[64px] font-black leading-none tabular-nums tracking-tighter text-teal"
            style={{
              textShadow:
                '0 0 24px rgba(0,217,220,0.5), 0 0 48px rgba(0,217,220,0.3), 0 2px 0 rgba(0,0,0,0.4)',
            }}
          >
            <AnimatedCounter value={user.elo} duration={1.4} />
          </div>
          <div className="text-[10px] text-muted uppercase tracking-[0.32em] font-extrabold mt-0.5">
            ELO
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-5 w-full grid grid-cols-4 gap-2">
          <StatBlock label="W" value={stats.wins} tone="teal" />
          <StatBlock label="L" value={stats.losses} tone="red" />
          <StatBlock label="WR" value={`${stats.winRate}%`} tone="gold" />
          <StatBlock
            label="STREAK"
            value={stats.streak}
            tone={stats.streak >= 3 ? 'fire' : 'muted'}
            icon={stats.streak >= 3 ? <Flame className="w-3 h-3" strokeWidth={2.5} /> : undefined}
          />
        </div>

        {/* Footer infos */}
        {(user.tournamentsWon > 0 || topPercent > 0) && (
          <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-muted-2 font-medium uppercase tracking-wider w-full pt-3 border-t border-border/40">
            {user.tournamentsWon > 0 && (
              <div className="flex items-center gap-1 text-gold">
                <Trophy className="w-3 h-3" strokeWidth={2.5} />
                <span className="font-mono tabular-nums">{user.tournamentsWon}</span>
                <span>tournoi{user.tournamentsWon > 1 ? 's' : ''}</span>
              </div>
            )}
            {topPercent > 0 && (
              <div className="flex items-center gap-1 text-teal">
                <Zap className="w-3 h-3" strokeWidth={2.5} />
                <span>Top {topPercent}%</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface StatBlockProps {
  label: string;
  value: number | string;
  tone: 'teal' | 'red' | 'gold' | 'fire' | 'muted';
  icon?: React.ReactNode;
}

const TONE: Record<StatBlockProps['tone'], string> = {
  teal: 'text-teal',
  red: 'text-red',
  gold: 'text-gold',
  fire: 'text-gold animate-pulse',
  muted: 'text-muted-2',
};

function StatBlock({ label, value, tone, icon }: StatBlockProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg bg-bg-1/40 border border-border/40">
      <div className={`text-base font-extrabold tabular-nums font-mono leading-none flex items-center gap-1 ${TONE[tone]}`}>
        {icon}
        <span>{value}</span>
      </div>
      <div className="text-[9px] text-muted uppercase tracking-wider font-bold leading-none">
        {label}
      </div>
    </div>
  );
}
