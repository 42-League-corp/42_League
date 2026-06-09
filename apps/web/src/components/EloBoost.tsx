import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Flame } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────
 * « EN FEU » — habillage du boost ELO ×2 (objet boutique `elo_boost`).
 *
 * Quand un joueur est boosté, son profil devient incandescent : la carte vire
 * au métal en fusion (rouge braise → orange → ambre), des braises montent, une
 * léchée de flammes ondule en bas, et un badge « ELO ×2 » affiche le compte à
 * rebours vivant. Les autres voient le même état (champ `eloBoostUntil` public).
 *
 * Tout est en transform/opacity (GPU), coupé sous prefers-reduced-motion, et
 * les composants ne rendent RIEN hors boost → coût nul sur un profil normal.
 * ──────────────────────────────────────────────────────────────────────── */

/** Couleurs de l'ambiance feu (réutilisées par l'aura, le badge et les bordures). */
export const BOOST_COLORS = {
  ember: '#ff7a18',
  hot: '#ff3b30',
  amber: '#ffb347',
  core: '#fff1c2',
} as const;

/** Décompte HH:MM:SS d'une fenêtre de boost. `active` tombe à false à l'échéance. */
export function useEloBoostRemaining(until: string | null | undefined): {
  active: boolean;
  ms: number;
  hms: string;
} {
  const target = useMemo(() => (until ? new Date(until).getTime() : 0), [until]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target || target <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  const ms = Math.max(0, target - now);
  const active = target > now;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const hms = `${h}:${pad(m)}:${pad(s)}`;
  return { active, ms, hms };
}

/** Une braise : position de départ, taille, durée et délai (figés au montage). */
interface Ember {
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
}

function makeEmbers(count: number): Ember[] {
  // Pseudo-aléatoire déterministe : pas de re-tirage à chaque rendu, et stable
  // d'un montage à l'autre (rendu identique côté observateur).
  return Array.from({ length: count }, (_, i) => {
    const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    return {
      left: 4 + r(1) * 92,
      size: 2 + r(2) * 4,
      duration: 2.6 + r(3) * 2.6,
      delay: r(4) * 3.2,
      drift: (r(5) - 0.5) * 36,
    };
  });
}

/**
 * Aura incandescente posée en overlay sur la carte de profil. À placer en enfant
 * direct d'un conteneur `relative overflow-hidden`. Ne rend rien si non boosté.
 */
export function EloBoostAura({
  active,
  count = 14,
  className = '',
}: {
  active: boolean;
  count?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const embers = useMemo(() => makeEmbers(count), [count]);
  if (!active) return null;

  return (
    <div aria-hidden className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {/* Voile de fusion : recolore la carte en métal en fusion. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            `radial-gradient(120% 80% at 50% 115%, ${BOOST_COLORS.hot}59 0%, ${BOOST_COLORS.ember}3a 28%, transparent 62%),` +
            `linear-gradient(180deg, ${BOOST_COLORS.ember}1f 0%, transparent 38%)`,
          mixBlendMode: 'screen',
        }}
      />

      {/* Halo de chaleur qui respire derrière le contenu. */}
      <motion.div
        className="absolute left-1/2 top-[42%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full gpu"
        style={{
          background: `radial-gradient(circle, ${BOOST_COLORS.ember}66 0%, ${BOOST_COLORS.hot}26 45%, transparent 70%)`,
          filter: 'blur(28px)',
        }}
        animate={reduced ? undefined : { scale: [1, 1.18, 1], opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 3.4, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* Léchée de flammes ondulante au bas de la carte. */}
      <div
        className={`absolute inset-x-0 bottom-0 h-24 ${reduced ? '' : 'elo-fire-flicker'}`}
        style={{
          background: `linear-gradient(0deg, ${BOOST_COLORS.hot}80 0%, ${BOOST_COLORS.ember}4d 35%, transparent 100%)`,
          maskImage: 'linear-gradient(0deg, #000 0%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(0deg, #000 0%, transparent 100%)',
        }}
      />

      {/* Braises qui montent (coupées sous reduced-motion). */}
      {!reduced &&
        embers.map((e, i) => (
          <span
            key={i}
            className="absolute bottom-2 rounded-full elo-ember gpu"
            style={{
              left: `${e.left}%`,
              width: e.size,
              height: e.size,
              background: BOOST_COLORS.core,
              boxShadow: `0 0 6px 1px ${BOOST_COLORS.ember}, 0 0 10px 2px ${BOOST_COLORS.hot}99`,
              ['--ember-drift' as string]: `${e.drift}px`,
              animationDuration: `${e.duration}s`,
              animationDelay: `${e.delay}s`,
            }}
          />
        ))}

      {/* Bordure incandescente qui pulse. */}
      <motion.div
        className="absolute inset-0 rounded-[inherit]"
        style={{ boxShadow: `inset 0 0 0 1px ${BOOST_COLORS.ember}, inset 0 0 22px -4px ${BOOST_COLORS.hot}` }}
        animate={reduced ? undefined : { opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
      />
    </div>
  );
}

/**
 * Badge « ELO ×2 » + compte à rebours vivant. Rend null si la fenêtre est close.
 * `label` = court intitulé devant le décompte (ex. « EN FEU »).
 */
export function EloBoostBadge({
  until,
  label = 'EN FEU',
  className = '',
}: {
  until: string | null | undefined;
  label?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const { active, hms } = useEloBoostRemaining(until);
  if (!active) return null;

  return (
    <motion.span
      initial={{ scale: 0.85, opacity: 0 }}
      animate={
        reduced
          ? { scale: 1, opacity: 1 }
          : { scale: 1, opacity: 1, boxShadow: [
              `0 0 10px -2px ${BOOST_COLORS.ember}`,
              `0 0 18px 1px ${BOOST_COLORS.hot}`,
              `0 0 10px -2px ${BOOST_COLORS.ember}`,
            ] }
      }
      transition={
        reduced
          ? { duration: 0.2 }
          : { boxShadow: { duration: 1.8, ease: 'easeInOut', repeat: Infinity }, default: { duration: 0.3 } }
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] tabular-nums ${className}`}
      style={{
        color: BOOST_COLORS.core,
        borderColor: `${BOOST_COLORS.ember}aa`,
        background: `linear-gradient(110deg, ${BOOST_COLORS.hot}40 0%, ${BOOST_COLORS.ember}59 50%, ${BOOST_COLORS.hot}40 100%)`,
      }}
    >
      <Flame className={`h-3.5 w-3.5 ${reduced ? '' : 'elo-flame-bob'}`} strokeWidth={2.6} style={{ color: BOOST_COLORS.amber }} />
      <span style={{ color: BOOST_COLORS.amber }}>ELO ×2</span>
      <span className="opacity-50">·</span>
      <span>{hms}</span>
      <span className="sr-only">{label}</span>
    </motion.span>
  );
}
