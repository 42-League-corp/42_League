import { useGameMode } from '../hooks/useGameMode';

/**
 * Bandeau de fond du classement, thématisé par mode :
 *  - babyfoot : feutrine verte + lignes de terrain ;
 *  - smash : champ de bataille rouge + Smash Ball.
 * Purement décoratif (image de fond représentant la discipline).
 */
export function LeaderboardBanner() {
  const { isSmash } = useGameMode();
  return (
    <div className="relative h-24 sm:h-28 -mx-4 sm:mx-0 sm:rounded-xl overflow-hidden mb-4 border-b sm:border border-border/50">
      {isSmash ? <SmashField /> : <FoosField />}
      <div className="absolute inset-0 bg-gradient-to-t from-bg-1/90 via-bg-1/30 to-transparent" />
      <div className="absolute left-4 bottom-3">
        <div className="font-display text-xl sm:text-2xl font-black text-text-strong tracking-tight drop-shadow">
          Classement {isSmash ? 'Smash' : 'Babyfoot'}
        </div>
        <div
          className={`text-[10px] uppercase tracking-[0.18em] font-extrabold ${
            isSmash ? 'text-red' : 'text-gold'
          }`}
        >
          {isSmash ? '1 contre 1 · stocks' : '1 contre 1 · 10 buts'}
        </div>
      </div>
    </div>
  );
}

function FoosField() {
  return (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 120" aria-hidden>
      <defs>
        <linearGradient id="foos-felt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#13402f" />
          <stop offset="100%" stopColor="#0c2a20" />
        </linearGradient>
      </defs>
      <rect width="400" height="120" fill="url(#foos-felt)" />
      {/* Lignes de terrain */}
      <rect x="14" y="12" width="372" height="96" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2" rx="6" />
      <line x1="200" y1="12" x2="200" y2="108" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2" />
      <circle cx="200" cy="60" r="22" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2" />
      {/* Barres de babyfoot */}
      {[70, 140, 260, 330].map((x) => (
        <g key={x}>
          <line x1={x} y1="6" x2={x} y2="114" stroke="#c0a060" strokeOpacity="0.5" strokeWidth="3" />
          <circle cx={x} cy="60" r="5" fill="#1a1208" stroke="#c0a060" strokeOpacity="0.6" strokeWidth="2" />
        </g>
      ))}
      <circle cx="200" cy="60" r="6" fill="#f5f0e0" opacity="0.85" />
    </svg>
  );
}

function SmashField() {
  return (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 120" aria-hidden>
      <defs>
        <linearGradient id="smash-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a0d12" />
          <stop offset="100%" stopColor="#160a0c" />
        </linearGradient>
        <radialGradient id="smash-ball2" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="45%" stopColor="#ff8a3a" />
          <stop offset="100%" stopColor="#d11f2f" />
        </radialGradient>
      </defs>
      <rect width="400" height="120" fill="url(#smash-bg)" />
      {/* Éclats */}
      {[40, 120, 300, 360].map((x, i) => (
        <path
          key={x}
          d={`M${x} ${20 + i * 8} l8 18 -14 -4 6 16 -16 -10`}
          fill="#ff5366"
          opacity="0.18"
        />
      ))}
      {/* Smash Ball */}
      <g transform="translate(330,60)">
        <circle r="34" fill="url(#smash-ball2)" stroke="#fff" strokeWidth="2" opacity="0.9" />
        <path d="M0 -32 C-9 -10 -9 14 0 32 M-32 0 C-10 -9 14 -9 32 0" fill="none" stroke="#7a0d15" strokeWidth="5" strokeLinecap="round" opacity="0.85" />
      </g>
    </svg>
  );
}
