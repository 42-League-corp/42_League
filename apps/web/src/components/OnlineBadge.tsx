interface OnlineBadgeProps {
  /** Hôte 42 ex. "c1r7s8" */
  host: string;
  /** compact = pastille seule (pour les avatars), sinon pastille + texte */
  compact?: boolean;
  className?: string;
}

export function OnlineBadge({ host, compact = false, className = '' }: OnlineBadgeProps) {
  if (compact) {
    return (
      <span
        className={`block w-2.5 h-2.5 rounded-full bg-[#4ade80] ring-2 ring-bg-0 shadow-[0_0_6px_rgba(74,222,128,0.8)] ${className}`}
        title={`En ligne — ${host}`}
        aria-label={`En ligne — ${host}`}
      />
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-bold text-[#4ade80] ${className}`}
      aria-label={`En ligne — ${host}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] shadow-[0_0_5px_rgba(74,222,128,0.9)] animate-pulse flex-shrink-0" />
      {host}
    </span>
  );
}
