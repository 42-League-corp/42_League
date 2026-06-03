import { useGameMode } from '../hooks/useGameMode';

/**
 * Bandeau visuel thématisé par discipline — élément de contexte DISCRET
 * positionné en tête du leaderboard. Il donne l'atmosphère (terrain, couleurs)
 * sans prendre la parole : pas de titre "Classement Babyfoot" en gros, juste
 * une immersion visuelle subtile.
 *
 * - Babyfoot : terrain en feutrine verte avec lignes et barres
 * - Smash    : fond sombre rouge avec Smash Ball
 * - Échecs   : échiquier discret vert foncé
 */
export function LeaderboardBanner() {
  const { game } = useGameMode();
  return (
    <div className="relative -mx-4 sm:mx-0 h-16 sm:h-20 sm:rounded-xl overflow-hidden mb-5">
      {game === 'smash' ? <SmashField /> : game === 'chess' ? <ChessField /> : game === 'streetfighter' ? <SfField /> : <FoosField />}
      {/* Fondu vers le bas — le contenu de la page apparaît proprement */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg-1 via-bg-1/50 to-transparent" />
      {/* Petit label discret */}
      <div className="absolute left-4 bottom-2 flex items-center gap-2 opacity-50">
        <div className="w-1 h-3 bg-gradient-to-b from-accent to-accent-dim rounded-full" />
        <span className="text-[9px] uppercase tracking-[0.22em] font-extrabold text-muted-2">
          {game === 'smash' ? 'Smash Bros' : game === 'chess' ? 'Échecs' : game === 'streetfighter' ? 'Street Fighter' : 'Babyfoot'} · classement
        </span>
      </div>
    </div>
  );
}

function ChessField() {
  const cells = [];
  for (let r = 0; r < 4; r++)
    for (let col = 0; col < 14; col++)
      if ((r + col) % 2 === 0)
        cells.push(<rect key={`${r}-${col}`} x={col * 28.6} y={r * 30} width="28.6" height="30" fill="#0f3d2a" opacity="0.55" />);
  return (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 120" aria-hidden>
      <rect width="400" height="120" fill="#080f0a" />
      {cells}
      <g transform="translate(360,55)" fill="#56c46e" opacity="0.6">
        <path d="M0 -22 v6 M-4 -18 h8" stroke="#56c46e" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M0 -14 C-9 -14 -11 -4 -6 2 L-9 18 h18 l-3 -16 C11 -4 9 -14 0 -14 Z" />
        <rect x="-12" y="18" width="24" height="6" rx="2" />
      </g>
    </svg>
  );
}

function FoosField() {
  return (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 120" aria-hidden>
      <defs>
        <linearGradient id="lb-felt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d3322" />
          <stop offset="100%" stopColor="#08201a" />
        </linearGradient>
      </defs>
      <rect width="400" height="120" fill="url(#lb-felt)" />
      <rect x="14" y="12" width="372" height="96" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" rx="6" />
      <line x1="200" y1="12" x2="200" y2="108" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
      <circle cx="200" cy="60" r="22" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
      {[70, 140, 260, 330].map((x) => (
        <g key={x}>
          <line x1={x} y1="6" x2={x} y2="114" stroke="#a08040" strokeOpacity="0.35" strokeWidth="2" />
          <circle cx={x} cy="60" r="4" fill="#0f0a04" stroke="#a08040" strokeOpacity="0.4" strokeWidth="1.5" />
        </g>
      ))}
      <circle cx="200" cy="60" r="6" fill="rgba(245,240,225,0.6)" />
    </svg>
  );
}

function SfField() {
  return (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 120" aria-hidden>
      <defs>
        <linearGradient id="lb-sf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2a1404" />
          <stop offset="100%" stopColor="#0d0602" />
        </linearGradient>
      </defs>
      <rect width="400" height="120" fill="url(#lb-sf)" />
      {[40, 130, 280, 370].map((x, i) => (
        <path key={x} d={`M${x} ${14 + i * 6} l6 14 -10 -3 5 12 -12 -8`}
          fill="#ff7a18" opacity="0.12" />
      ))}
      <image href="/sf-color.png" x="248" y="16" width="140" height="88" preserveAspectRatio="xMidYMid meet" opacity="0.9" />
    </svg>
  );
}

function SmashField() {
  return (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 120" aria-hidden>
      <defs>
        <linearGradient id="lb-smash" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#200408" />
          <stop offset="100%" stopColor="#0d0204" />
        </linearGradient>
      </defs>
      <rect width="400" height="120" fill="url(#lb-smash)" />
      {[40, 130, 280, 370].map((x, i) => (
        <path key={x} d={`M${x} ${14 + i * 6} l6 14 -10 -3 5 12 -12 -8`}
          fill="#ff3d50" opacity="0.12" />
      ))}
      <image href="/smash-color.png" x="288" y="10" width="100" height="100" preserveAspectRatio="xMidYMid meet" opacity="0.9" />
    </svg>
  );
}
