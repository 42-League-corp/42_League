import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface StaggerListProps {
  children: ReactNode;
  /** Délai entre chaque enfant en secondes (default: 0.05). */
  stagger?: number;
  /** Délai avant le premier enfant (default: 0.02). */
  startDelay?: number;
  className?: string;
}

/**
 * Conteneur qui anime ses enfants directs en cascade (stagger reveal).
 *
 * Le wrapper applique `staggerChildren` via framer-motion variants ; chaque
 * enfant doit être enveloppé dans <StaggerItem> pour participer à l'animation.
 *
 * Respecte `prefers-reduced-motion` → bypass complet de l'animation.
 *
 * Usage :
 *   <StaggerList>
 *     {items.map((x) => (
 *       <StaggerItem key={x.id}><Card>...</Card></StaggerItem>
 *     ))}
 *   </StaggerList>
 */
export function StaggerList({
  children,
  stagger = 0.05,
  startDelay = 0.02,
  className = '',
}: StaggerListProps) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: stagger,
            delayChildren: startDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10, scale: 0.985 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
