import { useState, type ReactNode } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { haptic } from '../feedback/useHaptic';

interface SwipeAction {
  icon?: typeof Check;
  label: string;
  color: 'teal' | 'red' | 'gold';
  onTrigger: () => void;
}

interface SwipeableCardProps {
  children: ReactNode;
  /** Action déclenchée en swipant de droite à gauche (révèle à droite, geste vers la gauche). */
  rightAction?: SwipeAction;
  /** Action déclenchée en swipant de gauche à droite. */
  leftAction?: SwipeAction;
  /** Seuil en pixels avant déclenchement (par défaut 100). */
  threshold?: number;
  className?: string;
}

const COLOR_BG: Record<SwipeAction['color'], string> = {
  teal: 'bg-gradient-to-r from-gold to-gold-dim text-[#1a0d00]',
  red: 'bg-gradient-to-r from-red to-red-deep text-white',
  gold: 'metal-plate-gold text-[#1a1100]',
};

/**
 * Carte avec actions de swipe horizontal style Mail iOS.
 * - Swipe pour révéler l'action de fond
 * - Au-delà du seuil, déclenche l'action avec haptique
 * - Animation de "fly-away" sur l'action déclenchée (la carte glisse hors écran)
 */
export function SwipeableCard({
  children,
  rightAction,
  leftAction,
  threshold = 100,
  className = '',
}: SwipeableCardProps) {
  const x = useMotionValue(0);
  const [triggered, setTriggered] = useState<'left' | 'right' | null>(null);

  // Background reveal — opacité proportionnelle à |x|.
  const rightBgOpacity = useTransform(x, [-threshold * 1.5, -20, 0], [1, 0.6, 0]);
  const leftBgOpacity = useTransform(x, [0, 20, threshold * 1.5], [0, 0.6, 1]);

  // Légère bascule de la carte au drag (effet "papier")
  const rotate = useTransform(x, [-200, 0, 200], [-2, 0, 2]);

  const handleEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const off = info.offset.x;
    if (rightAction && off < -threshold) {
      haptic('success');
      setTriggered('right');
      // attend la fin du fly-away avant de déclencher
      setTimeout(() => rightAction.onTrigger(), 220);
      return;
    }
    if (leftAction && off > threshold) {
      haptic('success');
      setTriggered('left');
      setTimeout(() => leftAction.onTrigger(), 220);
      return;
    }
    // sinon snap retour
    x.set(0);
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl no-select ${className}`}>
      {/* Background reveals */}
      {rightAction && (
        <motion.div
          style={{ opacity: rightBgOpacity }}
          className={`absolute inset-0 flex items-center justify-end px-6 rounded-2xl ${COLOR_BG[rightAction.color]}`}
        >
          <div className="flex items-center gap-2 font-extrabold text-sm uppercase tracking-wider">
            <span>{rightAction.label}</span>
            {rightAction.icon ? <rightAction.icon className="w-5 h-5" strokeWidth={3} /> : <X className="w-5 h-5" strokeWidth={3} />}
          </div>
        </motion.div>
      )}
      {leftAction && (
        <motion.div
          style={{ opacity: leftBgOpacity }}
          className={`absolute inset-0 flex items-center justify-start px-6 rounded-2xl ${COLOR_BG[leftAction.color]}`}
        >
          <div className="flex items-center gap-2 font-extrabold text-sm uppercase tracking-wider">
            {leftAction.icon ? <leftAction.icon className="w-5 h-5" strokeWidth={3} /> : <Check className="w-5 h-5" strokeWidth={3} />}
            <span>{leftAction.label}</span>
          </div>
        </motion.div>
      )}

      {/* Foreground card — draggable */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        onDragEnd={handleEnd}
        animate={
          triggered === 'right'
            ? { x: -500, opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 0.8, 0.6] } }
            : triggered === 'left'
              ? { x: 500, opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 0.8, 0.6] } }
              : undefined
        }
        style={{ x, rotate }}
        className="relative card-hud rounded-2xl touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
}
