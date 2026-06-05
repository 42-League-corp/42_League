/**
 * VersusOverlay — écran « VERSUS » plein écran déclenché quand l'organisateur
 * désigne le match suivant (« match suivant »). Les deux combattants entrent en
 * trombe depuis chaque bord, un « VS » claque au centre, puis l'overlay se
 * referme tout seul (~3.5 s) — purement cinématique (pointer-events: none).
 *
 * State-driven : le parent l'ouvre quand `tournament.activeMatchId` change de
 * valeur (cf. TournoiDetailPage). Rendu via createPortal pour échapper aux
 * transforms d'animation de page (même pattern que CoinFlipOverlay / cérémonie).
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

export interface VersusFighter {
  login: string;
  imageUrl?: string | null;
}

export function VersusOverlay({
  open,
  a,
  b,
  accent,
  onDone,
  t,
}: {
  open: boolean;
  a: VersusFighter | null;
  b: VersusFighter | null;
  accent: string;
  onDone: () => void;
  t: (k: string) => string;
}) {
  // Auto-fermeture : l'animation est non bloquante, on referme après l'effet.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(onDone, 3500);
    return () => clearTimeout(id);
  }, [open, onDone]);

  return createPortal(
    <AnimatePresence>
      {open && a && b && (
        <motion.div
          key="versus-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483520,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background:
              'radial-gradient(70% 60% at 50% 50%, rgba(10,6,16,0.78) 0%, rgba(4,2,8,0.92) 100%)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* Éclair diagonal qui balaie l'écran au moment du clash. */}
          <motion.div
            aria-hidden
            initial={{ x: '-120%', opacity: 0 }}
            animate={{ x: '120%', opacity: [0, 0.9, 0] }}
            transition={{ delay: 0.45, duration: 0.7, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '40%',
              transform: 'skewX(-18deg)',
              background: `linear-gradient(90deg, transparent, ${accent}55, transparent)`,
              filter: 'blur(8px)',
            }}
          />

          <div className="relative flex items-center justify-center gap-2 sm:gap-8 px-4 w-full max-w-3xl">
            <Fighter fighter={a} accent={accent} from="left" />

            {/* « VS » central : surgit en sur-échelle puis se cale. */}
            <motion.div
              initial={{ scale: 3, opacity: 0, rotate: -12 }}
              animate={{ scale: [3, 0.85, 1], opacity: 1, rotate: 0 }}
              transition={{ delay: 0.35, duration: 0.6, ease: [0.2, 0.9, 0.2, 1] }}
              className="relative z-10 shrink-0 font-display font-black italic select-none"
              style={{
                fontSize: 'clamp(2.5rem, 11vw, 5.5rem)',
                lineHeight: 1,
                color: '#fff',
                WebkitTextStroke: `2px ${accent}`,
                filter: `drop-shadow(0 0 24px ${accent}cc)`,
              }}
            >
              VS
            </motion.div>

            <Fighter fighter={b} accent={accent} from="right" />
          </div>

          {/* Libellé « match en cours ». */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.4 }}
            className="absolute bottom-[14%] left-0 right-0 text-center"
          >
            <span
              className="text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.3em]"
              style={{ color: accent }}
            >
              {t('tourn.versus.nowPlaying')}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Fighter({
  fighter,
  accent,
  from,
}: {
  fighter: VersusFighter;
  accent: string;
  from: 'left' | 'right';
}) {
  const dir = from === 'left' ? -1 : 1;
  return (
    <motion.div
      initial={{ x: dir * 340, opacity: 0, scale: 0.8 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 140, damping: 16, delay: 0.05 }}
      className="flex flex-col items-center gap-2 min-w-0 flex-1"
    >
      <div
        className="rounded-full flex items-center justify-center font-display font-black text-[#0a0a0a] overflow-hidden"
        style={{
          width: 'clamp(72px, 22vw, 132px)',
          height: 'clamp(72px, 22vw, 132px)',
          fontSize: 'clamp(1.8rem, 8vw, 3rem)',
          border: `3px solid ${accent}`,
          boxShadow: `0 0 32px ${accent}88, inset 0 1px 0 rgba(255,255,255,0.25)`,
          background: fighter.imageUrl ? undefined : accent,
        }}
      >
        {fighter.imageUrl ? (
          <img src={fighter.imageUrl} alt={fighter.login} className="w-full h-full object-cover" />
        ) : (
          fighter.login[0]?.toUpperCase()
        )}
      </div>
      <span className="text-sm sm:text-base font-extrabold text-text-strong/95 max-w-[40vw] sm:max-w-[180px] truncate">
        {fighter.login}
      </span>
    </motion.div>
  );
}
