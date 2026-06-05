import { motion } from 'framer-motion';

/**
 * Logins au solde de League Coins ILLIMITÉ : on affiche un ∞ premium arc-en-ciel
 * animé plutôt qu'un nombre. (Comptes fondateurs / privilégiés — ils ne sont
 * que 2 à l'avoir, ça se mérite un vrai effet.)
 */
export const INFINITE_COIN_LOGINS = new Set(['abidaux', 'throbert']);

export function hasInfiniteCoins(login?: string | null): boolean {
  return !!login && INFINITE_COIN_LOGINS.has(login.toLowerCase());
}

/**
 * Solde de League Coins. Affiche le nombre, ou un ∞ arc-en-ciel RGB animé pour
 * les comptes à solde illimité. Le ∞ est volontairement plus grand que le texte
 * environnant (1.7×) pour rester lisible et spectaculaire dans tous les contextes.
 */
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

// Arc-en-ciel ROYGBIV complet qui se répète 2× pour un loop parfaitement seamless
const RAINBOW =
  'linear-gradient(to right, #ff0000, #ff7700, #ffee00, #00ee77, #00aaff, #7700ff, #ff0066, #ff0000, #ff7700, #ffee00, #00ee77, #00aaff, #7700ff, #ff0066, #ff0000)';

// Couleurs RGB des étincelles : rouge, vert, bleu — tournent en décalé
const SPARKLE_COLORS = ['#ff4466', '#44ffbb', '#44aaff'];
const SPARKLE_SHADOWS = [
  'rgba(255,68,102,0.9)',
  'rgba(68,255,187,0.9)',
  'rgba(68,170,255,0.9)',
];

// 3 étincelles autour du ∞ — scintillent en décalé, chacune d'une couleur primaire RGB
const SPARKLES = [
  { top: '-14%', left: '6%', size: '0.42em', delay: 0 },
  { top: '52%', left: '88%', size: '0.34em', delay: 0.7 },
  { top: '70%', left: '14%', size: '0.3em', delay: 1.3 },
];

function InfiniteGlyph({ className = '' }: { className?: string }) {
  return (
    <motion.span
      className={`relative inline-flex items-center justify-center align-middle leading-none font-black ${className}`}
      style={{ fontSize: '1.7em' }}
      animate={{ scale: [1, 1.08, 1], y: [0, -1, 0] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      aria-label="solde illimité"
      title="Solde illimité — accès fondateur"
    >
      {/* Halo conic RGB tournant derrière le glyphe */}
      <motion.span
        aria-hidden
        className="absolute pointer-events-none rounded-full"
        style={{
          width: '2em',
          height: '2em',
          background:
            'conic-gradient(from 0deg, #ff0000, #ff7700, #ffee00, #00ee77, #00aaff, #7700ff, #ff0066, #ff0000)',
          filter: 'blur(10px)',
          opacity: 0.55,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />

      {/* Glyphe ∞ : arc-en-ciel RGB complet qui parcourt le signe comme une route.
          backgroundSize 200% + animation rgb-road déplace le gradient de 0→100%
          (= exactement une période, seamless) en continu. */}
      <span
        className="relative"
        style={{
          backgroundImage: RAINBOW,
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          animation: 'rgb-road 2.5s linear infinite',
          filter:
            'drop-shadow(0 0 9px rgba(0,170,255,0.65)) drop-shadow(0 0 5px rgba(255,0,100,0.75)) drop-shadow(0 0 3px rgba(255,238,0,0.55))',
        }}
      >
        ∞
      </span>

      {/* Étincelles RGB colorées (rouge / vert / bleu) */}
      {SPARKLES.map((s, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute pointer-events-none font-black"
          style={{
            top: s.top,
            left: s.left,
            fontSize: s.size,
            color: SPARKLE_COLORS[i % 3],
            textShadow: `0 0 6px ${SPARKLE_SHADOWS[i % 3]}`,
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
