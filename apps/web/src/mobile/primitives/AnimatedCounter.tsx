import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  /** Durée de l'anim en secondes. Plus c'est long, plus le compte est dramatique. */
  duration?: number;
  /** Nombre de décimales. */
  decimals?: number;
  className?: string;
}

/**
 * Compteur numérique animé "count-up" à l'apparition.
 * Utile pour ELO, win rate, stats sur la hero card.
 *
 * Implémentation : on anime un scalar simple via `animate(from, to, opts)` et
 * on `onUpdate` met à jour un état React local. Plus simple et plus robuste
 * en types que `animate(motionValue, value, opts)` qui dépend du build de framer-motion.
 */
export function AnimatedCounter({
  value,
  duration = 1.2,
  decimals = 0,
  className = '',
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const controls = animate(fromRef.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
      onComplete: () => {
        fromRef.current = value;
      },
    });
    return () => controls.stop();
  }, [value, duration]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString();
  return <span className={className}>{formatted}</span>;
}
