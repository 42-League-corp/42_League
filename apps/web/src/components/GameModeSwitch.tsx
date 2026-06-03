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

const GAMES: Game[] = ['babyfoot', 'smash', 'chess'];

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
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <defs>
          <radialGradient id="gsb" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="45%" stopColor="#ff8a3a" />
            <stop offset="100%" stopColor="#d11f2f" />
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#gsb)" stroke="#fff" strokeWidth="1" />
        <path d="M12 2 C9 8 9 16 12 22 M2 12 C8 9 16 9 22 12"
          fill="none" stroke="#7a0d15" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
      </svg>
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
};

// ─── Composant principal ──────────────────────────────────────────────────────

/**
 * Sélecteur d'univers flottant (bas droite).
 * Affiche les 3 jeux côte à côte ; un tap sur n'importe lequel bascule
 * directement vers cet univers — plus intuitif que le cycling aveugle.
 *
 * État fermé  : pill compacte avec le jeu actif + hint "→ suivant".
 * État ouvert : plateau de 3 cartes avec art par univers.
 */
export function GameModeSwitch() {
  const { game, setGame } = useGameMode();
  useGameModeTheme();
  const [open, setOpen] = useState(false);
  const m = META[game];

  return (
    <div className="fixed right-3 bottom-20 sm:bottom-4 z-[90] flex flex-col items-end gap-1.5">

      {/* ── Plateau de sélection (visible quand open) ────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 12 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className="flex flex-col gap-1.5 items-end"
          >
            {GAMES.map((g) => {
              const gm = META[g];
              const isActive = g === game;
              return (
                <motion.button
                  key={g}
                  type="button"
                  onClick={() => { setGame(g); setOpen(false); }}
                  whileTap={{ scale: 0.93 }}
                  className="flex items-center gap-2.5 pr-3 pl-2.5 py-2 rounded-full backdrop-blur-md transition-all"
                  style={{
                    background: isActive ? gm.bgColor : 'rgba(14,12,9,0.80)',
                    border: `1.5px solid ${isActive ? gm.borderColor : 'rgba(255,255,255,0.07)'}`,
                    boxShadow: isActive ? `0 0 18px -4px ${gm.glowColor}` : 'none',
                  }}
                >
                  <span style={{ color: isActive ? gm.color : 'rgba(255,255,255,0.45)' }}>
                    {gm.icon}
                  </span>
                  <span
                    className="text-[11px] font-extrabold uppercase tracking-[0.14em] whitespace-nowrap"
                    style={{ color: isActive ? gm.color : 'rgba(255,255,255,0.5)' }}
                  >
                    {gm.label}
                  </span>
                  {isActive && (
                    <span
                      className="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full ml-1"
                      style={{ background: gm.color, color: '#0a0806' }}
                    >
                      actuel
                    </span>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bouton principal (toujours visible) ──────────────────────── */}
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.93 }}
        aria-label={`Univers actuel : ${m.label}. Cliquer pour changer.`}
        className="relative flex items-center gap-2 pl-2.5 pr-3 h-12 rounded-full backdrop-blur-md transition-all"
        style={{
          background: m.bgColor,
          border: `1.5px solid ${m.borderColor}`,
          boxShadow: open
            ? `0 0 0 3px rgba(255,255,255,0.06), 0 0 24px -4px ${m.glowColor}`
            : `0 0 20px -6px ${m.glowColor}`,
        }}
        animate={{ borderColor: m.borderColor }}
        transition={{ duration: 0.3 }}
      >
        {/* Icône du jeu actif */}
        <motion.span
          key={game}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 600, damping: 24 }}
          style={{ color: m.color }}
        >
          {m.icon}
        </motion.span>

        {/* Nom du jeu */}
        <motion.span
          key={`label-${game}`}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="text-[11px] font-extrabold uppercase tracking-[0.14em]"
          style={{ color: m.color }}
        >
          {m.shortLabel}
        </motion.span>

        {/* Indicateur ouvert/fermé */}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[10px] ml-0.5"
          style={{ color: m.color, opacity: 0.6 }}
        >
          ▲
        </motion.span>
      </motion.button>
    </div>
  );
}
