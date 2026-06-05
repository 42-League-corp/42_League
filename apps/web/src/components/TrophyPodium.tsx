import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
import type { LeaderboardEntry } from '../lib/api';
import { Avatar } from './Avatar';
import { PlayerLink } from './PlayerLink';

// ─────────────────────────────────────────────────────────────────────────────
// TrophyPodium — variante « trophées » du podium du classement (DesktopPodium).
// Même langage visuel (scène 3D, halo doré, rayons de soleil, marches en métal
// brossé or/argent/bronze, couronne flottante sur le 1er, gros chiffre sur la
// marche) mais : on classe par NOMBRE DE TROPHÉES 🏆 au lieu de l'ELO, et c'est
// responsive (marches/avatars réduits sur mobile) car la section trophées est un
// composant unique partagé desktop + mobile.
// ─────────────────────────────────────────────────────────────────────────────

export interface TrophyPodiumEntry {
  login: string;
  imageUrl: string | null;
  trophyCount: number;
  rank: number;
}

interface TrophyPodiumProps {
  /** Déjà en ordre d'affichage : [2e, 1er, 3e] (argent · or · bronze). */
  podium: TrophyPodiumEntry[];
  leaderboard: LeaderboardEntry[];
}

export function TrophyPodium({ podium, leaderboard }: TrophyPodiumProps) {
  return (
    <div className="relative overflow-hidden rounded-xl pt-8 pb-0">
      {/* Halo radial doré */}
      <div
        className="absolute inset-x-0 top-0 h-44 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(255,201,74,0.22), transparent 65%)',
        }}
      />
      {/* Rayons de lumière en éventail qui tournent */}
      <div className="absolute inset-x-0 top-0 h-52 pointer-events-none overflow-hidden opacity-35 [mask-image:radial-gradient(ellipse_70%_100%_at_50%_0%,black,transparent_72%)]">
        <div
          className="absolute left-1/2 top-0 aspect-square w-[1100px] max-w-none animate-spin-sun"
          style={{
            background:
              'repeating-conic-gradient(rgba(255,201,74,0.13) 0deg 5deg, transparent 5deg 16deg)',
          }}
        />
      </div>

      <div
        className="relative grid grid-cols-3 items-end gap-2 sm:gap-4 max-w-xl mx-auto"
        style={{ perspective: '1100px' }}
      >
        {podium.map((e, i) => (
          <TrophyPodiumColumn key={e.login} entry={e} leaderboard={leaderboard} delay={i * 0.11} />
        ))}
      </div>
    </div>
  );
}

type PodiumColor = 'gold' | 'silver' | 'bronze';
const COLOR_BY_RANK: Record<number, PodiumColor> = { 1: 'gold', 2: 'silver', 3: 'bronze' };
const STEP_H: Record<number, string> = {
  1: 'h-28 sm:h-36',
  2: 'h-20 sm:h-24',
  3: 'h-14 sm:h-16',
};

const STEP: Record<PodiumColor, string> = {
  gold: 'from-[#3a2e10] via-[#241c08] to-[#0f0c04] border-gold/45',
  silver: 'from-[#2c2e33] via-[#1c1d20] to-[#0e0e10] border-[#c9cdd6]/30',
  bronze: 'from-[#33220f] via-[#1f1408] to-[#0e0905] border-[#cd7f32]/35',
};
const RING: Record<PodiumColor, string> = {
  gold: 'ring-gold shadow-[0_0_28px_rgba(255,201,74,0.55)]',
  silver: 'ring-[#c9cdd6]/80 shadow-[0_0_18px_rgba(201,205,214,0.35)]',
  bronze: 'ring-[#cd7f32]/80 shadow-[0_0_18px_rgba(205,127,50,0.35)]',
};
const TXT: Record<PodiumColor, string> = {
  gold: 'text-gold',
  silver: 'text-[#d6dae3]',
  bronze: 'text-[#e0954c]',
};
const BADGE: Record<PodiumColor, string> = {
  gold: 'metal-plate-gold text-[#1a1100] shadow-gold-glow',
  silver: 'bg-gradient-to-br from-[#e2e5ec] to-[#9aa0ad] text-[#15171c]',
  bronze: 'bg-gradient-to-br from-[#e0954c] to-[#8b5722] text-white',
};
const BIG_NUM: Record<PodiumColor, string> = {
  gold: 'text-gold/25',
  silver: 'text-[#c9cdd6]/20',
  bronze: 'text-[#cd7f32]/20',
};

function TrophyPodiumColumn({
  entry,
  leaderboard,
  delay,
}: {
  entry: TrophyPodiumEntry;
  leaderboard: LeaderboardEntry[];
  delay: number;
}) {
  const { rank } = entry;
  const color = COLOR_BY_RANK[rank] ?? 'bronze';
  const isFirst = rank === 1;
  const lbEntry = leaderboard.find((u) => u.login === entry.login);
  const name =
    lbEntry?.firstName && lbEntry?.lastName
      ? `${lbEntry.firstName} ${lbEntry.lastName}`
      : entry.login;

  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col items-center gap-2.5"
    >
      {/* Figure (avatar + nom) : seule cette partie se soulève au hover. */}
      <div className="flex flex-col items-center gap-2 transition-transform duration-300 ease-out group-hover:-translate-y-1.5">
        {/* Avatar + couronne — flotte doucement */}
        <motion.div
          className="relative"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: delay + 0.5 }}
        >
          {isFirst && (
            <motion.div
              initial={{ y: -16, opacity: 0, rotate: -18 }}
              animate={{ y: [0, -4, 0], opacity: 1, rotate: 0 }}
              transition={{
                opacity: { delay: delay + 0.35, duration: 0.4 },
                rotate: { delay: delay + 0.35, type: 'spring', stiffness: 320, damping: 12 },
                y: { delay: delay + 0.7, duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
              }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 text-gold z-10 drop-shadow-[0_2px_8px_rgba(255,201,74,0.6)]"
            >
              <Crown className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2.5} fill="currentColor" />
            </motion.div>
          )}
          <PlayerLink login={entry.login} className="!block">
            <Avatar
              login={entry.login}
              imageUrl={entry.imageUrl}
              size={isFirst ? 'lg' : 'md'}
              className={`ring-[3px] ring-offset-2 ring-offset-bg-1 transition-transform duration-300 group-hover:scale-105 ${RING[color]}`}
            />
          </PlayerLink>
          {/* Pastille rang */}
          <div
            className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full flex items-center justify-center font-mono font-black ring-2 ring-bg-1 ${BADGE[color]} ${
              isFirst ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-[11px]'
            }`}
          >
            {rank}
          </div>
        </motion.div>

        {/* Nom + compteur de trophées */}
        <div className="text-center mt-1 max-w-full px-1">
          <div
            className={`font-extrabold truncate max-w-[92px] sm:max-w-[120px] ${TXT[color]} ${
              isFirst ? 'text-sm' : 'text-xs'
            }`}
          >
            {name}
          </div>
          <div
            className="font-display font-black tabular-nums text-gold leading-tight"
            style={{ textShadow: '0 0 14px rgba(255,201,74,0.4)' }}
          >
            {entry.trophyCount}
            <span className="ml-1 text-sm align-middle">🏆</span>
          </div>
          {isFirst && (
            <div className="mt-0.5 inline-block text-[8px] font-extrabold uppercase tracking-[0.18em] text-gold/90">
              Le plus titré
            </div>
          )}
        </div>
      </div>

      {/* Marche */}
      <div
        className={`relative w-full ${STEP_H[rank]} rounded-t-xl border-t border-l border-r bg-gradient-to-b ${STEP[color]} flex items-start justify-center pt-2 overflow-hidden transition-all duration-300 group-hover:brightness-110`}
        style={{ transform: 'rotateX(8deg)', transformOrigin: 'bottom' }}
      >
        {/* Reflet brossé */}
        <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <span className="absolute inset-0 [background:linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.06)_50%,transparent_60%)]" />
        <span
          className={`font-display font-black leading-none ${BIG_NUM[color]} ${
            isFirst ? 'text-5xl sm:text-6xl' : 'text-3xl sm:text-4xl'
          }`}
        >
          {rank}
        </span>
      </div>
    </motion.div>
  );
}
