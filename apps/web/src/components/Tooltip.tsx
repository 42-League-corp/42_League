import { type ReactNode } from 'react';

interface TooltipProps {
  /** Texte affiché dans la bulle. */
  label: ReactNode;
  children: ReactNode;
  className?: string;
  /** Position de la bulle (par défaut au-dessus). */
  side?: 'top' | 'bottom';
}

/**
 * Tooltip 100% CSS — apparition **instantanée** au survol (contrairement à
 * l'attribut natif `title` qui a un délai navigateur de ~0,5–1 s).
 * Utilise un groupe nommé `group/tt` pour ne pas réagir au survol d'un parent.
 */
export function Tooltip({ label, children, className = '', side = 'top' }: TooltipProps) {
  const pos =
    side === 'top'
      ? 'bottom-full mb-1.5'
      : 'top-full mt-1.5';
  return (
    <span className={`relative inline-flex items-center group/tt ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 ${pos} whitespace-nowrap rounded-md border border-gold/30 bg-bg-0/95 px-2 py-1 text-[11px] font-semibold leading-none text-text-strong opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-75 group-hover/tt:opacity-100`}
      >
        {label}
      </span>
    </span>
  );
}
