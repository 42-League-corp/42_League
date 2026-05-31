/**
 * Trophée « Échecs » : un roi sur un socle, pour les tournois et titres du mode
 * échecs (équivalent vert de TournamentCup / SmashTrophy).
 */
export function ChessTrophy({
  accent = '#56c46e',
  className = '',
}: {
  accent?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Trophée Échecs"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="ct-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id="ct-glow" cx="50%" cy="38%" r="58%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="60" cy="46" r="46" fill="url(#ct-glow)" />

      {/* Croix du roi */}
      <path d="M60 8 v12 M52 14 h16" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      {/* Couronne / tête */}
      <path
        d="M60 22 C50 22 47 32 53 38 L48 64 h24 l-5 -26 C73 32 70 22 60 22 Z"
        fill="url(#ct-body)"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Reflet */}
      <path d="M55 28 C52 36 53 50 56 60" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" />

      {/* Socle */}
      <rect x="46" y="64" width="28" height="10" rx="2" fill={accent} fillOpacity="0.85" />
      <path d="M40 74 H80 L74 90 H46 Z" fill="url(#ct-body)" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
      <rect x="36" y="90" width="48" height="6" rx="2" fill={accent} />
    </svg>
  );
}
