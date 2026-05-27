import { motion } from 'framer-motion';

/**
 * Skeleton loader avec shimmer — utilisé en fallback Suspense pour les routes lazy
 * et pour les états de chargement explicites.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-xl ${className}`} />;
}

/**
 * Skeleton pour les pages mobiles — mime la structure générique :
 * hero card en haut + 3 sections de cartes empilées.
 * Évite le flash blanc en attendant que le chunk lazy se charge.
 */
export function PageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="space-y-5 w-full"
    >
      {/* Hero placeholder */}
      <Skeleton className="h-[280px] rounded-3xl" />

      {/* CTA row placeholder */}
      <div className="grid grid-cols-3 gap-2.5">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>

      {/* Section header */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-24" />
        <div className="flex-1 h-px bg-border/40" />
      </div>

      {/* Cards */}
      <div className="space-y-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </motion.div>
  );
}
