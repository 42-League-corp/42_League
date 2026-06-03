import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameMode } from '../hooks/useGameMode';
import type { Game } from '../lib/gameMode';

/** Applique `data-game` sur <html> pour le thème conditionnel. */
export function useGameModeTheme(): void {
  const { game } = useGameMode();
  useEffect(() => {
    document.documentElement.dataset.game = game;
  }, [game]);
}

// ─── Métadonnées visuelles par univers ────────────────────────────────────────

const GAMES: Game[] = ['babyfoot', 'smash', 'chess', 'streetfighter'];

const META: Record<Game, {
  label: string;
  shortLabel: string;
  color: string;      // CSS color string (Tailwind ne passe pas en CSS inline)
  borderColor: string;
  bgColor: string;
  glowColor: string;
  icon: React.ReactElement;
}> = {
  babyfoot: {
    label: 'Babyfoot',
    shortLabel: 'Baby',
    color: '#ffc94a',
    borderColor: 'rgba(255,201,74,0.6)',
    bgColor: 'rgba(255,201,74,0.10)',
    glowColor: 'rgba(255,201,74,0.45)',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <rect x="2" y="5" width="20" height="2" rx="1" fill="currentColor" opacity="0.55" />
        <rect x="10.8" y="5" width="2.4" height="10" rx="1" fill="currentColor" />
        <circle cx="12" cy="9.5" r="2.8" fill="currentColor" />
        <rect x="8.5" y="12" width="7" height="4.5" rx="1.2" fill="currentColor" />
        <circle cx="12" cy="20" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  smash: {
    label: 'Smash',
    shortLabel: 'Smash',
    color: '#ff3d50',
    borderColor: 'rgba(255,61,80,0.6)',
    bgColor: 'rgba(255,61,80,0.10)',
    glowColor: 'rgba(255,61,80,0.45)',
    icon: (
      <img src="/smash-logo.png" alt="" width={20} height={20} className="object-contain" aria-hidden />
    ),
  },
  chess: {
    label: 'Échecs',
    shortLabel: 'Échecs',
    color: '#56c46e',
    borderColor: 'rgba(86,196,110,0.6)',
    bgColor: 'rgba(86,196,110,0.10)',
    glowColor: 'rgba(86,196,110,0.45)',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path d="M12 2 v4 M10 4 h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 7 C8.5 7 8 11 10.5 13 L9 19 h6 l-1.5 -6 C16 11 15.5 7 12 7 Z" fill="currentColor" />
        <rect x="7.5" y="19" width="9" height="2.5" rx="1" fill="currentColor" />
        <rect x="6" y="21" width="12" height="2" rx="1" fill="currentColor" />
      </svg>
    ),
  },
  streetfighter: {
    label: 'Street Fighter',
    shortLabel: 'SF',
    color: '#ff7a18',
    borderColor: 'rgba(255,122,24,0.6)',
    bgColor: 'rgba(255,122,24,0.10)',
    glowColor: 'rgba(255,122,24,0.45)',
    icon: (
      <img src="/Street_Fighter_Logo.png" alt="" width={20} height={20} className="object-contain" aria-hidden />
    ),
  },
};

// ─── Composant principal ──────────────────────────────────────────────────────

/** Morph sans overshoot (évite tout rollback à la fermeture). */
const MORPH = { type: 'tween' as const, duration: 0.42, ease: [0.33, 1, 0.68, 1] };

/**
 * Sélecteur d'univers flottant (bas droite).
 * Un bouton rond montre l'univers actif ; au clic il se déploie — en restant
 * ancré dans le coin — en un panneau des 3 jeux. Tap sur un jeu = bascule.
 *
 * Le morph FAB ↔ panneau s'appuie sur `layoutId` (shared layout) ; le hover
 * est découplé du layout pour rester fluide malgré le morph en tween.
 */
export function GameModeSwitch() {
  const { game, setGame } = useGameMode();
  useGameModeTheme();
  const [open, setOpen] = useState(false);
  const m = META[game];

  const pick = (g: Game) => {
    setGame(g);
    window.setTimeout(() => setOpen(false), 180);
  };

  return (
    <>
      {/* Voile de fermeture (clic extérieur) */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="gm-backdrop"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[89] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
        )}
      </AnimatePresence>

      <div className="fixed right-3 bottom-20 sm:bottom-4 z-[90]">
        {open ? (
          // ── Panneau (morph depuis le FAB, reste ancré dans le coin) ──
          <motion.div
            layoutId="gm-switch"
            transition={{ layout: MORPH }}
            style={{ borderRadius: 22, background: '#14110b', border: `1.5px solid ${m.borderColor}` }}
            className="w-[248px] max-w-[calc(100vw-1.5rem)] overflow-hidden shadow-2xl backdrop-blur-md"
          >
            <motion.div
              className="p-3.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, delay: 0.05 }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">Univers</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  className="grid h-6 w-6 place-items-center rounded-lg text-muted-2 transition-colors hover:bg-white/10 hover:text-text-strong"
                >
                  ✕
                </button>
              </div>
              <motion.div
                className="grid grid-cols-4 gap-2"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } } }}
                initial="hidden"
                animate="show"
              >
                {GAMES.map((g) => {
                  const gm = META[g];
                  const sel = g === game;
                  return (
                    <motion.button
                      key={g}
                      type="button"
                      onClick={() => pick(g)}
                      variants={{ hidden: { opacity: 0, y: 12, scale: 0.9 }, show: { opacity: 1, y: 0, scale: 1 } }}
                      transition={{ type: 'spring', stiffness: 440, damping: 26 }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.94 }}
                      className="relative flex flex-col items-center gap-1.5 rounded-xl py-2.5"
                      style={{
                        background: sel ? gm.bgColor : 'rgba(255,255,255,0.03)',
                        border: `1.5px solid ${sel ? gm.borderColor : 'rgba(255,255,255,0.07)'}`,
                        boxShadow: sel ? `0 0 16px -5px ${gm.glowColor}` : 'none',
                      }}
                    >
                      <span style={{ color: sel ? gm.color : 'rgba(255,255,255,0.45)' }}>{gm.icon}</span>
                      <span
                        className="text-[10px] font-extrabold uppercase tracking-wider"
                        style={{ color: sel ? gm.color : 'rgba(255,255,255,0.5)' }}
                      >
                        {gm.shortLabel}
                      </span>
                      {sel && (
                        <motion.span
                          layoutId="gm-switch-dot"
                          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full"
                          style={{ background: gm.color }}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>
            </motion.div>
          </motion.div>
        ) : (
          // ── FAB rond (univers actif) ──
          <motion.button
            layoutId="gm-switch"
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Univers actuel : ${m.label}. Changer de jeu.`}
            transition={{ layout: MORPH, default: { type: 'spring', stiffness: 500, damping: 28 } }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            style={{
              borderRadius: 26,
              background: '#14110b',
              border: `1.5px solid ${m.borderColor}`,
              boxShadow: `0 0 20px -6px ${m.glowColor}`,
            }}
            className="grid h-[52px] w-[52px] place-items-center backdrop-blur-md"
          >
            <motion.span
              key={game}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 600, damping: 24 }}
              style={{ color: m.color }}
            >
              {m.icon}
            </motion.span>
          </motion.button>
        )}
      </div>
    </>
  );
}
