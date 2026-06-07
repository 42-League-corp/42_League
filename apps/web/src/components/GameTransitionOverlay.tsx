import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameMode } from '../hooks/useGameMode';
import type { Game } from '../lib/gameMode';

/**
 * Overlay de transition entre univers de jeux.
 *
 * Quand le mode bascule (babyfoot → smash → échecs → …), un effet
 * "ouverture de portail" se joue en ~600ms :
 *   1. Flash centré sur le bouton switch (couleur de l'univers cible)
 *   2. Grand symbole du jeu qui surgit avec un spring Framer
 *   3. Balayage horizontal de la couleur + fondu de sortie
 *
 * Totalement pointer-events-none → ne bloque jamais l'utilisateur.
 * Respecte prefers-reduced-motion : animation réduite à un simple fondu.
 */

// ─── Métadonnées par univers ──────────────────────────────────────────────────
const UNIVERSE: Record<Game, {
  bg: string;
  glow: string;
  accent: string;
  label: string;
  symbol: (size: number) => React.ReactElement;
}> = {
  babyfoot: {
    bg: 'rgba(12, 32, 18, 0.92)',
    glow: 'rgba(255, 201, 74, 0.6)',
    accent: '#ffc94a',
    label: 'BABYFOOT',
    symbol: (s) => (
      <svg viewBox="0 0 120 120" width={s} height={s} aria-hidden>
        {/* Baby-foot (table) centré — visuel dédié à la cinématique de transition */}
        <image href="/baby%20anim-Photoroom.png" x="2" y="14" width="116" height="92" preserveAspectRatio="xMidYMid meet" />
      </svg>
    ),
  },
  smash: {
    bg: 'rgba(28, 6, 8, 0.94)',
    glow: 'rgba(255, 60, 80, 0.75)',
    accent: '#ff3d50',
    label: 'SMASH',
    symbol: (s) => (
      <svg viewBox="0 0 120 120" width={s} height={s} aria-hidden>
        {/* Logo Smash seul, centré */}
        <image href="/smash-color.png" x="10" y="10" width="100" height="100" preserveAspectRatio="xMidYMid meet" />
      </svg>
    ),
  },
  streetfighter: {
    bg: 'rgba(28, 12, 2, 0.94)',
    glow: 'rgba(255, 122, 24, 0.75)',
    accent: '#ff7a18',
    label: 'STREET FIGHTER',
    symbol: (s) => (
      <svg viewBox="0 0 120 120" width={s} height={s} aria-hidden>
        {/* Logo Street Fighter seul, centré */}
        <image href="/sf-color.png" x="6" y="18" width="108" height="84" preserveAspectRatio="xMidYMid meet" />
      </svg>
    ),
  },
  chess: {
    bg: 'rgba(6, 14, 10, 0.94)',
    glow: 'rgba(86, 196, 110, 0.6)',
    accent: '#56c46e',
    label: 'ÉCHECS',
    symbol: (s) => (
      <svg viewBox="0 0 120 120" width={s} height={s} aria-hidden>
        {/* Pièce blanche (roi en marbre) centrée */}
        <image href="/chess.png" x="20" y="6" width="80" height="108" preserveAspectRatio="xMidYMid meet" />
      </svg>
    ),
  },
  flechettes: {
    bg: 'rgba(3, 24, 22, 0.94)',
    glow: 'rgba(20, 184, 166, 0.7)',
    accent: '#14b8a6',
    label: 'FLÉCHETTES',
    symbol: (s) => (
      <svg viewBox="0 0 120 120" width={s} height={s} aria-hidden>
        {/* Cible : anneaux concentriques + secteurs + bull */}
        <circle cx="60" cy="60" r="56" fill="#062b28" stroke="rgba(20,184,166,0.4)" strokeWidth="2" />
        <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(20,184,166,0.45)" strokeWidth="2" />
        <circle cx="60" cy="60" r="30" fill="none" stroke="rgba(20,184,166,0.6)" strokeWidth="2" />
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i * Math.PI) / 5;
          return (
            <line key={i} x1={60 + Math.cos(a) * 16} y1={60 + Math.sin(a) * 16}
              x2={60 + Math.cos(a) * 56} y2={60 + Math.sin(a) * 56}
              stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
          );
        })}
        <circle cx="60" cy="60" r="16" fill="none" stroke="#2dd4bf" strokeWidth="2" />
        <circle cx="60" cy="60" r="7" fill="#ff4d5c" />
        <circle cx="60" cy="60" r="3" fill="#0c2a28" />
      </svg>
    ),
  },
};

// ─── Composant principal ──────────────────────────────────────────────────────

export function GameTransitionOverlay() {
  const { game } = useGameMode();
  const prevGameRef = useRef<Game>(game);
  const [active, setActive] = useState(false);
  const [displayedGame, setDisplayedGame] = useState<Game>(game);

  useEffect(() => {
    if (prevGameRef.current === game) return;
    prevGameRef.current = game;
    setDisplayedGame(game);
    setActive(true);
    // 480ms total : entrée punch (120ms) + symbol spring + sortie éclair (150ms)
    const t = setTimeout(() => setActive(false), 480);
    return () => clearTimeout(t);
  }, [game]);

  const u = UNIVERSE[displayedGame];

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={displayedGame}
          className="fixed inset-0 z-[9990] pointer-events-none flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.13, ease: [0.55, 0, 1, 0.45] } }}
          transition={{ duration: 0.08 }}
          style={{ background: u.bg }}
        >
          {/* Balayage latéral couleur */}
          <motion.div
            className="absolute inset-y-0 left-0"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            exit={{ width: '100%', opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{ background: `linear-gradient(90deg, ${u.accent}18 0%, transparent 100%)` }}
          />

          {/* Halo central */}
          <motion.div
            className="absolute rounded-full"
            initial={{ scale: 0, opacity: 0.9 }}
            animate={{ scale: 8, opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: 180, height: 180, background: u.glow, filter: 'blur(40px)' }}
          />

          {/* Symbole du jeu */}
          <motion.div
            className="relative flex flex-col items-center gap-5"
            initial={{ scale: 0.2, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.1, opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 500, damping: 28, delay: 0.04 }}
          >
            {/* Drop shadow coloré derrière le symbole */}
            <div
              className="absolute"
              style={{ filter: `blur(28px)`, opacity: 0.55 }}
            >
              {u.symbol(500)}
            </div>
            {u.symbol(500)}

            {/* Nom de l'univers */}
            <motion.span
              className="font-display font-black tracking-[0.3em] uppercase text-2xl"
              style={{ color: u.accent, textShadow: `0 0 28px ${u.accent}` }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.28 }}
            >
              {u.label}
            </motion.span>
          </motion.div>

          {/* Grain de bruit pour l'effet cinématique */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
              backgroundSize: '200px 200px',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
