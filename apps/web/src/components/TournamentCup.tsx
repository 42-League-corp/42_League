/**
 * Visuel par défaut d'un tournoi sans photo : une coupe dessinée (SVG) posée sur
 * un dégradé "art" déterministe. Remplace l'ancien aplat de couleur peu lisible.
 * `accent` teinte la coupe (or par défaut) ; `seed` rend chaque coupe légèrement
 * unique via l'id du tournoi.
 */
export function TournamentCup({
  accent = '#ffc94a',
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
      aria-label="Coupe du tournoi"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="cup-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.95" />
          <stop offset="55%" stopColor={accent} stopOpacity="0.7" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id="cup-glow" cx="50%" cy="38%" r="55%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Halo */}
      <circle cx="60" cy="48" r="46" fill="url(#cup-glow)" />

      {/* Anses */}
      <path
        d="M34 30 C18 30 18 56 38 58"
        fill="none"
        stroke={accent}
        strokeOpacity="0.85"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M86 30 C102 30 102 56 82 58"
        fill="none"
        stroke={accent}
        strokeOpacity="0.85"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Vasque de la coupe */}
      <path
        d="M34 24 H86 V40 C86 60 74 72 60 72 C46 72 34 60 34 40 Z"
        fill="url(#cup-body)"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Reflet */}
      <path
        d="M44 30 C44 46 50 58 58 62"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.45"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Pied */}
      <rect x="55" y="72" width="10" height="14" fill={accent} fillOpacity="0.75" />
      <path
        d="M40 86 H80 L74 98 H46 Z"
        fill="url(#cup-body)"
        stroke={accent}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="36" y="98" width="48" height="6" rx="2" fill={accent} fillOpacity="0.85" />

      {/* Étoile sur la vasque */}
      <path
        d="M60 34 l3.2 6.5 7.2 1 -5.2 5.1 1.2 7.2 -6.4 -3.4 -6.4 3.4 1.2 -7.2 -5.2 -5.1 7.2 -1 Z"
        fill="#fff"
        fillOpacity="0.85"
      />
    </svg>
  );
}
