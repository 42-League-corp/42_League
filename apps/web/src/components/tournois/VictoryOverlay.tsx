/**
 * VictoryOverlay — célébration plein écran à la fin d'un tournoi (transition
 * in_progress → finished). Pluie de confettis dorés, trophée qui surgit en
 * rebond, portrait + nom du champion. Auto-fermeture (~5 s), non bloquant
 * (pointer-events: none). Rendu via createPortal pour échapper aux transforms
 * de page — même pattern que VersusOverlay / CoinFlipOverlay.
 *
 * State-driven : le parent l'ouvre quand il détecte le passage à `finished`
 * (cf. TournoiDetailPage et LiveOverlays).
 */
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

export interface VictoryChampion {
  login: string;
  imageUrl?: string | null;
}

const CONFETTI_COUNT = 90;
const VICTORY_MS = 5200;

export function VictoryOverlay({
  open,
  champion,
  tournamentName,
  accent,
  onDone,
  t,
}: {
  open: boolean;
  champion: VictoryChampion | null;
  tournamentName: string;
  accent: string;
  onDone: () => void;
  t: (k: string) => string;
}) {
  // Auto-fermeture : l'animation est non bloquante, on referme après l'effet.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(onDone, VICTORY_MS);
    return () => clearTimeout(id);
  }, [open, onDone]);

  // Confettis : positions/délais/teintes figés (recalculés si l'accent change).
  const confetti = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.1,
        duration: 2.4 + Math.random() * 2.2,
        size: 6 + Math.random() * 9,
        rotate: Math.random() * 360,
        sway: (Math.random() - 0.5) * 120,
        color: [accent, '#ffc94a', '#fff3c4', '#ffe08a', '#ffffff'][i % 5],
      })),
    [accent],
  );

  return createPortal(
    <AnimatePresence>
      {open && champion && (
        <motion.div
          key="victory-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483520,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background:
              'radial-gradient(70% 60% at 50% 42%, rgba(22,15,3,0.82) 0%, rgba(4,2,8,0.94) 100%)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* Pluie de confettis. */}
          {confetti.map((c) => (
            <motion.span
              key={c.id}
              aria-hidden
              initial={{ y: '-14vh', x: 0, opacity: 0, rotate: c.rotate }}
              animate={{ y: '112vh', x: c.sway, opacity: [0, 1, 1, 0.85], rotate: c.rotate + 540 }}
              transition={{
                delay: c.delay,
                duration: c.duration,
                ease: 'easeIn',
                repeat: Infinity,
                repeatDelay: 0.3,
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: `${c.left}%`,
                width: c.size,
                height: c.size * 0.46,
                background: c.color,
                borderRadius: 1,
                boxShadow: `0 0 6px ${c.color}88`,
              }}
            />
          ))}

          {/* Halo pulsant derrière le trophée. */}
          <motion.div
            aria-hidden
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.15, 1], opacity: [0, 0.55, 0.4] }}
            transition={{ delay: 0.1, duration: 1.4, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              width: 'min(70vw, 70vh)',
              height: 'min(70vw, 70vh)',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${accent}44 0%, transparent 65%)`,
              filter: 'blur(6px)',
            }}
          />

          {/* Trophée : surgit en sur-échelle puis rebond. */}
          <motion.div
            initial={{ scale: 0, rotate: -22, y: 30 }}
            animate={{ scale: [0, 1.3, 1], rotate: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 170, damping: 11, delay: 0.15 }}
            className="relative z-10 select-none"
            style={{
              fontSize: 'clamp(4rem, 17vw, 8.5rem)',
              lineHeight: 1,
              filter: `drop-shadow(0 0 34px ${accent}cc)`,
            }}
          >
            🏆
          </motion.div>

          {/* Libellé « champion du tournoi ». */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.4 }}
            className="relative z-10 mt-[2vh] font-extrabold uppercase"
            style={{
              fontSize: 'clamp(0.7rem, 2.4vw, 1rem)',
              letterSpacing: '0.3em',
              color: accent,
            }}
          >
            {t('tournois.victory.title')}
          </motion.div>

          {/* Portrait + nom du champion. */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 0.7 }}
            className="relative z-10 mt-[2.4vh] flex flex-col items-center gap-3"
          >
            <div
              className="rounded-full flex items-center justify-center font-display font-black text-[#0a0a0a] overflow-hidden"
              style={{
                width: 'clamp(86px, 24vw, 148px)',
                height: 'clamp(86px, 24vw, 148px)',
                fontSize: 'clamp(2rem, 9vw, 3.4rem)',
                border: `3px solid ${accent}`,
                boxShadow: `0 0 40px ${accent}aa, inset 0 1px 0 rgba(255,255,255,0.3)`,
                background: champion.imageUrl ? undefined : accent,
              }}
            >
              {champion.imageUrl ? (
                <img src={champion.imageUrl} alt={champion.login} className="w-full h-full object-cover" />
              ) : (
                champion.login[0]?.toUpperCase()
              )}
            </div>
            <span
              className="font-display font-black text-text-strong uppercase max-w-[80vw] truncate"
              style={{ fontSize: 'clamp(1.6rem, 7vw, 3.2rem)', lineHeight: 1.05 }}
            >
              {champion.login}
            </span>
          </motion.div>

          {/* Nom du tournoi. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="relative z-10 mt-[1.4vh] text-muted-2"
            style={{ fontSize: 'clamp(0.8rem, 2vw, 1.1rem)' }}
          >
            {tournamentName}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
