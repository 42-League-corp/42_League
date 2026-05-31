import type { ReactNode } from 'react';

type Tone = 'teal' | 'win' | 'loss' | 'neutral' | 'gold';

interface StatCardProps {
  value: string;
  label: ReactNode;
  tone?: Tone;
}

const TONE: Record<Tone, string> = {
  teal: 'text-gold',
  win: 'text-gold',
  loss: 'text-red',
  neutral: 'text-text-strong',
  gold: 'text-gold',
};

/**
 * Plaque de statistique en acier brossé — inspirée des plaques métalliques
 * du screenshot (W / L / WR% / STREAK).
 */
export function StatCard({ value, label, tone = 'neutral' }: StatCardProps) {
  return (
    <div className="relative metal-plate rounded-lg p-3 text-center group transition-transform hover:-translate-y-0.5">
      <div
        className={`relative z-10 font-display text-2xl font-black tabular-nums leading-none ${TONE[tone]}`}
        style={{
          textShadow:
            tone === 'loss'
              ? '0 1px 0 rgba(0,0,0,0.6), 0 0 12px rgba(255,83,102,0.4)'
              : tone === 'neutral'
                ? '0 1px 0 rgba(0,0,0,0.6)'
                : '0 1px 0 rgba(0,0,0,0.6), 0 0 12px rgba(255,201,74,0.4)',
        }}
      >
        {value}
      </div>
      <div className="relative z-10 text-[10px] uppercase tracking-[0.18em] text-muted-2 mt-1.5 font-extrabold flex items-center justify-center gap-1">
        {label}
      </div>
    </div>
  );
}
