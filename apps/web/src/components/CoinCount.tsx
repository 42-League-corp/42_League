import { motion } from 'framer-motion';

/**
 * Logins au solde de League Coins ILLIMITÉ : on affiche un ∞ premium scintillant
 * et animé plutôt qu'un nombre. (Comptes fondateurs / privilégiés — ils ne sont
 * que 2 à l'avoir, ça se mérite un vrai effet.)
 */
export const INFINITE_COIN_LOGINS = new Set(['abidaux', 'throbert']);

export function hasInfiniteCoins(login?: string | null): boolean {
  return !!login && INFINITE_COIN_LOGINS.has(login.toLowerCase());
}

/**
 * Solde de League Coins. Affiche le nombre, ou un ∞ premium animé pour les
 * comptes à solde illimité. Le ∞ est volontairement plus grand que le texte
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

// 3 étincelles autour du ∞ — scintillent en décalé.
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
      {/* Anneau de lumière conique qui tourne, derrière le glyphe */}
      <motion.span
        aria-hidden
        className="absolute pointer-events-none rounded-full"
        style={{
          width: '1.9em',
          height: '1.9em',
          background:
            'conic-gradient(from 0deg, transparent 0deg, rgba(255,201,74,0.55) 50deg, transparent 110deg, rgba(217,179,255,0.55) 200deg, transparent 270deg, rgba(120,230,255,0.45) 320deg, transparent 360deg)',
          filter: 'blur(6px)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      />

      {/* Halo pulsé doux */}
      <motion.span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        animate={{ opacity: [0.4, 0.95, 0.4] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ color: '#d9b3ff', filter: 'blur(9px)' }}
      >
        ∞
      </motion.span>

      {/* Glyphe ∞ : dégradé or → blanc → violet → cyan qui balaie en continu */}
      <span
        className="relative"
        style={{
          backgroundImage:
            'linear-gradient(105deg, #ffe9a8 0%, #fff7e4 18%, #d9b3ff 40%, #8fe9ff 58%, #ffc94a 80%, #ffe9a8 100%)',
          backgroundSize: '250% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          animation: 'shimmer 2.6s linear infinite',
          filter: 'drop-shadow(0 0 8px rgba(217,179,255,0.7)) drop-shadow(0 0 3px rgba(255,201,74,0.8))',
        }}
      >
        ∞
      </span>

      {/* Étincelles scintillantes */}
      {SPARKLES.map((s, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute pointer-events-none font-black"
          style={{ top: s.top, left: s.left, fontSize: s.size, color: '#fff7e4', textShadow: '0 0 6px rgba(255,233,168,0.9)' }}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4], rotate: [0, 90, 180] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: s.delay }}
        >
          ✦
        </motion.span>
      ))}
    </motion.span>
  );
}
