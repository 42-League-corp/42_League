import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Flame, MapPin, Trophy, Zap, Cog } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { AnimatedCounter } from '../../../mobile/primitives/AnimatedCounter';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { useGameMode } from '../../../hooks/useGameMode';
import { pickRating } from '../../../lib/gameStats';
import { useT } from '../../../lib/i18n';

/**
 * Hero card "RPG / Esport" du joueur — pièce maîtresse de la page Défis.
 *
 * Inspirée du screenshot 42 League cible :
 * - Cartouche dorée avec rivets et tuyaux en laiton
 * - Plaques d'acier brossé pour les 4 stats (W/L/WR%/STREAK)
 * - ELO en typo display (Orbitron) ultra-gros avec relief doré
 * - Badge "TOP X%" en vert
 * - Silhouettes de personnages stylisées en arrière-plan
 * - Mini rouage qui tourne en haut à droite
 *
 * Animations conservées : rotation du conic gradient, shimmer, count-up.
 */
export function HeroPlayerCard() {
  const t = useT();
  const { me, matches, leaderboard } = useLeagueData();
  const { game } = useGameMode();
  const user = me?.user;
  const myLogin = me?.login;
  const reducedMotion = useReducedMotion();

  // Toutes les stats sont CLOISONNÉES par discipline :
  // l'ELO affiché, le rang, les victoires et la série correspondent
  // uniquement aux matchs du mode de jeu courant.
  const stats = useMemo(() => {
    if (!user || !myLogin) {
      return { wins: 0, losses: 0, total: 0, winRate: 0, streak: 0, rank: 0, elo: 1000 };
    }
    const mine = matches
      .filter(
        (m) =>
          (m.game ?? 'babyfoot') === game &&
          (m.playerALogin === myLogin || m.playerBLogin === myLogin),
      )
      .sort((a, b) => +new Date(b.playedAt) - +new Date(a.playedAt));
    let wins = 0;
    let losses = 0;
    let streak = 0;
    let streakBroken = false;
    for (const m of mine) {
      if (m.winner === 'draw') { streakBroken = true; continue; } // nulle : ni V ni D, casse la série
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
    const elo = pickRating(user, game).elo;
    return { wins, losses, total, winRate, streak, rank, elo };
  }, [user, myLogin, matches, leaderboard, game]);

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
      // Sans `gpu` : même raison que ProfileHeroCard — une couche compositeur
      // permanente sur une carte interactive décale le hit-testing des taps sous
      // Firefox Android (APZ). Le contenu reste cliquable partout.
      className="relative overflow-hidden rounded-3xl no-select"
      style={{
        background:
          'linear-gradient(180deg, #2a241c 0%, #1d1914 18%, #15120e 50%, #1d1914 82%, #2a241c 100%)',
        border: '1px solid rgba(255, 201, 74, 0.4)',
        boxShadow:
          'inset 0 1px 0 rgba(255, 215, 120, 0.18), inset 0 -1px 0 rgba(0,0,0,0.5), 0 12px 36px -8px rgba(255, 201, 74, 0.22), 0 0 0 1px rgba(0,0,0,0.5)',
      }}
    >
      {/* Couche 0 : tuyaux en laiton en haut et en bas du cartouche */}
      <div className="absolute top-0 left-3 right-3 h-[2px] brass-pipe rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-3 right-3 h-[2px] brass-pipe rounded-full pointer-events-none" />

      {/* Couche 1 : conic gradient lent (effet RPG) */}
      {!reducedMotion && (
        <motion.div
          aria-hidden
          className="absolute inset-0 opacity-25 pointer-events-none gpu"
          animate={{ rotate: 360 }}
          transition={{ duration: 40, ease: 'linear', repeat: Infinity }}
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255,201,74,0.35) 60deg, transparent 120deg, rgba(192,138,74,0.25) 200deg, transparent 260deg, rgba(255,201,74,0.25) 340deg, transparent 360deg)',
            filter: 'blur(50px)',
            willChange: 'transform',
          }}
        />
      )}

      {/* Couche 2 : shimmer doré */}
      <div aria-hidden className="absolute inset-0 opacity-25 pointer-events-none shimmer" />

      {/* Couche 3 : grille HUD très subtile */}
      <div aria-hidden className="absolute inset-0 hud-grid opacity-50 pointer-events-none" />

      {/* Couche 4 : silhouettes de personnages décoratives (gauche/droite, très estompées) */}
      <div aria-hidden className="absolute inset-y-4 left-2 w-20 opacity-[0.06] pointer-events-none flex items-center">
        <svg viewBox="0 0 80 100" className="w-full h-full text-gold">
          <ellipse cx="40" cy="22" rx="14" ry="16" fill="currentColor" />
          <path
            d="M40 38 C 20 38 14 60 14 78 L 14 98 L 66 98 L 66 78 C 66 60 60 38 40 38 Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div aria-hidden className="absolute inset-y-4 right-2 w-20 opacity-[0.06] pointer-events-none flex items-center">
        <svg viewBox="0 0 80 100" className="w-full h-full text-gold">
          <ellipse cx="40" cy="22" rx="14" ry="16" fill="currentColor" />
          <path
            d="M40 38 C 20 38 14 60 14 78 L 14 98 L 66 98 L 66 78 C 66 60 60 38 40 38 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Cog décoratif en haut à droite */}
      {!reducedMotion && (
        <Cog
          className="absolute top-3 right-3 w-5 h-5 text-gold/45 animate-gear-spin pointer-events-none"
          strokeWidth={2}
        />
      )}

      {/* Rank badge en haut à gauche (à l'opposé du cog). Enfant direct de la
          carte — comme le cog — pour que `top/left` soit ancré au coin de la
          carte et non à l'intérieur du conteneur de contenu centré (sinon le
          badge se retrouvait mal positionné). z-20 → au-dessus des couches déco
          ET du contenu (z-10). */}
      {stats.rank > 0 && (
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.3 }}
          className={`absolute top-3 left-3 z-20 flex items-center justify-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs font-extrabold tabular-nums tracking-wide ${
            isTop1
              ? 'metal-plate-gold shadow-gold-glow'
              : isTop3
                ? 'bg-bg-1/80 text-gold border border-gold/50 backdrop-blur'
                : isTop10
                  ? 'bg-bg-1/80 text-gold border border-gold/30 backdrop-blur'
                  : 'bg-bg-1/80 text-muted-2 border border-border backdrop-blur'
          }`}
        >
          <span>#{stats.rank}</span>
        </motion.div>
      )}

      {/* CONTENU */}
      <div className="relative z-10 px-5 pt-5 pb-4 flex flex-col items-center text-center">
        {/* Avatar XL avec ring */}
        <div className="relative mb-3 mt-2">
          <div
            className="absolute -inset-2 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(255,201,74,0.35) 0%, transparent 70%)',
              filter: 'blur(10px)',
            }}
          />
          <Avatar
            login={user.login}
            imageUrl={user.imageUrl}
            size="xl"
            className="relative"
          />
        </div>

        {/* Login + title + campus */}
        <div className="mb-4">
          <h2 className="font-display text-2xl font-black text-text-strong tracking-tight">
            {user.login}
          </h2>
          {user.title && (
            <div className="text-[11px] text-gold italic mt-0.5 px-2 truncate max-w-[260px]">
              « {user.title} »
            </div>
          )}
          {user.campus && (
            <div className="inline-flex items-center gap-1 text-[10px] text-muted-2 mt-1 font-bold uppercase tracking-[0.18em]">
              <MapPin className="w-3 h-3" strokeWidth={2.5} />
              <span>{user.campus}</span>
            </div>
          )}
        </div>

        {/* ELO géant — toujours celui du jeu courant */}
        <div className="relative mb-1">
          <div
            className="font-display text-[68px] font-black leading-none tabular-nums tracking-tighter text-gold-emboss"
          >
            <AnimatedCounter value={stats.elo} duration={1.4} />
          </div>
          <div className="text-[10px] text-muted uppercase tracking-[0.36em] font-extrabold mt-0.5">
            ELO
          </div>
        </div>

        {/* Stats row — plaques en acier */}
        <div className="mt-5 w-full grid grid-cols-4 gap-2">
          <StatBlock label="W" value={stats.wins} tone="gold" />
          <StatBlock label="L" value={stats.losses} tone="red" />
          <StatBlock label="WR" value={`${stats.winRate}%`} tone="gold" />
          <StatBlock
            label="STREAK"
            value={stats.streak}
            tone={stats.streak >= 3 ? 'fire' : 'muted'}
            icon={stats.streak >= 3 ? <Flame className="w-3 h-3" strokeWidth={2.5} /> : undefined}
          />
        </div>

        {/* Footer — badge TOP X% en vert + trophées */}
        {(user.tournamentsWon > 0 || topPercent > 0) && (
          <div className="mt-4 flex items-center justify-center gap-2 w-full">
            {topPercent > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 360, damping: 20 }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#7fd66e]/50 bg-[#7fd66e]/10 text-[#7fd66e] font-gaming text-[10px] font-extrabold uppercase tracking-wider shadow-[inset_0_1px_0_rgba(127,214,110,0.18),0_0_14px_rgba(127,214,110,0.18)]"
              >
                <Zap className="w-3 h-3" strokeWidth={2.5} />
                <span className="tabular-nums">TOP {topPercent}%</span>
              </motion.div>
            )}
            {pickRating(user, game).tournamentsWon > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-gold/40 bg-gold/10 text-gold font-gaming text-[10px] font-extrabold uppercase tracking-wider">
                <Trophy className="w-3 h-3" strokeWidth={2.5} />
                <span className="font-mono tabular-nums">{pickRating(user, game).tournamentsWon}</span>
                <span>{pickRating(user, game).tournamentsWon > 1 ? t('defis.tournamentPlural') : t('defis.tournamentSingular')}</span>
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
  tone: 'gold' | 'red' | 'fire' | 'muted';
  icon?: React.ReactNode;
}

const TONE: Record<StatBlockProps['tone'], string> = {
  gold: 'text-gold',
  red: 'text-red',
  fire: 'text-gold animate-ember',
  muted: 'text-muted-2',
};

/**
 * Plaque d'acier brossé pour une stat — réplique exacte des plaques du screenshot
 * (W/L/WR%/STREAK).
 */
function StatBlock({ label, value, tone, icon }: StatBlockProps) {
  return (
    <div className="relative metal-plate rounded-lg px-1 py-2 flex flex-col items-center gap-0.5">
      <div
        className={`relative z-10 font-display text-base font-black tabular-nums leading-none flex items-center gap-1 ${TONE[tone]}`}
        style={{
          textShadow:
            tone === 'red'
              ? '0 1px 0 rgba(0,0,0,0.6), 0 0 10px rgba(255,83,102,0.4)'
              : tone === 'muted'
                ? '0 1px 0 rgba(0,0,0,0.6)'
                : '0 1px 0 rgba(0,0,0,0.6), 0 0 10px rgba(255,201,74,0.4)',
        }}
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
