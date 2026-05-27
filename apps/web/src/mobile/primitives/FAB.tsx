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
      className={`shine fixed right-4 z-50 flex items-center justify-center gap-2 h-14 px-5 rounded-full text-[#1a0d00] font-display font-black text-sm uppercase tracking-wider tap-transparent border border-[#ffc966]/60 ${
        pulse ? 'animate-glow-pulse' : ''
      }`}
      style={{
        bottom: 'calc(72px + env(safe-area-inset-bottom))',
        background:
          'linear-gradient(180deg, #ffa83a 0%, #f08020 55%, #c5520a 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,247,228,0.5), inset 0 -1px 0 rgba(0,0,0,0.35), 0 8px 28px rgba(255,128,32,0.5), 0 0 36px rgba(255,128,32,0.25)',
      }}
    >
      <Icon className="w-5 h-5 relative z-10" strokeWidth={3} />
      {label && <span className="relative z-10">{label}</span>}
    </motion.button>
  );

  // Portal sur document.body → échappe aux `transform` des ancêtres (motion.div,
  // PullToRefresh, PageTransition) qui cassent `position: fixed`.
  return createPortal(button, document.body);
}
