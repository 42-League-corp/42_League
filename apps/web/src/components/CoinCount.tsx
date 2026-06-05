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
// Deux lobes elliptiques se croisant en (100, 50) dans un espace 200×100.
const INF_PATH =
  'M 100 50 C 100 22 82 8 65 8 C 45 8 28 22 28 50 C 28 78 45 92 65 92 C 82 92 100 78 100 50 C 100 22 118 8 135 8 C 155 8 172 22 172 50 C 172 78 155 92 135 92 C 118 92 100 78 100 50 Z';

// Longueur estimée du tracé ≈ 2 × périmètre ellipse (36×42) ≈ 490 unités.
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
        viewBox="20 3 161 94"
        width="1.55em"
        height="0.6em"
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
              fill="none"
              stroke={`hsl(${s.hue} 100% 58%)`}
              strokeWidth={16}
              strokeLinecap="round"
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
            fill="none"
            stroke={`hsl(${s.hue} 100% 62%)`}
            strokeWidth={9}
            strokeLinecap="round"
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
          stroke="rgba(255,255,255,0.38)"
          strokeWidth={2.5}
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
