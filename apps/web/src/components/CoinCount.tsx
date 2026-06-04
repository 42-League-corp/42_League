import { motion } from 'framer-motion';

/**
 * Logins au solde de League Coins ILLIMITÉ : on affiche un ∞ doré scintillant
 * et animé plutôt qu'un nombre. (Comptes fondateurs / privilégiés.)
 */
export const INFINITE_COIN_LOGINS = new Set(['abidaux', 'throbert']);

export function hasInfiniteCoins(login?: string | null): boolean {
  return !!login && INFINITE_COIN_LOGINS.has(login.toLowerCase());
}

/**
 * Solde de League Coins. Affiche le nombre, ou un ∞ doré animé (scintillant +
 * halo pulsé + légère respiration) pour les comptes à solde illimité.
 * Hérite de la taille de police du parent → s'intègre partout.
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

function InfiniteGlyph({ className = '' }: { className?: string }) {
  return (
    <motion.span
      className={`relative inline-flex items-center justify-center leading-none font-black ${className}`}
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      aria-label="solde illimité"
      title="Solde illimité"
    >
      {/* Halo pulsé en arrière-plan */}
      <motion.span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        animate={{ opacity: [0.35, 0.85, 0.35] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ color: '#d9b3ff', filter: 'blur(7px)' }}
      >
        ∞
      </motion.span>
      {/* Glyphe scintillant : dégradé or → blanc → violet qui balaie en continu */}
      <span
        className="relative"
        style={{
          backgroundImage:
            'linear-gradient(105deg, #ffe9a8 0%, #fff7e4 22%, #d9b3ff 48%, #ffc94a 72%, #ffe9a8 100%)',
          backgroundSize: '220% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          animation: 'shimmer 2.4s linear infinite',
          filter: 'drop-shadow(0 0 6px rgba(217,179,255,0.55))',
        }}
      >
        ∞
      </span>
    </motion.span>
  );
}
