import { motion, useReducedMotion, type Transition, type TargetAndTransition } from 'framer-motion';
import { Crown, Swords, Trophy, History, UserRound, Medal, BookOpen, type LucideIcon } from 'lucide-react';

export type PanelAccentVariant =
  | 'crown'
  | 'swords'
  | 'trophy'
  | 'history'
  | 'user'
  | 'medal'
  | 'book';

interface AccentDef {
  Icon: LucideIcon;
  color: string;
  animate: TargetAndTransition;
  transition: Transition;
}

const loop = (duration: number): Transition => ({
  duration,
  repeat: Infinity,
  ease: 'easeInOut',
});

// Chaque page a son emblème + sa micro-animation → une personnalité propre.
const ACCENTS: Record<PanelAccentVariant, AccentDef> = {
  crown: { Icon: Crown, color: 'text-gold', animate: { y: [0, -3, 0], rotate: [0, -4, 0] }, transition: loop(3.4) },
  swords: { Icon: Swords, color: 'text-red', animate: { rotate: [0, -10, 8, 0] }, transition: loop(2.8) },
  trophy: { Icon: Trophy, color: 'text-gold', animate: { y: [0, -3, 0], scale: [1, 1.06, 1] }, transition: loop(3.0) },
  history: { Icon: History, color: 'text-muted-2', animate: { rotate: 360 }, transition: { duration: 12, repeat: Infinity, ease: 'linear' } },
  user: { Icon: UserRound, color: 'text-gold', animate: { scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }, transition: loop(2.6) },
  medal: { Icon: Medal, color: 'text-gold', animate: { rotate: [0, 6, -6, 0], y: [0, -2, 0] }, transition: loop(3.6) },
  book: { Icon: BookOpen, color: 'text-teal', animate: { rotate: [0, -6, 0] }, transition: loop(3.2) },
};

/**
 * Petit emblème animé posé dans l'en-tête d'un Panel pour donner du caractère et
 * un peu de vie à chaque page. Discret (opacité réduite, halo doux), et figé si
 * l'utilisateur préfère les animations réduites.
 */
export function PanelAccent({ variant, className = '' }: { variant: PanelAccentVariant; className?: string }) {
  const reduced = useReducedMotion();
  const { Icon, color, animate, transition } = ACCENTS[variant];
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`} aria-hidden>
      {/* Halo doux derrière l'emblème */}
      <span className={`absolute inset-0 rounded-full blur-md opacity-30 ${color}`} style={{ background: 'currentColor' }} />
      <motion.span
        className={`relative ${color}`}
        animate={reduced ? undefined : animate}
        transition={reduced ? undefined : transition}
        style={{ opacity: 0.85 }}
      >
        <Icon className="w-4 h-4" strokeWidth={2.4} />
      </motion.span>
    </span>
  );
}
