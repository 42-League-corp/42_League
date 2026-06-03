import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { haptic } from '../../../mobile/feedback/useHaptic';

type Tone = 'amber' | 'gold';

interface BigActionButtonProps {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  /** Décor à droite (emojis, flèche…). */
  accessory?: React.ReactNode;
  tone?: Tone;
  onClick: () => void;
}

const TONE_BG: Record<Tone, string> = {
  amber: 'linear-gradient(135deg, #2a241c 0%, #1d1914 60%, #15120e 100%)',
  gold: 'linear-gradient(135deg, #2c2519 0%, #1f1a12 55%, #161209 100%)',
};

/**
 * Gros CTA premium réutilisable pour la page Défis (Déclarer / Défier).
 * Reprend le style « plaque dorée biseautée » du screenshot 42 League.
 */
export function BigActionButton({
  Icon,
  title,
  subtitle,
  accessory,
  tone = 'amber',
  onClick,
}: BigActionButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={() => {
        haptic('medium');
        onClick();
      }}
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -2 }}
      className="shine group relative w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl overflow-hidden tap-transparent transition-all border border-gold/30 active:border-gold"
      style={{
        background: TONE_BG[tone],
        boxShadow:
          'inset 0 1px 0 rgba(255,215,120,0.10), 0 8px 24px -12px rgba(255,201,74,0.4), 0 1px 0 rgba(255,201,74,0.06)',
      }}
    >
      <div className="absolute inset-0 hud-diag opacity-50 pointer-events-none" />

      <div className="relative flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center border border-gold/50 group-hover:scale-110 transition-transform"
          style={{
            background: 'linear-gradient(135deg, rgba(255,201,74,0.25), rgba(255,201,74,0.08))',
            boxShadow:
              'inset 0 1px 0 rgba(255,247,228,0.2), 0 0 12px rgba(255,201,74,0.25)',
          }}
        >
          <Icon className="w-4 h-4 text-gold" strokeWidth={2.75} />
        </div>
        <div className="text-left">
          <div className="font-gaming text-sm font-extrabold text-text-strong tracking-wide uppercase">
            {title}
          </div>
          <div className="text-[10px] text-muted uppercase tracking-[0.16em] font-extrabold">
            {subtitle}
          </div>
        </div>
      </div>

      <div className="relative flex items-center gap-1.5 text-base opacity-90">
        {accessory}
        <span className="text-gold text-lg group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </motion.button>
  );
}
