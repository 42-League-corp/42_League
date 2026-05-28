import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Skull, Swords, Trophy } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { SwipeableCard } from '../../../mobile/primitives/SwipeableCard';
import { RivetCorners } from '../../../mobile/primitives/RivetCorners';
import type { LeaderboardEntry, Ops } from '../../../lib/api';
import { haptic } from '../../../mobile/feedback/useHaptic';

interface PlayerRankCardProps {
  entry: LeaderboardEntry;
  wins: number;
  losses: number;
  isMe: boolean;
  targetedBy?: Ops;
  /** Si fourni, le swipe gauche → droite déclenche cette action (défier). */
  onDefi?: (entry: LeaderboardEntry) => void;
}

/**
 * Carte mobile d'un joueur dans le leaderboard.
 * - Tap → page profil
 * - Swipe vers la droite → défier (si onDefi fourni et pas moi-même)
 * - Highlight spécial pour "moi" + indicateur Ops
 */
export function PlayerRankCard({
  entry,
  wins,
  losses,
  isMe,
  targetedBy,
  onDefi,
}: PlayerRankCardProps) {
  const navigate = useNavigate();

  const rankColor =
    entry.rank === 1
      ? 'text-gold'
      : entry.rank === 2
        ? 'text-muted-2'
        : entry.rank === 3
          ? 'text-[#cd7f32]'
          : 'text-muted';

  const total = wins + losses;
  const winRate = total === 0 ? 0 : Math.round((wins / total) * 100);

  const inner = (
    <motion.button
      type="button"
      onClick={() => {
        haptic('selection');
        navigate(`/joueur/${entry.login}`);
      }}
      whileTap={{ scale: 0.98 }}
      className={`relative w-full flex items-center gap-3 p-3.5 rounded-2xl border tap-transparent text-left transition-all hover-glow overflow-hidden ${
        isMe
          ? 'border-gold/60 bg-gold/[0.08] shadow-gold-glow'
          : 'border-gold/15 card-hud active:bg-bg-2'
      }`}
    >
      {/* Filets HUD haut/bas pour l'aspect cartouche */}
      <span className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-gold/35 to-transparent pointer-events-none" />
      <span className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent pointer-events-none" />
      {/* Rivets uniquement sur ma propre carte (signature visuelle) */}
      {isMe && <RivetCorners size={6} inset={4} />}
      {/* Rank */}
      <div
        className={`w-10 flex-shrink-0 text-center font-mono font-black tabular-nums leading-none ${rankColor}`}
      >
        <div className="text-xl">#{entry.rank}</div>
      </div>

      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar login={entry.login} imageUrl={entry.imageUrl} size="md" />
        {targetedBy && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red text-white flex items-center justify-center ring-2 ring-bg-0"
            title={`Ops de ${targetedBy.ownerLogin}`}
          >
            <Skull className="w-3 h-3" strokeWidth={2.5} />
          </span>
        )}
      </div>

      {/* Login + title + tournois */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold text-text-strong truncate text-sm">
            {entry.login}
          </span>
          {isMe && (
            <span className="text-[8px] font-extrabold text-[#1a1100] metal-plate-gold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
              Toi
            </span>
          )}
        </div>
        {entry.title ? (
          <div className="text-[10px] text-gold italic truncate">« {entry.title} »</div>
        ) : (
          <div className="text-[10px] text-muted font-mono">
            <span className="text-gold">{wins}W</span>
            <span className="mx-1 opacity-30">·</span>
            <span className="text-red">{losses}L</span>
            <span className="mx-1 opacity-30">·</span>
            <span>{winRate}%</span>
          </div>
        )}
        {entry.tournamentsWon !== undefined && entry.tournamentsWon > 0 && (
          <div className="flex items-center gap-1 mt-0.5 text-[9px] text-gold">
            <Trophy className="w-2.5 h-2.5" strokeWidth={2.5} />
            <span className="font-mono tabular-nums">{entry.tournamentsWon}</span>
          </div>
        )}
      </div>

      {/* ELO */}
      <div className="text-right flex-shrink-0">
        <div className="font-display text-base font-black tabular-nums text-gold leading-none" style={{ textShadow: '0 0 12px rgba(255,201,74,0.35)' }}>
          {entry.elo}
        </div>
        <div className="text-[9px] text-muted uppercase tracking-wider font-bold mt-0.5">
          ELO
        </div>
      </div>
    </motion.button>
  );

  if (onDefi && !isMe) {
    return (
      <SwipeableCard
        leftAction={{
          label: 'Défier',
          color: 'teal',
          icon: Swords,
          onTrigger: () => onDefi(entry),
        }}
      >
        {inner}
      </SwipeableCard>
    );
  }

  return inner;
}
