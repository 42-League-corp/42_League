import { motion } from 'framer-motion';
import { Avatar } from '../Avatar';
import type { LiveBet } from '../../lib/api';

// Bandeau défilant des mises du tournoi (« {parieur} mise {N} 🪙 sur {champion} »).
// Défilement horizontal continu : on duplique la liste et on translate de -50 % en
// boucle pour un ruban sans couture. Vitesse proportionnelle au nombre de mises.

const STATUS_TINT: Record<string, string> = {
  won: 'text-[#7fd66e]',
  lost: 'text-red/70',
  refunded: 'text-muted-2',
  open: 'text-gold',
};

export function BetsTicker({ bets }: { bets: LiveBet[] }) {
  const items = bets.slice(0, 40);
  if (items.length === 0) {
    return (
      <div className="flex items-center h-full px-[2vw] text-[1.4vh] text-muted-2 uppercase tracking-[0.2em]">
        <span className="text-gold mr-[1vw]">◈ Paris</span> Aucune mise pour l'instant — ouvre le marché !
      </div>
    );
  }
  // Boucle fluide : durée ∝ nombre d'items (chaque mise ~3.2 s à l'écran).
  const duration = Math.max(18, items.length * 3.2);
  const loop = [...items, ...items];

  return (
    <div className="relative flex items-center h-full overflow-hidden">
      <div className="absolute left-0 z-10 h-full flex items-center px-[1.2vw] bg-gradient-to-r from-bg-0 via-bg-0/90 to-transparent">
        <span className="text-[1.5vh] font-gaming font-black uppercase tracking-[0.18em] text-gold">◈ Mises en direct</span>
      </div>
      <motion.div
        className="flex items-center gap-[2vw] whitespace-nowrap pl-[16vw]"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration, ease: 'linear', repeat: Infinity }}
      >
        {loop.map((b, i) => (
          <div key={`${b.id}-${i}`} className="flex items-center gap-[0.5vw] shrink-0">
            <Avatar login={b.bettor} imageUrl={b.bettorImageUrl} size="xs" />
            <span className="text-[1.5vh] text-text font-semibold">{b.bettor}</span>
            <span className="text-[1.3vh] text-muted-2">mise</span>
            <span className={`text-[1.5vh] font-mono font-bold tabular-nums ${STATUS_TINT[b.status] ?? 'text-gold'}`}>
              {b.stake} 🪙
            </span>
            <span className="text-[1.3vh] text-muted-2">sur</span>
            <span className="text-[1.5vh] text-gold font-bold">{b.choice}</span>
            <span className="text-border mx-[0.5vw]">•</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
