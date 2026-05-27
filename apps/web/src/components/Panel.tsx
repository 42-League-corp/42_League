import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  sub?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Panneau cartouche RPG : fond anthracite, bordure dorée subtile, accent gold sur titre.
 */
export function Panel({ title, sub, children, className = '' }: PanelProps) {
  return (
    <section
      className={`relative card-hud overflow-hidden p-5 sm:p-6 ${className}`}
    >
      {/* Filigrane diagonale très discret */}
      <div className="absolute inset-0 hud-diag pointer-events-none opacity-50" />

      <header className="relative mb-4 flex items-baseline gap-2.5">
        {/* Glyphe gold à gauche */}
        <span className="inline-block w-1 h-4 bg-gradient-to-b from-gold via-gold to-gold-dim rounded-sm" />
        <h2 className="font-gaming text-base font-extrabold uppercase tracking-[0.16em] text-text-strong leading-none">
          {title}
        </h2>
        {sub && (
          <span className="text-[10px] font-bold text-muted normal-case tracking-[0.1em] ml-1">
            {sub}
          </span>
        )}
      </header>

      <div className="relative">{children}</div>
    </section>
  );
}
