import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { haptic } from '../feedback/useHaptic';

interface FABProps {
  onClick: () => void;
  Icon?: LucideIcon;
  label?: string;
  /** Si true, le bouton respire avec un glow périodique — utilisé pour attirer l'attention. */
  pulse?: boolean;
}

/**
 * Floating Action Button — toujours visible au-dessus de la tabbar mobile,
 * position respectant safe-area-bottom. Action principale d'un écran.
 *
 * Le bouton est rendu via un Portal sur document.body pour échapper à tout
 * ancêtre `transform` (motion.div de PullToRefresh, PageTransition…) qui
 * casserait le `position: fixed` en CSS.
 *
 * Pattern :
 *   <FAB onClick={() => setSheetOpen(true)} label="Déclarer une game" />
 */
export function FAB({ onClick, Icon = Plus, label, pulse = false }: FABProps) {
  const button = (
    <motion.button
      type="button"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={() => {
        haptic('medium');
        onClick();
      }}
      aria-label={label}
      className={`fixed right-4 z-50 flex items-center justify-center gap-2 h-14 px-5 rounded-full bg-gradient-to-br from-teal to-teal-dim text-[#001416] font-extrabold text-sm uppercase tracking-wider tap-transparent ${
        pulse ? 'animate-glow-pulse' : ''
      }`}
      style={{
        bottom: 'calc(72px + env(safe-area-inset-bottom))',
        boxShadow: '0 8px 24px rgba(0,217,220,0.35), 0 0 32px rgba(0,217,220,0.25)',
      }}
    >
      <Icon className="w-5 h-5" strokeWidth={3} />
      {label && <span>{label}</span>}
    </motion.button>
  );

  // Portal sur document.body → échappe aux `transform` des ancêtres (motion.div,
  // PullToRefresh, PageTransition) qui cassent `position: fixed`.
  return createPortal(button, document.body);
}
