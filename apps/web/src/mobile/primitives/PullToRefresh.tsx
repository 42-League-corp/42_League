import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { haptic } from '../feedback/useHaptic';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  /** Distance en pixels à tirer avant déclenchement. */
  threshold?: number;
  className?: string;
}

const MAX_PULL = 120;

/**
 * Pull-to-refresh tactile :
 * - Quand le scroll est au top, tirer vers le bas révèle un loader
 * - Au-delà du seuil, relâcher déclenche onRefresh
 * - Haptique au passage du seuil et au déclenchement
 *
 * NOTE : ce composant ne marche que si on est en haut du scroll (scrollTop === 0).
 * Le scroll natif reprend dès qu'on commence à scroller normalement.
 */
export function PullToRefresh({
  onRefresh,
  children,
  threshold = 70,
  className = '',
}: PullToRefreshProps) {
  const y = useMotionValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const [primed, setPrimed] = useState(false);

  const progress = useTransform(y, [0, threshold], [0, 1]);
  const rotation = useTransform(progress, [0, 1], [0, 180]);
  const scale = useTransform(progress, [0, 1], [0.6, 1]);

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (refreshing) return;
    const next = primed || info.offset.y > threshold;
    if (next !== primed) {
      setPrimed(next);
      haptic('selection');
    }
  };

  const handleEnd = async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (refreshing) return;
    if (info.offset.y > threshold) {
      haptic('medium');
      setRefreshing(true);
      y.set(threshold);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPrimed(false);
        y.set(0);
      }
    } else {
      setPrimed(false);
      y.set(0);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Loader indicateur — fixé en haut du conteneur */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-10"
        style={{ height: MAX_PULL, transform: 'translateY(-100%)' }}
      >
        <motion.div
          style={{ y, scale }}
          className={`flex items-center justify-center w-10 h-10 rounded-full glass-strong shadow-lg border ${
            primed ? 'border-teal text-teal' : 'border-border text-muted-2'
          }`}
        >
          <AnimatePresence mode="wait">
            {refreshing ? (
              <motion.div
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
              </motion.div>
            ) : (
              <motion.div key="arrow" style={{ rotate: rotation }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 3 L8 13 M4 9 L8 13 L12 9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: refreshing ? threshold : MAX_PULL }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDrag={handleDrag}
        onDragEnd={handleEnd}
        style={{ y }}
        className="touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
}
