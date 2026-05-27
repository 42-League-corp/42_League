import { motion, useReducedMotion } from 'framer-motion';
import { Crown, Flame, MapPin, TrendingDown, TrendingUp } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { AnimatedCounter } from '../../../mobile/primitives/AnimatedCounter';
import { useLeagueData } from '../../../hooks/useLeagueData';
import type { ProfilStats } from '../shared/useProfilLogic';

interface ProfileHeroCardProps {
  stats: ProfilStats;
}

/**
 * Hero card "profil" — variante plus riche que celle de Défis :
 * affiche delta 7j, streak signée, % du top, longest streak.
 */
export function ProfileHeroCard({ stats }: ProfileHeroCardProps) {
  const { me, leaderboard } = useLeagueData();
  const reducedMotion = useReducedMotion();
  const user = me?.user;
  if (!user) return null;

  const myRank = leaderboard.find((u) => u.login === user.login)?.rank ?? 0;
  const isTop1 = myRank === 1;
  const isTop3 = myRank > 0 && myRank <= 3;
  const isTop10 = myRank > 0 && myRank <= 10;
  const topPercent =
    leaderboard.length > 0 && myRank > 0
      ? Math.max(1, Math.round((myRank / leaderboard.length) * 100))
      : 0;

  const streakAbs = Math.abs(stats.currentStreak);
  const onWinStreak = stats.currentStreak > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-3xl border border-teal/40 neon-border no-select gpu"
      style={{
        background:
          'linear-gradient(135deg, rgba(0,217,220,0.06) 0%, rgba(17,24,39,0.95) 50%, rgba(255,183,27,0.04) 100%)',
        boxShadow: '0 12px 32px -8px rgba(0,217,220,0.25), 0 0 0 1px rgba(0,217,220,0.15)',
      }}
    >
      {/* Holographic conic — gated on prefers-reduced-motion (perf + a11y + batterie) */}
      {!reducedMotion && (
        <motion.div
          aria-hidden
          className="absolute inset-0 opacity-25 pointer-events-none gpu"
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

      {/* Grille cyber */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,217,220,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,220,1) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10 px-5 pt-5 pb-5">
        {/* Header row : avatar + identity à gauche, rank badge à droite */}
        <div className="flex items-start gap-4 mb-5">
          <div className="relative flex-shrink-0">
            <div
              className="absolute -inset-1 rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, rgba(0,217,220,0.4) 0%, transparent 70%)',
                filter: 'blur(8px)',
              }}
            />
            <Avatar
              login={user.login}
              imageUrl={user.imageUrl}
              size="lg"
              className="relative ring-2 ring-teal/60 ring-offset-2 ring-offset-bg-1"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold text-text-strong tracking-tight truncate">
              {user.login}
            </h2>
            {user.title && (
              <div className="text-[11px] text-gold italic mt-0.5 truncate">
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

          {myRank > 0 && (
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.3 }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs font-extrabold tabular-nums tracking-wide flex-shrink-0 ${
                isTop1
                  ? 'bg-gradient-to-br from-gold to-[#d6920b] text-[#1a1100] shadow-gold-glow'
                  : isTop3
                    ? 'bg-bg-1/80 text-gold border border-gold/40'
                    : isTop10
                      ? 'bg-bg-1/80 text-teal border border-teal/40'
                      : 'bg-bg-1/80 text-muted-2 border border-border'
              }`}
            >
              {isTop1 && <Crown className="w-3 h-3" strokeWidth={2.5} />}
              <span>#{myRank}</span>
            </motion.div>
          )}
        </div>

        {/* ELO bloc */}
        <div className="flex items-baseline justify-between gap-4 mb-2 px-1">
          <div>
            <div
              className="font-mono text-[56px] font-black leading-none tabular-nums tracking-tighter text-teal"
              style={{
                textShadow: '0 0 24px rgba(0,217,220,0.5), 0 2px 0 rgba(0,0,0,0.4)',
              }}
            >
              <AnimatedCounter value={stats.elo} duration={1.4} />
            </div>
            <div className="text-[10px] text-muted uppercase tracking-[0.32em] font-extrabold mt-0.5">
              ELO
            </div>
          </div>

          {/* Delta 7j */}
          {stats.delta7d !== 0 && (
            <div
              className={`flex flex-col items-end ${stats.delta7d > 0 ? 'text-teal' : 'text-red'}`}
            >
              <div className="flex items-center gap-1 font-mono text-lg font-extrabold tabular-nums">
                {stats.delta7d > 0 ? (
                  <TrendingUp className="w-4 h-4" strokeWidth={2.5} />
                ) : (
                  <TrendingDown className="w-4 h-4" strokeWidth={2.5} />
                )}
                <span>
                  {stats.delta7d > 0 ? '+' : ''}
                  {stats.delta7d}
                </span>
              </div>
              <div className="text-[9px] text-muted uppercase tracking-wider font-bold">
                7 derniers jours
              </div>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <StatPill label="W" value={stats.wins} tone="teal" />
          <StatPill label="L" value={stats.losses} tone="red" />
          <StatPill label="WR" value={`${stats.winRate}%`} tone="gold" />
          <StatPill
            label="STREAK"
            value={`${stats.currentStreak > 0 ? '+' : ''}${stats.currentStreak}`}
            tone={onWinStreak && streakAbs >= 3 ? 'fire' : onWinStreak ? 'teal' : 'red'}
            icon={onWinStreak && streakAbs >= 3 ? <Flame className="w-3 h-3" strokeWidth={2.5} /> : undefined}
          />
        </div>

        {/* Footer stats */}
        <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-3 gap-3 text-center">
          <FooterStat label="Tournois" value={user.tournamentsWon} tone="gold" />
          <FooterStat
            label="Best Streak"
            value={stats.longestWinStreak}
            suffix="W"
          />
          {topPercent > 0 && (
            <FooterStat label="Du top" value={`${topPercent}%`} tone="teal" />
          )}
          {topPercent === 0 && user.dodgeCount > 0 && (
            <FooterStat label="Fuites" value={user.dodgeCount} tone="red" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface StatPillProps {
  label: string;
  value: number | string;
  tone: 'teal' | 'red' | 'gold' | 'fire';
  icon?: React.ReactNode;
}

const TONE_PILL: Record<StatPillProps['tone'], string> = {
  teal: 'text-teal',
  red: 'text-red',
  gold: 'text-gold',
  fire: 'text-gold',
};

function StatPill({ label, value, tone, icon }: StatPillProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg bg-bg-1/40 border border-border/40">
      <div
        className={`text-base font-extrabold tabular-nums font-mono leading-none flex items-center gap-1 ${TONE_PILL[tone]}`}
      >
        {icon}
        <span>{value}</span>
      </div>
      <div className="text-[9px] text-muted uppercase tracking-wider font-bold leading-none">
        {label}
      </div>
    </div>
  );
}

interface FooterStatProps {
  label: string;
  value: number | string;
  suffix?: string;
  tone?: 'gold' | 'teal' | 'red' | 'default';
}

const TONE_FOOTER: Record<NonNullable<FooterStatProps['tone']>, string> = {
  gold: 'text-gold',
  teal: 'text-teal',
  red: 'text-red',
  default: 'text-text-strong',
};

function FooterStat({ label, value, suffix, tone = 'default' }: FooterStatProps) {
  return (
    <div>
      <div className={`text-sm font-extrabold font-mono tabular-nums ${TONE_FOOTER[tone]}`}>
        {value}
        {suffix && <span className="text-[10px] ml-0.5 opacity-70">{suffix}</span>}
      </div>
      <div className="text-[9px] text-muted uppercase tracking-wider font-bold">{label}</div>
    </div>
  );
}
