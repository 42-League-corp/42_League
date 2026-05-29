import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
} from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { haptic } from '../feedback/useHaptic';
import { useScrollRoot } from '../../shell/scrollRoot';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  /** Distance en pixels (après résistance) à atteindre pour armer le refresh. */
  threshold?: number;
  className?: string;
}

const MAX_PULL = 120;
const RESISTANCE = 0.5;
const ENGAGE_PX = 4;
const SPRING_BACK = { type: 'spring' as const, stiffness: 380, damping: 30, mass: 0.7 };
const SPRING_HOLD = { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.7 };

/**
 * Pull-to-refresh natif premium :
 * - **N'interfère JAMAIS avec le scroll natif** : on attache des listeners touch
 *   au vrai conteneur scrollable (<main> du MobileShell, fourni via ScrollRootContext)
 *   et on ne préventDefault que quand on contrôle activement le pull.
 * - Le geste ne s'arme que si `scrollTop === 0` au touchstart. Au moindre scroll
 *   vertical vers le haut, ou au moindre geste horizontal dominant, on relâche.
 * - Élastique iOS : la résistance grandit avec la distance (atténuée à 50%).
 * - Haptique au passage du seuil + au déclenchement.
 * - Loader doré qui descend du header, rotation de la flèche, swap loader.
 */
export function PullToRefresh({
  onRefresh,
  children,
  threshold = 70,
  className = '',
}: PullToRefreshProps) {
  const scrollRoot = useScrollRoot();
  const y = useMotionValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const [primed, setPrimed] = useState(false);

  // Refs pour ne pas re-créer les listeners à chaque render.
  const refreshingRef = useRef(false);
  const primedRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const animRef = useRef<AnimationPlaybackControls | null>(null);

  refreshingRef.current = refreshing;
  primedRef.current = primed;
  onRefreshRef.current = onRefresh;

  const progress = useTransform(y, [0, threshold], [0, 1]);
  const rotation = useTransform(progress, [0, 1], [0, 180]);
  const scale = useTransform(progress, [0, 1], [0.6, 1]);

  useEffect(() => {
    const root = scrollRoot?.current;
    if (!root) return;

    const cancelAnim = () => {
      animRef.current?.stop();
      animRef.current = null;
    };
    const springTo = (target: number, opts = SPRING_BACK) => {
      cancelAnim();
      animRef.current = animate(y, target, opts);
    };

    let startY = 0;
    let startX = 0;
    let armed = false;
    let pulling = false;
    let canceled = false;

    const reset = () => {
      armed = false;
      pulling = false;
      canceled = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) {
        reset();
        return;
      }
      if (e.touches.length !== 1) {
        reset();
        return;
      }
      if (root.scrollTop > 0) {
        reset();
        return;
      }
      const touch = e.touches[0];
      if (!touch) { reset(); return; }
      cancelAnim();
      armed = true;
      pulling = false;
      canceled = false;
      startY = touch.clientY;
      startX = touch.clientX;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!armed || canceled || refreshingRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY;
      const dx = t.clientX - startX;

      // Le scroll natif a repris la main (l'utilisateur scrolle vers le haut du contenu)
      // ou il essaie de remonter — on abandonne immédiatement le pull.
      if (dy <= 0 || root.scrollTop > 0) {
        if (pulling) springTo(0);
        canceled = true;
        return;
      }

      // Geste horizontal dominant → laisse le scroll-x ou les swipers faire leur job.
      if (!pulling && Math.abs(dx) > Math.abs(dy)) {
        canceled = true;
        return;
      }

      // On engage le pull seulement au-delà de ENGAGE_PX pour ignorer le micro-jitter.
      if (dy > ENGAGE_PX) pulling = true;
      if (!pulling) return;

      const pulled = Math.min(MAX_PULL, dy * RESISTANCE);
      y.set(pulled);

      // Tant qu'on pull, on bloque le scroll natif (sinon iOS rubber-band fight).
      if (e.cancelable) e.preventDefault();

      const next = pulled > threshold;
      if (next !== primedRef.current) {
        primedRef.current = next;
        setPrimed(next);
        haptic('selection');
      }
    };

    const onTouchEnd = () => {
      if (!armed) return;
      const wasPulling = pulling;
      const current = y.get();
      reset();
      if (!wasPulling) return;

      if (current > threshold) {
        haptic('medium');
        setRefreshing(true);
        refreshingRef.current = true;
        springTo(threshold, SPRING_HOLD);
        const run = async () => {
          try {
            await onRefreshRef.current();
          } finally {
            setRefreshing(false);
            refreshingRef.current = false;
            setPrimed(false);
            primedRef.current = false;
            springTo(0);
          }
        };
        void run();
      } else {
        setPrimed(false);
        primedRef.current = false;
        springTo(0);
      }
    };

    // touchstart + touchend peuvent rester passifs ; seul touchmove doit pouvoir
    // preventDefault() (non passif). On garde le coût perf sur le seul listener concerné.
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('touchend', onTouchEnd, { passive: true });
    root.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      cancelAnim();
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('touchend', onTouchEnd);
      root.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [scrollRoot, threshold, y]);

  return (
    <div className={`relative ${className}`}>
      {/* Loader doré — translaté depuis -100% du conteneur via y, suit le doigt. */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-10"
        style={{ height: MAX_PULL, transform: 'translateY(-100%)' }}
      >
        <motion.div
          style={{ y, scale }}
          className={`flex items-center justify-center w-10 h-10 rounded-full glass-strong shadow-lg border ${
            primed ? 'border-gold text-gold shadow-gold-glow' : 'border-gold/20 text-muted-2'
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

      {/* Contenu — translaté pour l'élastique iOS. Le scroll vit sur <main>, pas ici. */}
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
