import { motion } from 'framer-motion';
import { useId } from 'react';

export const INFINITE_COIN_LOGINS = new Set(['abidaux', 'throbert']);

export function hasInfiniteCoins(login?: string | null): boolean {
  return !!login && INFINITE_COIN_LOGINS.has(login.toLowerCase());
}

export function CoinCount({
  login,
  value,
  className = '',
}: {
  login?: string | null;
  value: number;
  className?: string;
}) {
  if (!hasInfiniteCoins(login)) {
    return <span className={`tabular-nums ${className}`}>{value}</span>;
  }
  return <InfiniteGlyph className={className} />;
}

// ── SVG ∞ path ─────────────────────────────────────────────────────────────
// Lemniscate symétrique : deux lobes miroir autour du centre (100, 50) dans un
// espace 200×100. Les points de contrôle gauche/droite sont l'exact miroir
// (x → 200−x) pour une forme nette et équilibrée.
// Lemniscate ENTRELACÉE : un seul tracé continu qui se croise au centre (100,50)
// en formant un X, façon ruban — le « vrai » ∞, plein et symétrique (les lobes
// gauche/droite sont l'exact miroir autour du centre).
const INF_PATH =
  'M 20 50 C 20 20 70 20 100 50 C 130 80 180 80 180 50 C 180 20 130 20 100 50 C 70 80 20 80 20 50 Z';

// Longueur LOGIQUE imposée via l'attribut SVG `pathLength` : le navigateur
// remappe tout le calcul de pointillés sur cette valeur, indépendamment de la
// longueur géométrique réelle. dasharray (SEG+GAP) et l'offset animé (−L) sont
// donc EXACTS → le motif boucle pile, sans couture ni saccade.
const L = 490;

// 24 teintes HSL espacées de 15° — arc-en-ciel continu et lisse.
const N = 24;
const SEG = (L / N) * 1.1; // léger overlap pour éviter les trous entre segments
const GAP = L - SEG;
const DUR = 3; // secondes par boucle complète

// Segments précalculés : chacun démarre décalé de L/N le long du path.
const SEGS = Array.from({ length: N }, (_, i) => ({
  hue: (i / N) * 360,
  // delay négatif = la boucle démarre décalée → distribution uniforme à t=0
  delay: -((i / N) * DUR),
}));

// Étincelles RGB (rouge / vert / bleu)
const SPARKLES = [
  { top: '-14%', left: '6%',  size: '0.42em', delay: 0,   color: '#ff4466', shadow: 'rgba(255,68,102,0.9)' },
  { top: '52%',  left: '88%', size: '0.34em', delay: 0.7, color: '#44ffbb', shadow: 'rgba(68,255,187,0.9)' },
  { top: '70%',  left: '14%', size: '0.3em',  delay: 1.3, color: '#44aaff', shadow: 'rgba(68,170,255,0.9)' },
];

function InfiniteGlyph({ className = '' }: { className?: string }) {
  // ID unique par instance pour éviter les collisions de filtres SVG.
  const uid = useId().replace(/:/g, '');
  const filterId = `glow-inf-${uid}`;

  return (
    <motion.span
      className={`relative inline-flex items-center justify-center align-middle leading-none font-black ${className}`}
      style={{ fontSize: '1.7em' }}
      animate={{ scale: [1, 1.08, 1], y: [0, -1, 0] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      aria-label="solde illimité"
      title="Solde illimité — accès fondateur"
    >
      <svg
        viewBox="10 12 180 76"
        width="1.7em"
        height="0.72em"
        aria-hidden
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Filtre lueur — copie floue en dessous du tracé principal. */}
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
        </defs>

        {/* Couche lueur (segments floutés) */}
        <g filter={`url(#${filterId})`} opacity={0.65}>
          {SEGS.map((s, i) => (
            <path
              key={`g${i}`}
              d={INF_PATH}
              pathLength={L}
              fill="none"
              stroke={`hsl(${s.hue} 100% 58%)`}
              strokeWidth={19}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${SEG} ${GAP}`}
              style={{
                animation: `rgb-path-travel ${DUR}s linear infinite`,
                animationDelay: `${s.delay}s`,
              }}
            />
          ))}
        </g>

        {/* Segments colorés principaux — défilent le long du ∞ comme une route. */}
        {SEGS.map((s, i) => (
          <path
            key={`m${i}`}
            d={INF_PATH}
            pathLength={L}
            fill="none"
            stroke={`hsl(${s.hue} 100% 62%)`}
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${SEG} ${GAP}`}
            style={{
              animation: `rgb-path-travel ${DUR}s linear infinite`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}

        {/* Reflet blanc central — lisibilité + effet tube néon. */}
        <path
          d={INF_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </svg>

      {/* Étincelles RGB décalées */}
      {SPARKLES.map((s, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute pointer-events-none font-black"
          style={{
            top: s.top,
            left: s.left,
            fontSize: s.size,
            color: s.color,
            textShadow: `0 0 6px ${s.shadow}`,
          }}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4], rotate: [0, 90, 180] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: s.delay }}
        >
          ✦
        </motion.span>
      ))}
    </motion.span>
  );
}
