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
        <defs>
          <radialGradient id="tb-felt" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#1a5236" />
            <stop offset="100%" stopColor="#0c2a1c" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#tb-felt)" stroke="rgba(255,201,74,0.4)" strokeWidth="2" />
        {/* Lignes de terrain */}
        <line x1="60" y1="10" x2="60" y2="110" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="16" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        {/* Barres */}
        {[32, 50, 70, 88].map((x) => (
          <g key={x}>
            <line x1={x} y1="14" x2={x} y2="106" stroke="#c0a060" strokeOpacity="0.55" strokeWidth="2.5" />
            <circle cx={x} cy="60" r="4.5" fill="#1a1208" stroke="#c0a060" strokeOpacity="0.6" strokeWidth="1.5" />
          </g>
        ))}
        {/* Ballon */}
        <circle cx="60" cy="60" r="8" fill="white" opacity="0.9" />
        <circle cx="57" cy="57" r="2.5" fill="#222" opacity="0.6" />
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
        {/* Éclats d'impact */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const r = deg * Math.PI / 180;
          const x1 = 60 + Math.cos(r) * 52;
          const y1 = 60 + Math.sin(r) * 52;
          const x2 = 60 + Math.cos(r) * 34;
          const y2 = 60 + Math.sin(r) * 34;
          return <line key={deg} x1={x2} y1={y2} x2={x1} y2={y1} stroke="#ff3d50" strokeWidth="2" strokeOpacity="0.45" strokeLinecap="round" />;
        })}
        {/* Logo Smash */}
        <image href="/smash-logo.png" x="22" y="22" width="76" height="76" preserveAspectRatio="xMidYMid meet" />
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
        {/* Éclats d'impact (comme Smash) */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const r = deg * Math.PI / 180;
          const x1 = 60 + Math.cos(r) * 52;
          const y1 = 60 + Math.sin(r) * 52;
          const x2 = 60 + Math.cos(r) * 34;
          const y2 = 60 + Math.sin(r) * 34;
          return <line key={deg} x1={x2} y1={y2} x2={x1} y2={y1} stroke="#ff7a18" strokeWidth="2" strokeOpacity="0.45" strokeLinecap="round" />;
        })}
        {/* Logo Street Fighter */}
        <image href="/Street_Fighter_Logo.png" x="18" y="30" width="84" height="60" preserveAspectRatio="xMidYMid meet" />
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
        {/* Échiquier */}
        {Array.from({ length: 5 }, (_, r) =>
          Array.from({ length: 5 }, (_, c) => {
            if ((r + c) % 2 === 0) return null;
            return (
              <rect key={`${r}-${c}`} x={12 + c * 19.2} y={8 + r * 19.2}
                width="19.2" height="19.2" fill="#0f3d2a" opacity="0.7" />
            );
          })
        )}
        <rect x="12" y="8" width="96" height="96" fill="none" stroke="rgba(86,196,110,0.3)" strokeWidth="1.5" rx="2" />
        {/* Roi d'échecs centré */}
        <g transform="translate(60, 62)" fill="#dfeee2">
          <path d="M0 -18 v7 M-4 -15 h8" stroke="#dfeee2" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M0 -9 C-10 -9 -12 0 -7 6 L-10 20 h20 l-3 -14 C15 0 10 -9 0 -9 Z" />
          <rect x="-13" y="20" width="26" height="7" rx="2.5" />
          <rect x="-17" y="27" width="34" height="6" rx="2.5" />
        </g>
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
              {u.symbol(140)}
            </div>
            {u.symbol(140)}

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
