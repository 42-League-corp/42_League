import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

// ── Static data ──────────────────────────────────────────────────────────────

// 6 pièces positionnées aux angles — apparaissent simultanément
const CHESS_PIECES = [
  { piece: '♔', left: '5%',  top: '9%',  size: 50, rotate: -12, opacity: 0.18, color: '#ffc94a' },
  { piece: '♟', left: '87%', top: '8%',  size: 38, rotate:  18, opacity: 0.22, color: '#00d9dc' },
  { piece: '♛', left: '3%',  top: '72%', size: 46, rotate:   7, opacity: 0.16, color: '#ffc94a' },
  { piece: '♘', left: '89%', top: '67%', size: 42, rotate: -14, opacity: 0.20, color: '#00d9dc' },
  { piece: '♙', left: '47%', top: '4%',  size: 28, rotate:   4, opacity: 0.14, color: '#ffc94a' },
  { piece: '♚', left: '46%', top: '89%', size: 38, rotate:  -6, opacity: 0.16, color: '#00d9dc' },
] as const;

// 16 rayons starburst — tous simultanés, plus de stagger
const BURST_LINES = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  angle: (i * 360) / 16,
  width: i % 2 === 0 ? '52vmax' : '40vmax',
  thickness: i % 3 === 0 ? 2 : 1,
  color:
    i % 3 === 0
      ? 'rgba(255,201,74,0.32)'
      : i % 3 === 1
        ? 'rgba(0,217,220,0.26)'
        : 'rgba(255,255,255,0.13)',
}));

// 8 particules d'impact
const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * 360) / 8;
  const rad   = (angle * Math.PI) / 180;
  return {
    id: i,
    tx: Math.cos(rad) * 52,
    ty: Math.sin(rad) * 52,
    color: i % 2 === 0 ? '#ffc94a' : '#00d9dc',
  };
});

// ── Component ────────────────────────────────────────────────────────────────

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * Arena intro — 900ms total, skippable au tap.
 *
 * Timeline :
 *   0ms   → bg starburst + pièces (150ms)
 *   60ms  → logo slam spring (stiffness 720, settle ~200ms)
 *   200ms → flash + sparks
 *   280ms → LEAGUE wipe gauche→droite (180ms)
 *   700ms → exit déclenché (scale out 200ms)
 *   900ms → done
 */
export function SplashScreen({ onComplete }: SplashScreenProps) {
  // Phase 1 active dès le départ : fond visible immédiatement
  const [phase, setPhase]           = useState(1);
  const [showSparks, setShowSparks] = useState(false);

  useEffect(() => {
    const t2 = setTimeout(() => {
      setPhase(2);
      const ts = setTimeout(() => setShowSparks(true), 140);
      return () => clearTimeout(ts);
    }, 60);
    const t3 = setTimeout(() => setPhase(3), 280);
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
      {/* Grid discret */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,217,220,0.03) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(0,217,220,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* ── Starburst — tous simultanés ── */}
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
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}

      {/* ── Chess pieces — tous simultanés ── */}
      {CHESS_PIECES.map((item, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: item.left,
            top: item.top,
            fontSize: item.size,
            fontFamily: 'Georgia, "Times New Roman", serif',
            color: item.color,
            filter: `drop-shadow(0 0 10px ${item.color}90)`,
            rotate: item.rotate,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: item.opacity }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {item.piece}
        </motion.div>
      ))}

      {/* ── Flash d'impact ── */}
      {phase >= 2 && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: '#fff', zIndex: 5 }}
          initial={{ opacity: 0.28 }}
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
            top: '47%',
            width: 120,
            height: 120,
            marginLeft: -60,
            marginTop: -60,
            border: '2px solid rgba(255,201,74,0.65)',
            zIndex: 6,
          }}
          initial={{ scale: 1, opacity: 0.9 }}
          animate={{ scale: 5, opacity: 0 }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
        />
      )}

      {/* ── Sparks d'impact ── */}
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
              zIndex: 7,
            }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: spark.tx, y: spark.ty, scale: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
          />
        ))}

      {/* ── Logo + LEAGUE ── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ gap: 10, transform: 'translateY(-5%)' }}
      >
        {/* Logo — slam ultra-rapide */}
        {phase >= 2 && (
          <motion.img
            src="/icon.svg"
            alt="42 LEAGUE"
            style={{
              width: 120,
              height: 120,
              borderRadius: 26,
              filter:
                'drop-shadow(0 0 24px rgba(0,217,220,0.7))' +
                ' drop-shadow(0 0 56px rgba(255,183,27,0.5))',
              zIndex: 8,
            }}
            initial={{ scale: 0.1, y: -180, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{
              type: 'spring',
              stiffness: 720,
              damping: 30,
              mass: 0.7,
            }}
          />
        )}

        {/* LEAGUE — wipe gauche→droite en une seule unité */}
        {phase >= 3 && (
          <motion.div
            style={{ zIndex: 8 }}
            initial={{ clipPath: 'inset(0 100% 0 0)' }}
            animate={{ clipPath: 'inset(0 0% 0 0)' }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <span
              style={{
                fontFamily: '"Orbitron", "Rajdhani", "Russo One", sans-serif',
                fontSize: '2.5rem',
                fontWeight: 900,
                letterSpacing: '0.14em',
                color: '#00d9dc',
                display: 'block',
                whiteSpace: 'nowrap',
                textShadow:
                  '0 0 20px rgba(0,217,220,0.95), 0 0 48px rgba(0,217,220,0.55)',
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
