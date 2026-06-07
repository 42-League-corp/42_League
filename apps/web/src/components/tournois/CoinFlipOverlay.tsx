import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import CoinFlip from './CoinFlip';

// ─────────────────────────────────────────────────────────────────────────────
// CoinFlipOverlay — pile-ou-face affiché EN GRAND, centré sur toute la page, posé
// au-dessus du reste. Reste visible pendant tout le lancer (rotation) puis le
// résultat annoncé (« {name} gagne le tirage ») jusqu'à ce que `open` repasse à
// false. Non bloquant (pointer-events: none) : c'est purement une cinématique.
// La logique (flipping / side / winner) vit dans la carte du match.
// ─────────────────────────────────────────────────────────────────────────────

export function CoinFlipOverlay({
  open,
  side,
  flipping,
  winnerName,
  winnerLogin,
  winnerImageUrl,
  t,
}: {
  open: boolean;
  side: 'heads' | 'tails' | null;
  flipping: boolean;
  winnerName?: string;
  winnerLogin?: string;
  winnerImageUrl?: string | null;
  t: (k: string) => string;
}) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="coinflip-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            // Voile sombre + halo doré derrière la pièce.
            background:
              'radial-gradient(60% 50% at 50% 45%, rgba(255,170,60,0.16) 0%, rgba(6,4,10,0.72) 55%, rgba(4,2,6,0.9) 100%)',
            backdropFilter: 'blur(3px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.6, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
          >
            <CoinFlip
              side={side}
              flipping={flipping}
              winnerName={winnerName}
              winnerLogin={winnerLogin}
              winnerImageUrl={winnerImageUrl}
              onFlip={undefined}
              t={t}
              size={188}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
