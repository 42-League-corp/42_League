import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

// ── Static data ──────────────────────────────────────────────────────────────

// Pièces d'échecs aux coins — refs visuelles chess
const CHESS_CORNERS = [
  { piece: '♔', left: '2%',  top: '14%', size: 46, rotate: -10, color: '#ffc94a' },
  { piece: '♛', left: '89%', top: '12%', size: 42, rotate:  13, color: '#00d9dc' },
  { piece: '♚', left: '2%',  top: '78%', size: 38, rotate:  -5, color: '#00d9dc' },
  { piece: '♟', left: '90%', top: '76%', size: 34, rotate:   8, color: '#ffc94a' },
] as const;

// Rayons starburst
const BURST_LINES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  angle: (i * 360) / 14,
  width: i % 2 === 0 ? '50vmax' : '38vmax',
  thickness: i % 3 === 0 ? 2 : 1,
  color:
    i % 3 === 0
      ? 'rgba(255,201,74,0.25)'
      : i % 3 === 1
        ? 'rgba(0,217,220,0.20)'
        : 'rgba(255,255,255,0.09)',
}));

// Barres babyfoot (vue de dessus : tiges horizontales + joueurs)
const BABY_RODS = [
  { y: '22%', players: [0.10, 0.37, 0.63, 0.90] }, // 4 joueurs
  { y: '44%', players: [0.18, 0.50, 0.82] },         // 3 joueurs
  { y: '66%', players: [0.10, 0.37, 0.63, 0.90] },
  { y: '88%', players: [0.18, 0.50, 0.82] },
] as const;

// Sections du site — 4 blocs (2 à gauche, 2 à droite du logo)
const LEFT_SECTIONS = [
  {
    icon: '⚽',
    label: 'DÉFIS',
    sub: 'Déclare · Défie',
    accent: '#ffc94a',
    fromX: -28,
    delay: 0,
  },
  {
    icon: '♟',
    label: 'CLASSEMENT',
    sub: 'ELO · Saison',
    accent: '#00d9dc',
    fromX: -28,
    delay: 0.04,
  },
] as const;

const RIGHT_SECTIONS = [
  {
    icon: '🏆',
    label: 'TOURNOIS',
    sub: 'Brackets · Live',
    accent: '#ffc94a',
    fromX: 28,
    delay: 0.02,
  },
  {
    icon: '📊',
    label: 'HISTORIQUE',
    sub: 'Stats · Courbe',
    accent: '#00d9dc',
    fromX: 28,
    delay: 0.06,
  },
] as const;

// Tabs bar
const TABS = [
  { icon: '⚽', active: true },
  { icon: '🏆', active: false },
  { icon: '📊', active: false },
  { icon: '👤', active: false },
  { icon: '···', active: false },
];

// Particules d'impact
const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * 360) / 8;
  const rad   = (angle * Math.PI) / 180;
  return { id: i, tx: Math.cos(rad) * 50, ty: Math.sin(rad) * 50, color: i % 2 === 0 ? '#ffc94a' : '#00d9dc' };
});

// ── Mini section card ────────────────────────────────────────────────────────

function SectionCard({
  icon, label, sub, accent, fromX, delay,
}: { icon: string; label: string; sub: string; accent: string; fromX: number; delay: number }) {
  return (
    <motion.div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '8px 6px',
        borderRadius: 10,
        border: `1px solid ${accent}30`,
        borderTop: `2px solid ${accent}60`,
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(4px)',
        width: '100%',
        boxSizing: 'border-box',
      }}
      initial={{ opacity: 0, x: fromX, scale: 0.85 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.22, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: `${accent}bb`,
          fontFamily: '"Rajdhani", "Orbitron", sans-serif',
          textAlign: 'center',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 7,
          color: 'rgba(255,255,255,0.28)',
          letterSpacing: '0.04em',
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        {sub}
      </div>
    </motion.div>
  );
}

// ── SplashScreen ─────────────────────────────────────────────────────────────

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * Arena intro v3 — 900ms total.
 *
 * Timeline :
 *   0ms   → bg (starburst + chess + baby rods) + squelette app (header, cards, tabbar)
 *   60ms  → logo slam spring 720
 *   200ms → flash + shockwave + sparks
 *   300ms → LEAGUE wipe
 *   700ms → exit scale-out (200ms)
 *   900ms → done
 */
export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase]           = useState(1);
  const [showSparks, setShowSparks] = useState(false);

  useEffect(() => {
    const t2 = setTimeout(() => {
      setPhase(2);
      const ts = setTimeout(() => setShowSparks(true), 140);
      return () => clearTimeout(ts);
    }, 60);
    const t3 = setTimeout(() => setPhase(3), 300);
    const t4 = setTimeout(onComplete, 700);

    return () => [t2, t3, t4].forEach(clearTimeout);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 130% 75% at 50% -5%, #081f1f 0%, #080c14 45%, #02040a 100%)',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      exit={{
        opacity: 0,
        scale: 1.07,
        transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
      }}
      onClick={onComplete}
    >
      {/* Grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,217,220,0.025) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(0,217,220,0.025) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* ── Tiges babyfoot (vue de dessus) ── */}
      {BABY_RODS.map((rod, ri) => (
        <motion.div
          key={ri}
          className="absolute left-0 right-0 pointer-events-none"
          style={{ top: rod.y, height: 1, zIndex: 1 }}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1], delay: ri * 0.02 }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,201,74,0.07)' }} />
          {rod.players.map((pos, pi) => (
            <div
              key={pi}
              style={{
                position: 'absolute',
                left: `${pos * 100}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 10,
                height: 10,
                borderRadius: '50%',
                border: '1.5px solid rgba(255,201,74,0.16)',
                background: 'rgba(255,201,74,0.05)',
              }}
            />
          ))}
        </motion.div>
      ))}

      {/* ── Starburst ── */}
      {BURST_LINES.map((line) => (
        <motion.div
          key={line.id}
          className="absolute pointer-events-none"
          style={{
            left: '50%',
            top: '47%',
            width: line.width,
            height: line.thickness + 'px',
            background: `linear-gradient(90deg, ${line.color}, transparent)`,
            transformOrigin: 'left center',
            rotate: line.angle,
            zIndex: 1,
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}

      {/* ── Pièces d'échecs (coins) ── */}
      {CHESS_CORNERS.map((item, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: item.left,
            top: item.top,
            fontSize: item.size,
            fontFamily: 'Georgia, serif',
            color: item.color,
            filter: `drop-shadow(0 0 10px ${item.color}70)`,
            rotate: item.rotate,
            zIndex: 2,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.22 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {item.piece}
        </motion.div>
      ))}

      {/* ── Header skeleton ── */}
      <motion.div
        className="absolute left-0 right-0 pointer-events-none flex items-center"
        style={{
          top: 0,
          height: 50,
          padding: '0 16px',
          background: 'rgba(255,201,74,0.035)',
          borderBottom: '1px solid rgba(255,201,74,0.10)',
          zIndex: 3,
          gap: 10,
        }}
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.20, ease: [0.16, 1, 0.3, 1] }}
      >
        <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(255,201,74,0.14)' }} />
        <div>
          <div style={{ width: 72, height: 7, borderRadius: 3, background: 'rgba(255,255,255,0.10)' }} />
          <div style={{ width: 44, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', marginTop: 4 }} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(0,217,220,0.18)', background: 'rgba(0,217,220,0.04)' }} />
          <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(0,217,220,0.18)', background: 'rgba(0,217,220,0.04)' }} />
        </div>
      </motion.div>

      {/* ── Section cards (2 gauche + 2 droite, logo au centre) ── */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 58,
          bottom: 70,
          left: 0,
          right: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 128px 1fr',
          alignItems: 'center',
          padding: '0 10px',
          gap: 8,
          zIndex: 3,
        }}
      >
        {/* Colonne gauche */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {LEFT_SECTIONS.map((s) => (
            <SectionCard key={s.label} {...s} />
          ))}
        </div>

        {/* Centre vide — logo absolu par-dessus */}
        <div />

        {/* Colonne droite */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RIGHT_SECTIONS.map((s) => (
            <SectionCard key={s.label} {...s} />
          ))}
        </div>
      </div>

      {/* ── Tab bar skeleton ── */}
      <motion.div
        className="absolute left-0 right-0 pointer-events-none flex items-center justify-around"
        style={{
          bottom: 0,
          height: 66,
          padding: '0 8px',
          background: 'rgba(0,217,220,0.03)',
          borderTop: '1px solid rgba(0,217,220,0.10)',
          zIndex: 3,
        }}
        initial={{ opacity: 0, y: 66 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.20, ease: [0.16, 1, 0.3, 1] }}
      >
        {TABS.map((tab, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              opacity: tab.active ? 0.75 : 0.28,
            }}
          >
            <span style={{ fontSize: 15 }}>{tab.icon}</span>
            <div
              style={{
                width: tab.active ? 18 : 4,
                height: 3,
                borderRadius: 2,
                background: tab.active ? '#ffc94a' : 'rgba(255,255,255,0.3)',
                transition: 'width 0.2s',
              }}
            />
          </div>
        ))}
      </motion.div>

      {/* ── Spotlight derrière le logo (assombrit les cards au centre) ── */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: '50%',
          top: '47%',
          width: 260,
          height: 260,
          marginLeft: -130,
          marginTop: -130,
          background:
            'radial-gradient(ellipse at center, rgba(2,4,10,0.94) 28%, rgba(2,4,10,0.5) 55%, transparent 72%)',
          zIndex: 7,
          borderRadius: '50%',
        }}
      />

      {/* ── Flash d'impact ── */}
      {phase >= 2 && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: '#ffffff', zIndex: 8 }}
          initial={{ opacity: 0.28 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        />
      )}

      {/* ── Shockwave ring ── */}
      {phase >= 2 && (
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            left: '50%',
            top: '47%',
            width: 110,
            height: 110,
            marginLeft: -55,
            marginTop: -55,
            border: '2px solid rgba(255,201,74,0.7)',
            zIndex: 9,
          }}
          initial={{ scale: 1, opacity: 0.9 }}
          animate={{ scale: 5.5, opacity: 0 }}
          transition={{ duration: 0.40, ease: 'easeOut' }}
        />
      )}

      {/* ── Particules d'impact ── */}
      {showSparks &&
        SPARKS.map((spark) => (
          <motion.div
            key={spark.id}
            className="absolute pointer-events-none rounded-full"
            style={{
              left: '50%',
              top: '47%',
              width: 5,
              height: 5,
              background: spark.color,
              boxShadow: `0 0 6px ${spark.color}`,
              marginLeft: -2.5,
              marginTop: -2.5,
              zIndex: 10,
            }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: spark.tx, y: spark.ty, scale: 0, opacity: 0 }}
            transition={{ duration: 0.30, ease: 'easeOut' }}
          />
        ))}

      {/* ── Logo + LEAGUE (centre absolu, z le plus haut) ── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        style={{ gap: 8, transform: 'translateY(-5%)' }}
      >
        {phase >= 2 && (
          <motion.img
            src="/apple-touch-icon.png"
            alt="42 League"
            style={{
              width: 108,
              height: 108,
              borderRadius: 24,
              filter:
                'drop-shadow(0 0 22px rgba(0,217,220,0.65))' +
                ' drop-shadow(0 0 52px rgba(255,183,27,0.55))',
              zIndex: 11,
            }}
            initial={{ scale: 0.1, y: -180, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 720, damping: 30, mass: 0.7 }}
          />
        )}

        {phase >= 3 && (
          <motion.div
            style={{ zIndex: 11 }}
            initial={{ clipPath: 'inset(0 100% 0 0)' }}
            animate={{ clipPath: 'inset(0 0% 0 0)' }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <span
              style={{
                fontFamily: '"Orbitron", "Rajdhani", sans-serif',
                fontSize: '2.2rem',
                fontWeight: 900,
                letterSpacing: '0.14em',
                color: '#00d9dc',
                display: 'block',
                whiteSpace: 'nowrap',
                textShadow:
                  '0 0 18px rgba(0,217,220,0.95), 0 0 45px rgba(0,217,220,0.55)',
              }}
            >
              LEAGUE
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
