/**
 * Trophée « Smash » : une Smash Ball posée sur un socle, pour les tournois et
 * titres du mode smash (équivalent de TournamentCup côté babyfoot).
 */
export function SmashTrophy({
  accent = '#ff4d5c',
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
      aria-label="Trophée Smash"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="st-ball" cx="40%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="42%" stopColor="#ffb24a" />
          <stop offset="100%" stopColor={accent} />
        </radialGradient>
        <radialGradient id="st-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.4" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Halo */}
      <circle cx="60" cy="46" r="46" fill="url(#st-glow)" />

      {/* Smash Ball */}
      <circle cx="60" cy="44" r="30" fill="url(#st-ball)" stroke="#fff" strokeWidth="2.5" />
      {/* Swirl façon logo Smash */}
      <path
        d="M60 16 C50 32 50 56 60 72 M32 44 C48 36 72 36 88 44"
        fill="none"
        stroke="#7a0d15"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.9"
      />
      {/* Reflet */}
      <ellipse cx="50" cy="34" rx="8" ry="5" fill="#fff" opacity="0.55" />

      {/* Socle */}
      <rect x="54" y="74" width="12" height="12" fill={accent} fillOpacity="0.8" />
      <path d="M40 86 H80 L74 98 H46 Z" fill={accent} fillOpacity="0.85" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
      <rect x="36" y="98" width="48" height="6" rx="2" fill={accent} />
    </svg>
  );
}
