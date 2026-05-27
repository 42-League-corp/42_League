import { motion } from 'framer-motion';
import type { LeaderboardEntry } from '../../../lib/api';
import { haptic } from '../../../mobile/feedback/useHaptic';

interface OpponentBubbleProps {
  player: LeaderboardEntry;
  count?: number;
  onClick?: (player: LeaderboardEntry) => void;
}

/**
 * Bulle d'adversaire pour le strip horizontal "Adversaires récents".
 * Avatar + login + ELO + nb games jouées.
 */
export function OpponentBubble({ player, count, onClick }: OpponentBubbleProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={() => {
        haptic('selection');
        onClick?.(player);
      }}
      className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[72px] tap-transparent"
    >
      <div className="relative">
        <div
          className="w-14 h-14 rounded-full overflow-hidden border-2 border-teal/40 shadow-lg"
          style={{ boxShadow: '0 4px 12px rgba(0,217,220,0.2)' }}
        >
          {player.imageUrl ? (
            <img src={player.imageUrl} alt={player.login} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-teal-deep flex items-center justify-center text-base font-extrabold text-[#001416]">
              {player.login[0]?.toUpperCase()}
            </div>
          )}
        </div>
        {count !== undefined && count > 0 && (
          <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-bg-0 text-teal text-[9px] font-extrabold flex items-center justify-center ring-2 ring-bg-0 tabular-nums font-mono border border-teal/50">
            {count}
          </span>
        )}
      </div>
      <span className="text-[10px] font-bold text-text-strong truncate w-full text-center">
        {player.login}
      </span>
      <span className="text-[9px] text-teal font-mono tabular-nums leading-none -mt-1">
        {player.elo}
      </span>
    </motion.button>
  );
}
