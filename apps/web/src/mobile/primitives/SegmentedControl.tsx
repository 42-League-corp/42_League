import { motion } from 'framer-motion';
import { haptic } from '../feedback/useHaptic';

export interface SegmentChoice<T extends string> {
  value: T;
  label: string;
  badge?: number;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  choices: SegmentChoice<T>[];
  className?: string;
}

/**
 * Segmented Control iOS-like :
 * - Capsule de fond qui glisse via layoutId framer
 * - Tap haptique
 * - Tactile-friendly (44px de hauteur)
 *
 * Usage : pour filtrer une liste (ex. "Tous / Top 10 / Autour de moi")
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  choices,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={`relative inline-flex w-full p-1 rounded-full bg-bg-1/80 border border-gold/20 backdrop-blur-md no-select shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)] ${className}`}
    >
      {choices.map((c) => {
        const active = c.value === value;
        return (
          <button
            key={c.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => {
              if (active) return;
              haptic('selection');
              onChange(c.value);
            }}
            className={`relative flex-1 flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-extrabold uppercase tracking-wider rounded-full tap-transparent transition-colors z-10 ${
              active ? 'text-[#1a0d00]' : 'text-muted-2 active:text-text'
            }`}
          >
            {active && (
              <motion.span
                layoutId="segmented-bg"
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                className="absolute inset-0 rounded-full metal-plate-gold -z-10"
              />
            )}
            <span className="relative z-10">{c.label}</span>
            {c.badge !== undefined && c.badge > 0 && (
              <span
                className={`relative z-10 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center tabular-nums ${
                  active ? 'bg-[#1a0d00]/80 text-gold' : 'bg-red text-white'
                }`}
              >
                {c.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
