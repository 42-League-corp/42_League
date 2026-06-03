import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

// ── Static data ──────────────────────────────────────────────────────────────

const CHESS_CORNERS = [
  { piece: '♔', left: '2%',  top: '13%', size: 48, rotate: -10, color: '#ffc94a' },
  { piece: '♛', left: '88%', top: '11%', size: 44, rotate:  13, color: '#00d9dc' },
  { piece: '♚', left: '2%',  top: '76%', size: 40, rotate:  -5, color: '#00d9dc' },
  { piece: '♟', left: '89%', top: '75%', size: 36, rotate:   8, color: '#ffc94a' },
] as const;

const BURST_LINES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  angle: (i * 360) / 14,
  width: i % 2 === 0 ? '50vmax' : '38vmax',
  thickness: i % 3 === 0 ? 2 : 1,
  color:
    i % 3 === 0
      ? 'rgba(255,201,74,0.22)'
      : i % 3 === 1
        ? 'rgba(0,217,220,0.18)'
        : 'rgba(255,255,255,0.08)',
}));

// Tiges babyfoot (vue de dessus) — 2 barres
const BABY_RODS = [
  { y: '28%', players: [0.08, 0.32, 0.58, 0.82] },
  { y: '72%', players: [0.15, 0.45, 0.75] },
] as const;

// Pills des sections du site (apparaissent sous LEAGUE)
const SECTION_PILLS = [
  { icon: '⚽', label: 'DÉFIS',    color: '#ffc94a', delay: 0     },
  { icon: '♟', label: 'RANK',     color: '#00d9dc', delay: 0.045 },
  { icon: '🏆', label: 'TOURNOIS', color: '#ffc94a', delay: 0.09  },
  { icon: '📊', label: 'STATS',   color: '#00d9dc', delay: 0.135 },
] as const;

// Tabs skeleton
const TABS = [
  { icon: '⚽', active: true  },
  { icon: '🏆', active: false },
  { icon: '📊', active: false },
  { icon: '👤', active: false },
  { icon: '···', active: false },
];

// Particules d'impact
const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * 360) / 8;
  const rad   = (angle * Math.PI) / 180;
  return {
    id: i,
    tx: Math.cos(rad) * 56,
    ty: Math.sin(rad) * 56,
    color: i % 2 === 0 ? '#ffc94a' : '#00d9dc',
  };
});

// ── Component ────────────────────────────────────────────────────────────────

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * Arena intro — pro.
 *
 * Pattern : preload image → build (800ms) → hold (600ms) → fade out (350ms).
 * Exit : opacity seulement, pas de scale — évite le flash de la page derrière.
 * App.tsx fait un cross-dissolve simultané pour un handoff parfaitement fluide.
 *
 * Timeline après preload :
 *   0ms    → background + skeleton header/tabbar
 *   80ms   → logo slam spring 720
 *   240ms  → flash + shockwave + sparks
 *   370ms  → LEAGUE wipe
 *   520ms  → pills sections slide-up
 *   ~800ms → composition complète, hold 600ms
 *   1400ms → onComplete() → exit fade 350ms
 */
export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [ready, setReady]           = useState(false);
  const [phase, setPhase]           = useState(0);
  const [showSparks, setShowSparks] = useState(false);

  // Préchargement de l'image avant de démarrer l'animation
  useEffect(() => {
    const img = new Image();
    const done = () => setReady(true);
    img.onload  = done;
    img.onerror = done; // continue même si l'image rate
    img.src = '/apple-touch-icon.png';
    // Failsafe : 600ms max d'attente
    const failsafe = setTimeout(done, 600);
    return () => clearTimeout(failsafe);
  }, []);

  // Animation démarre quand l'image est prête
  useEffect(() => {
    if (!ready) return;

    setPhase(1); // background + skeleton immédiatement

    const t2 = setTimeout(() => {
      setPhase(2); // logo slam
      const ts = setTimeout(() => setShowSparks(true), 160);
      return () => clearTimeout(ts);
    }, 80);

    const t3 = setTimeout(() => setPhase(3), 370); // LEAGUE
    const t4 = setTimeout(() => setPhase(4), 520); // pills sections
    const t5 = setTimeout(onComplete, 1400);        // auto-exit

    return () => [t2, t3, t4, t5].forEach(clearTimeout);
  }, [ready, onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{
        // Fond correspondant exactement au bg de l'app → pas de flash à l'exit
        background:
          'radial-gradient(ellipse 120% 65% at 50% -5%, #0a2020 0%, #0c0a08 50%, #0c0a08 100%)',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      // Pas de scale/blur — opacity pure pour que la transition soit invisible
      exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeInOut' } }}
      onClick={onComplete}
    >
      {/* Grid discret */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,217,220,0.025) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(0,217,220,0.025) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* ── Tiges babyfoot ── */}
      {phase >= 1 &&
        BABY_RODS.map((rod, ri) => (
          <motion.div
            key={ri}
            className="absolute left-0 right-0 pointer-events-none"
            style={{ top: rod.y, height: 1, zIndex: 1 }}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1], delay: ri * 0.04 }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,201,74,0.08)' }} />
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
                  border: '1.5px solid rgba(255,201,74,0.18)',
                  background: 'rgba(255,201,74,0.05)',
                }}
              />
            ))}
          </motion.div>
        ))}

      {/* ── Starburst ── */}
      {phase >= 1 &&
        BURST_LINES.map((line) => (
          <motion.div
            key={line.id}
            className="absolute pointer-events-none"
            style={{
              left: '50%',
              top: '46%',
              width: line.width,
              height: line.thickness + 'px',
              background: `linear-gradient(90deg, ${line.color}, transparent)`,
              transformOrigin: 'left center',
              rotate: line.angle,
              zIndex: 1,
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}

      {/* ── Pièces d'échecs (coins) ── */}
      {phase >= 1 &&
        CHESS_CORNERS.map((item, i) => (
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
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {item.piece}
          </motion.div>
        ))}

      {/* ── Header skeleton ── */}
      {phase >= 1 && (
        <motion.div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top: 0,
            height: 50,
            background: 'rgba(255,201,74,0.04)',
            borderBottom: '1px solid rgba(255,201,74,0.12)',
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 10,
          }}
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(255,201,74,0.15)' }} />
          <div>
            <div style={{ width: 70, height: 7, borderRadius: 3, background: 'rgba(255,255,255,0.12)' }} />
            <div style={{ width: 44, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', marginTop: 4 }} />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(0,217,220,0.20)', background: 'rgba(0,217,220,0.04)' }} />
            <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(0,217,220,0.20)', background: 'rgba(0,217,220,0.04)' }} />
          </div>
        </motion.div>
      )}

      {/* ── Tab bar skeleton ── */}
      {phase >= 1 && (
        <motion.div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            bottom: 0,
            height: 64,
            background: 'rgba(0,217,220,0.03)',
            borderTop: '1px solid rgba(0,217,220,0.10)',
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '0 8px',
          }}
          initial={{ opacity: 0, y: 64 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {TABS.map((tab, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                opacity: tab.active ? 0.75 : 0.25,
              }}
            >
              <span style={{ fontSize: 14 }}>{tab.icon}</span>
              <div
                style={{
                  width: tab.active ? 18 : 4,
                  height: 3,
                  borderRadius: 2,
                  background: tab.active ? '#ffc94a' : 'rgba(255,255,255,0.25)',
                }}
              />
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Spotlight derrière le logo ── */}
      {phase >= 1 && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: '50%',
            top: '46%',
            width: 280,
            height: 280,
            marginLeft: -140,
            marginTop: -140,
            background:
              'radial-gradient(ellipse at center, rgba(12,10,8,0.96) 30%, rgba(12,10,8,0.5) 58%, transparent 72%)',
            zIndex: 7,
            borderRadius: '50%',
          }}
        />
      )}

      {/* ── Flash d'impact ── */}
      {phase >= 2 && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: '#ffffff', zIndex: 8 }}
          initial={{ opacity: 0.30 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        />
      )}

      {/* ── Shockwave ring ── */}
      {phase >= 2 && (
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            left: '50%',
            top: '46%',
            width: 110,
            height: 110,
            marginLeft: -55,
            marginTop: -55,
            border: '2px solid rgba(255,201,74,0.75)',
            zIndex: 9,
          }}
          initial={{ scale: 1, opacity: 0.9 }}
          animate={{ scale: 5.5, opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
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
              top: '46%',
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
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        ))}

      {/* ── Logo + LEAGUE + pills (centre absolu) ── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        style={{ gap: 6, transform: 'translateY(-5%)' }}
      >
        {/* Logo — préchargé, slam sans surprise */}
        {phase >= 2 && (
          <motion.img
            src="/apple-touch-icon.png"
            alt="42 League"
            style={{
              width: 112,
              height: 112,
              borderRadius: 24,
              filter:
                'drop-shadow(0 0 22px rgba(0,217,220,0.60))' +
                ' drop-shadow(0 0 50px rgba(255,183,27,0.55))',
              zIndex: 11,
            }}
            initial={{ scale: 0.1, y: -200, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 680, damping: 32, mass: 0.75 }}
          />
        )}

        {/* LEAGUE — wipe gauche → droite */}
        {phase >= 3 && (
          <motion.div
            style={{ zIndex: 11, overflow: 'hidden' }}
            initial={{ clipPath: 'inset(0 100% 0 0)' }}
            animate={{ clipPath: 'inset(0 0% 0 0)' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
                  '0 0 18px rgba(0,217,220,0.95), 0 0 44px rgba(0,217,220,0.55)',
              }}
            >
              LEAGUE
            </span>
          </motion.div>
        )}

        {/* Pills sections du site */}
        {phase >= 4 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, zIndex: 11 }}>
            {SECTION_PILLS.map((pill) => (
              <motion.div
                key={pill.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 20,
                  border: `1px solid ${pill.color}40`,
                  background: `${pill.color}0d`,
                  backdropFilter: 'blur(4px)',
                }}
                initial={{ opacity: 0, y: 14, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28, delay: pill.delay, ease: [0.16, 1, 0.3, 1] }}
              >
                <span style={{ fontSize: 13 }}>{pill.icon}</span>
                <span
                  style={{
                    fontFamily: '"Rajdhani", "Orbitron", sans-serif',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    color: `${pill.color}cc`,
                  }}
                >
                  {pill.label}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
