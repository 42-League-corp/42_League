import { motion, useReducedMotion } from 'framer-motion';
import { Crown, Flame, MapPin, TrendingDown, TrendingUp } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { RankedBadge } from '../../../components/RankedBadge';
import { BadgesRow } from '../../../components/Badges';
import { AnimatedCounter } from '../../../mobile/primitives/AnimatedCounter';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { useGameMode } from '../../../hooks/useGameMode';
import { pickRating } from '../../../lib/gameStats';
import { displayTitle } from '../../../lib/cosmeticTitles';
import { useT } from '../../../lib/i18n';
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
  const { game } = useGameMode();
  const t = useT();
  const reducedMotion = useReducedMotion();
  const user = me?.user;
  if (!user) return null;
  const titlesWon = pickRating(user, game).tournamentsWon;

  // Badges cross-jeux : autres disciplines où ce joueur est actif.
  const crossGameBadges = (['babyfoot', 'smash', 'chess', 'streetfighter'] as const)
    .filter((g) => g !== game && (user.games ?? ['babyfoot']).includes(g))
    .map((g) => {
      const r = pickRating(user, g);
      return { g, elo: r.elo, played: r.matchesPlayed };
    })
    .filter((b) => b.played > 0);

  const myEntry = leaderboard.find((u) => u.login === user.login);
  const myRank = myEntry?.rank ?? 0;
  const fullName =
    [user.lastName, user.firstName].filter(Boolean).join(' ').trim() ||
    [myEntry?.lastName, myEntry?.firstName].filter(Boolean).join(' ').trim() ||
    user.login;
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
      className="relative overflow-hidden rounded-3xl no-select gpu"
      style={{
        background:
          'linear-gradient(180deg, #2a241c 0%, #1d1914 18%, #15120e 50%, #1d1914 82%, #2a241c 100%)',
        border: '1px solid rgba(255, 201, 74, 0.4)',
        boxShadow:
          'inset 0 1px 0 rgba(255, 215, 120, 0.18), inset 0 -1px 0 rgba(0,0,0,0.5), 0 12px 36px -8px rgba(255, 201, 74, 0.22)',
      }}
    >
      {/* Tubes laiton décoratifs */}
      <div className="absolute top-0 left-3 right-3 h-[2px] brass-pipe rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-3 right-3 h-[2px] brass-pipe rounded-full pointer-events-none" />
      {/* Holographic conic — gated on prefers-reduced-motion (perf + a11y + batterie) */}
      {!reducedMotion && (
        <motion.div
          aria-hidden
          className="absolute inset-0 opacity-25 pointer-events-none gpu"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255,201,74,0.35) 60deg, transparent 120deg, rgba(192,138,74,0.25) 200deg, transparent 260deg, rgba(255,201,74,0.25) 340deg, transparent 360deg)',
            filter: 'blur(50px)',
            willChange: 'transform',
          }}
        />
      )}

      {/* Grille cyber */}
      <div
        aria-hidden
        className="absolute inset-0 hud-grid opacity-50 pointer-events-none"
      />

      <div className="relative z-10 px-5 pt-5 pb-5">
        {/* Header row : avatar + identity à gauche, rank badge à droite */}
        <div className="flex items-start gap-4 mb-5">
          <div className="relative flex-shrink-0">
            <div
              className="absolute -inset-1 rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, rgba(255,201,74,0.4) 0%, transparent 70%)',
                filter: 'blur(10px)',
              }}
            />
            <Avatar
              login={user.login}
              imageUrl={user.imageUrl}
              size="lg"
              className="relative"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-xl font-extrabold text-text-strong tracking-tight truncate min-w-0">
                {fullName}
              </h2>
              {me?.badges && me.badges.length > 0 && (
                <div className="flex-shrink-0">
                  <BadgesRow codes={me.badges} size="md" />
                </div>
              )}
            </div>
            <div className="text-[10px] text-muted-2 font-mono truncate">@{user.login}</div>
            {displayTitle(user.login, user.title) && (
              <div className="text-sm text-gold italic font-semibold mt-0.5 truncate">
                « {displayTitle(user.login, user.title)} »
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
                  ? 'metal-plate-gold shadow-gold-glow'
                  : isTop3
                    ? 'bg-bg-1/80 text-gold border border-gold/50'
                    : isTop10
                      ? 'bg-bg-1/80 text-gold border border-gold/30'
                      : 'bg-bg-1/80 text-muted-2 border border-border'
              }`}
            >
              {isTop1 && <Crown className="w-3 h-3" strokeWidth={2.5} />}
              <span>#{myRank}</span>
            </motion.div>
          )}
        </div>

        {/* ELO bloc */}
        <div className="flex items-end justify-between gap-4 mb-2 px-1">
          <div>
            <div className="-ml-0.5 mb-0.5 text-[10px] text-muted uppercase tracking-[0.32em] font-extrabold flex items-center gap-1.5">
              ELO
              <RankedBadge size="xs" />
            </div>
            <div className="font-display text-[56px] font-black leading-none tabular-nums tracking-tighter text-gold-emboss">
              <AnimatedCounter value={stats.elo} duration={1.4} />
            </div>
          </div>

          {/* Delta 7j */}
          {stats.delta7d !== 0 && (
            <div
              className={`flex flex-col items-end ${stats.delta7d > 0 ? 'text-gold' : 'text-red'}`}
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
          <StatPill label={t('lb.abbr.win')} value={stats.wins} tone="teal" />
          <StatPill label={t('lb.abbr.loss')} value={stats.losses} tone="red" />
          <StatPill label="WR" value={`${stats.winRate}%`} tone="gold" />
          <StatPill
            label="STREAK"
            value={`${stats.currentStreak > 0 ? '+' : ''}${stats.currentStreak}`}
            tone={onWinStreak && streakAbs >= 3 ? 'fire' : onWinStreak ? 'teal' : 'red'}
            icon={onWinStreak && streakAbs >= 3 ? <Flame className="w-3 h-3" strokeWidth={2.5} /> : undefined}
          />
        </div>

        {/* Autres disciplines — section lisible, intégrée dans la carte héro */}
        {crossGameBadges.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.07]">
            <div className="text-[8px] uppercase tracking-[0.20em] font-extrabold text-muted-2 mb-2">
              Aussi actif sur
            </div>
            <div className="flex items-center gap-2">
              {crossGameBadges.map(({ g, elo, played }) => (
                <div
                  key={g}
                  className="flex-1 rounded-xl px-2.5 py-2 flex flex-col items-center gap-0.5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span className="text-base leading-none">
                    {g === 'smash' ? '🎮' : g === 'streetfighter' ? '🥊' : g === 'chess' ? '♟' : '⚽'}
                  </span>
                  <span className="font-mono font-extrabold tabular-nums text-[11px] text-gold/90">{elo}</span>
                  <span className="text-[8px] text-muted uppercase tracking-wider font-bold">ELO</span>
                  <span className="text-[8px] text-muted-2 font-mono">{played}m</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer stats */}
        <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-3 gap-3 text-center">
          <FooterStat label="Tournois remportés" value={titlesWon} tone="gold" />
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
    <div className="relative metal-plate rounded-lg px-1 py-2 flex flex-col items-center gap-0.5">
      <div
        className={`relative z-10 font-display text-base font-black tabular-nums leading-none flex items-center gap-1 ${TONE_PILL[tone]}`}
        style={{ textShadow: '0 1px 0 rgba(0,0,0,0.6), 0 0 10px currentColor' }}
      >
        {icon}
        <span>{value}</span>
      </div>
      <div className="relative z-10 text-[9px] text-muted-2 uppercase tracking-[0.16em] font-extrabold leading-none">
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
