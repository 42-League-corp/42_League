/**
 * JoustingScene — décor médiéval « joute » en SVG vectoriel pur (pas de bitmap).
 *
 * Posé en fond derrière la cérémonie de lancement d'un tournoi :
 *  - deux chevaliers en armure tenant une grande oriflamme verticale qui ondule,
 *  - une rangée de petits drapeaux triangulaires qui flottent en haut de l'écran.
 *
 * Tout est paramétré par une couleur d'accent (`accent`, propre au jeu).
 * Animations framer-motion en transform/opacity uniquement (perf).
 */
import { motion } from 'framer-motion';

// ─── Helpers couleur ────────────────────────────────────────────────────────────

// Assombrit une couleur hex (#rrggbb) d'un facteur (0..1) — pour les ombrages d'armure.
function shade(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = Math.round(parseInt(full.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(full.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(full.slice(4, 6), 16) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

// ─── KnightBanner ────────────────────────────────────────────────────────────────

interface KnightBannerProps {
  side: 'left' | 'right';
  accent: string;
}

/**
 * Un chevalier stylisé tenant une grande oriflamme verticale.
 * `side` oriente le chevalier (face vers le centre de l'écran).
 * La bannière ondule en continu (skew/scale animés).
 */
export function KnightBanner({ side, accent }: KnightBannerProps) {
  const dark = shade(accent, 0.55);
  const darker = shade(accent, 0.35);
  const steel = '#9aa6b4';
  const steelDark = '#5c6672';
  const steelLight = '#cdd6e0';
  // Miroir horizontal pour le côté droit (le chevalier regarde vers l'intérieur).
  const flip = side === 'right';

  return (
    <svg
      viewBox="0 0 160 380"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMax meet"
      style={{ transform: flip ? 'scaleX(-1)' : undefined, overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`steel-${side}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={steelDark} />
          <stop offset="45%" stopColor={steelLight} />
          <stop offset="100%" stopColor={steel} />
        </linearGradient>
        <linearGradient id={`banner-${side}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={accent} />
          <stop offset="55%" stopColor={dark} />
          <stop offset="100%" stopColor={darker} />
        </linearGradient>
        <radialGradient id={`emblem-${side}`} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0%" stopColor="#fff7e4" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff7e4" stopOpacity="0.25" />
        </radialGradient>
      </defs>

      {/* ── Hampe de l'oriflamme ── */}
      <rect x="118" y="10" width="6" height="360" rx="3" fill="#6b4a22" />
      <rect x="118" y="10" width="2.5" height="360" rx="1.25" fill="#8a6534" />
      {/* Pointe de la hampe */}
      <circle cx="121" cy="8" r="7" fill="#caa24a" stroke="#8a6534" strokeWidth="1.5" />

      {/* ── Grande oriflamme verticale (ondulation) ── */}
      <motion.g
        style={{ transformOrigin: '124px 14px' }}
        animate={{ skewX: [0, 2.5, -1.5, 0], scaleX: [1, 0.985, 1.01, 1] }}
        transition={{ duration: 4.5, ease: 'easeInOut', repeat: Infinity }}
      >
        {/* Tissu : long fanion à pointe en bas */}
        <path
          d="M122 16 L62 22 L60 250 Q92 268 122 256 Z"
          fill={`url(#banner-${side})`}
          stroke={darker}
          strokeWidth="1.5"
        />
        {/* Pli d'ombre interne */}
        <path
          d="M122 16 L90 19 L90 252 Q106 260 122 256 Z"
          fill="#000"
          opacity="0.14"
        />
        {/* Galon décoratif en haut */}
        <path d="M122 16 L62 22 L62 30 L122 24 Z" fill="#fff7e4" opacity="0.35" />
        {/* Emblème central (heaume stylisé) */}
        <g transform="translate(91 120)">
          <circle r="26" fill={`url(#emblem-${side})`} />
          <path
            d="M-12 -8 Q0 -20 12 -8 L12 6 Q0 16 -12 6 Z"
            fill="#fff7e4"
            opacity="0.85"
          />
          <rect x="-13" y="-3" width="26" height="3.5" rx="1.5" fill={darker} opacity="0.7" />
          <rect x="-13" y="2" width="26" height="3.5" rx="1.5" fill={darker} opacity="0.7" />
        </g>
      </motion.g>

      {/* ── Chevalier ── */}
      {/* Cape derrière (léger flottement) */}
      <motion.path
        d="M30 150 Q10 230 24 320 L60 320 Q54 230 58 150 Z"
        fill={dark}
        stroke={darker}
        strokeWidth="1.5"
        style={{ transformOrigin: '44px 150px' }}
        animate={{ skewX: [0, 1.5, -1, 0] }}
        transition={{ duration: 5, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* Jambes / surcot */}
      <path d="M40 250 L36 360 L52 360 L56 270 Z" fill={`url(#steel-${side})`} stroke={steelDark} strokeWidth="1" />
      <path d="M58 270 L62 360 L78 360 L72 250 Z" fill={`url(#steel-${side})`} stroke={steelDark} strokeWidth="1" />

      {/* Torse / plastron */}
      <path
        d="M34 160 Q56 144 80 160 L78 256 Q56 270 36 256 Z"
        fill={`url(#steel-${side})`}
        stroke={steelDark}
        strokeWidth="1.5"
      />
      {/* Tabard accent par-dessus le plastron */}
      <path d="M50 158 L64 158 L62 250 L52 250 Z" fill={accent} opacity="0.85" />
      <path d="M55 175 L59 175 L59 230 L55 230 Z" fill="#fff7e4" opacity="0.4" />
      {/* Épaulières */}
      <ellipse cx="36" cy="166" rx="13" ry="10" fill={steelLight} stroke={steelDark} strokeWidth="1" />
      <ellipse cx="78" cy="166" rx="13" ry="10" fill={steel} stroke={steelDark} strokeWidth="1" />

      {/* Bras tenant la hampe */}
      <path d="M80 174 Q104 178 118 196 L114 210 Q98 196 78 192 Z" fill={`url(#steel-${side})`} stroke={steelDark} strokeWidth="1" />
      {/* Gantelet */}
      <circle cx="116" cy="200" r="9" fill={steelLight} stroke={steelDark} strokeWidth="1.5" />

      {/* Heaume */}
      <g>
        <path
          d="M44 110 Q57 96 70 110 L70 142 Q57 154 44 142 Z"
          fill={`url(#steel-${side})`}
          stroke={steelDark}
          strokeWidth="1.5"
        />
        {/* Fente de visière */}
        <rect x="46" y="120" width="22" height="4" rx="2" fill="#11161c" />
        <rect x="50" y="128" width="3" height="14" rx="1.5" fill="#11161c" opacity="0.8" />
        <rect x="57" y="128" width="3" height="14" rx="1.5" fill="#11161c" opacity="0.8" />
        <rect x="64" y="128" width="3" height="14" rx="1.5" fill="#11161c" opacity="0.8" />
        {/* Reflet */}
        <path d="M48 112 Q54 104 60 110 L58 122 Q53 116 49 122 Z" fill="#fff" opacity="0.35" />
      </g>

      {/* Cimier / plumet accent (ondule) */}
      <motion.path
        d="M57 96 Q50 70 38 60 Q52 74 50 96 Z"
        fill={accent}
        stroke={darker}
        strokeWidth="1"
        style={{ transformOrigin: '57px 96px' }}
        animate={{ rotate: [0, -6, 4, 0] }}
        transition={{ duration: 3.8, ease: 'easeInOut', repeat: Infinity }}
      />
    </svg>
  );
}

// ─── WavingFlag ──────────────────────────────────────────────────────────────────

interface WavingFlagProps {
  accent: string;
  delay?: number;
}

/**
 * Petit fanion triangulaire sur sa hampe, le tissu flotte au vent.
 */
export function WavingFlag({ accent, delay = 0 }: WavingFlagProps) {
  const dark = shade(accent, 0.5);
  return (
    <svg viewBox="0 0 44 60" width="44" height="60" style={{ overflow: 'visible' }} aria-hidden>
      {/* Hampe */}
      <rect x="4" y="2" width="3" height="56" rx="1.5" fill="#6b4a22" />
      <circle cx="5.5" cy="3" r="3" fill="#caa24a" />
      {/* Tissu triangulaire (flottement) */}
      <motion.path
        d="M7 6 L42 14 L7 24 Z"
        fill={accent}
        stroke={dark}
        strokeWidth="1"
        style={{ transformOrigin: '7px 14px' }}
        animate={{
          skewY: [0, 4, -3, 0],
          scaleX: [1, 0.94, 1.02, 1],
        }}
        transition={{ duration: 2.6, ease: 'easeInOut', repeat: Infinity, delay }}
      />
      {/* Liseré clair */}
      <motion.path
        d="M7 6 L42 14 L7 24 Z"
        fill="none"
        stroke="#fff7e4"
        strokeOpacity="0.35"
        strokeWidth="1.5"
        style={{ transformOrigin: '7px 14px' }}
        animate={{ skewY: [0, 4, -3, 0], scaleX: [1, 0.94, 1.02, 1] }}
        transition={{ duration: 2.6, ease: 'easeInOut', repeat: Infinity, delay }}
      />
    </svg>
  );
}

// ─── JoustingFlanks ──────────────────────────────────────────────────────────────

interface JoustingFlanksProps {
  accent: string;
}

/**
 * Assemble le décor complet posé derrière la cérémonie :
 *  - une rangée de fanions flottants en haut de l'écran,
 *  - un chevalier + oriflamme fixés sur chaque bord (gauche / droite),
 *    occupant ~40% de la hauteur depuis le bas.
 * pointer-events désactivés : c'est purement décoratif.
 */
export function JoustingFlanks({ accent }: JoustingFlanksProps) {
  // Quelques fanions répartis en haut, déphasés pour un effet « guirlande ».
  const flags = [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
      {/* Guirlande de fanions en haut */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex items-start justify-center gap-2 sm:gap-6 px-4"
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {flags.map((delay, i) => (
          <WavingFlag key={i} accent={accent} delay={delay} />
        ))}
      </motion.div>

      {/* Chevalier gauche */}
      <motion.div
        className="absolute bottom-0 left-0 h-[40%] w-[28vw] max-w-[220px] min-w-[120px]"
        initial={{ x: '-110%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <KnightBanner side="left" accent={accent} />
      </motion.div>

      {/* Chevalier droit */}
      <motion.div
        className="absolute bottom-0 right-0 h-[40%] w-[28vw] max-w-[220px] min-w-[120px]"
        initial={{ x: '110%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <KnightBanner side="right" accent={accent} />
      </motion.div>
    </div>
  );
}
