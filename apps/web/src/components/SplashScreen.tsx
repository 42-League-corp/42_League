import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

// ── Static data (computed once at module load) ──────────────────────────────

const CHESS_PIECES = [
  { piece: '♔', left: '6%',  top: '10%', size: 52, delay: 0.05, rotate: -12, opacity: 0.18 },
  { piece: '♟', left: '86%', top: '7%',  size: 40, delay: 0.15, rotate:  18, opacity: 0.22 },
  { piece: '♛', left: '3%',  top: '70%', size: 48, delay: 0.10, rotate:   8, opacity: 0.16 },
  { piece: '♘', left: '89%', top: '65%', size: 44, delay: 0.20, rotate: -14, opacity: 0.20 },
  { piece: '♝', left: '14%', top: '44%', size: 32, delay: 0.25, rotate:  22, opacity: 0.13 },
  { piece: '♞', left: '81%', top: '40%', size: 36, delay: 0.08, rotate: -18, opacity: 0.17 },
  { piece: '♙', left: '48%', top: '4%',  size: 30, delay: 0.30, rotate:   4, opacity: 0.14 },
  { piece: '♚', left: '46%', top: '89%', size: 40, delay: 0.18, rotate:  -6, opacity: 0.16 },
  { piece: '♜', left: '24%', top: '85%', size: 28, delay: 0.35, rotate:  10, opacity: 0.12 },
  { piece: '♗', left: '70%', top: '84%', size: 30, delay: 0.28, rotate:  -8, opacity: 0.13 },
] as const;

// 24 starburst rays — alternating gold / teal / white, varying length
const BURST_LINES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  angle: (i * 360) / 24,
  width: i % 2 === 0 ? '54vmax' : '42vmax',
  thickness: i % 4 === 0 ? 2 : 1,
  color:
    i % 3 === 0
      ? 'rgba(255,201,74,0.38)'
      : i % 3 === 1
        ? 'rgba(0,217,220,0.30)'
        : 'rgba(255,255,255,0.18)',
}));

// Impact sparks (positions pre-computed)
const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i * 360) / 12;
  const dist  = 55 + (i % 3) * 28;
  const rad   = (angle * Math.PI) / 180;
  return {
    id: i,
    tx: Math.cos(rad) * dist,
    ty: Math.sin(rad) * dist,
    color: i % 2 === 0 ? '#ffc94a' : '#00d9dc',
  };
});

const LEAGUE_LETTERS = 'LEAGUE'.split('');

// ── Component ────────────────────────────────────────────────────────────────

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase]         = useState(0);
  const [showSparks, setShowSparks] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 80);           // bg burst + chess
    const t2 = setTimeout(() => {
      setPhase(2);                                           // logo slam
      const ts = setTimeout(() => setShowSparks(true), 200);
      return () => clearTimeout(ts);
    }, 380);
    const t3 = setTimeout(() => setPhase(3), 880);          // LEAGUE letters
    const t4 = setTimeout(() => setPhase(4), 1320);         // tagline
    const t5 = setTimeout(onComplete, 2350);                // auto-exit
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
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
        scale: 1.08,
        filter: 'blur(12px)',
        transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] },
      }}
      onClick={onComplete}
    >
      {/* Subtle teal grid — matches global app grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,217,220,0.03) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(0,217,220,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* ── Starburst rays (Smash Bros reveal) ── */}
      {phase >= 1 &&
        BURST_LINES.map((line) => (
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
            transition={{
              duration: 0.65,
              ease: [0.16, 1, 0.3, 1],
              delay: line.id * 0.007,
            }}
          />
        ))}

      {/* ── Floating chess pieces ── */}
      {phase >= 1 &&
        CHESS_PIECES.map((item, i) => (
          <motion.div
            key={i}
            className="absolute pointer-events-none"
            style={{
              left: item.left,
              top: item.top,
              fontSize: item.size,
              fontFamily: 'Georgia, "Times New Roman", serif',
              color: i % 2 === 0 ? '#ffc94a' : '#00d9dc',
              filter: `drop-shadow(0 0 10px ${
                i % 2 === 0 ? 'rgba(255,201,74,0.5)' : 'rgba(0,217,220,0.5)'
              })`,
              rotate: item.rotate,
            }}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: item.opacity, y: 0 }}
            transition={{ duration: 0.7, delay: item.delay, ease: [0.16, 1, 0.3, 1] }}
          >
            {item.piece}
          </motion.div>
        ))}

      {/* ── Rolling babyfoot ball ── */}
      {phase >= 1 && (
        <motion.div
          className="absolute pointer-events-none"
          style={{ top: '73%', fontSize: 20 }}
          initial={{ left: '-5%', opacity: 0 }}
          animate={{
            left: '106%',
            opacity: [0, 0.85, 0.85, 0.85, 0],
          }}
          transition={{
            left:    { duration: 1.9, ease: 'linear', delay: 0.35 },
            opacity: { duration: 1.9, times: [0, 0.05, 0.3, 0.9, 1], delay: 0.35 },
          }}
        >
          ⚽
        </motion.div>
      )}

      {/* ── Screen flash on impact ── */}
      {phase >= 2 && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: '#ffffff', zIndex: 5 }}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        />
      )}

      {/* ── Shockwave rings ── */}
      {phase >= 2 && (
        <>
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              left: '50%', top: '47%',
              width: 120, height: 120,
              marginLeft: -60, marginTop: -60,
              border: '2px solid rgba(255,201,74,0.55)',
              zIndex: 6,
            }}
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 4, opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
          />
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              left: '50%', top: '47%',
              width: 120, height: 120,
              marginLeft: -60, marginTop: -60,
              border: '1px solid rgba(0,217,220,0.4)',
              zIndex: 6,
            }}
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 6, opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.12 }}
          />
        </>
      )}

      {/* ── Impact sparks ── */}
      {showSparks &&
        SPARKS.map((spark) => (
          <motion.div
            key={spark.id}
            className="absolute pointer-events-none rounded-full"
            style={{
              left: '50%', top: '47%',
              width: 6, height: 6,
              background: spark.color,
              boxShadow: `0 0 8px ${spark.color}`,
              marginLeft: -3, marginTop: -3,
              zIndex: 7,
            }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: spark.tx, y: spark.ty, scale: 0, opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        ))}

      {/* ── Logo + LEAGUE + tagline ── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ gap: 10, transform: 'translateY(-5%)' }}
      >
        {/* Icon — slams in with spring physics */}
        {phase >= 2 && (
          <motion.img
            src="/icon.svg"
            alt="42 LEAGUE"
            style={{
              width: 120,
              height: 120,
              borderRadius: 26,
              filter:
                'drop-shadow(0 0 28px rgba(0,217,220,0.65))' +
                'drop-shadow(0 0 64px rgba(255,183,27,0.4))',
              zIndex: 8,
            }}
            initial={{ scale: 0.1, y: -220, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{
              type: 'spring',
              stiffness: 560,
              damping: 28,
              mass: 0.85,
            }}
          />
        )}

        {/* LEAGUE — letters flip in one by one */}
        {phase >= 3 && (
          <div style={{ display: 'flex', alignItems: 'center', perspective: '600px' }}>
            {LEAGUE_LETTERS.map((letter, i) => (
              <motion.span
                key={i}
                style={{
                  fontFamily: '"Orbitron", "Rajdhani", "Russo One", sans-serif',
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  letterSpacing: '0.14em',
                  color: '#00d9dc',
                  display: 'inline-block',
                  textShadow:
                    '0 0 20px rgba(0,217,220,0.9), 0 0 45px rgba(0,217,220,0.5)',
                  zIndex: 8,
                }}
                initial={{ opacity: 0, y: 30, rotateX: -90 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{
                  duration: 0.42,
                  delay: i * 0.07,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {letter}
              </motion.span>
            ))}
          </div>
        )}

        {/* Tagline */}
        {phase >= 4 && (
          <motion.p
            style={{
              fontFamily: '"Rajdhani", "Russo One", sans-serif',
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: 'rgba(255,201,74,0.78)',
              marginTop: 2,
              zIndex: 8,
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          >
            Compétition interne 42
          </motion.p>
        )}
      </div>

      {/* Skip hint */}
      {phase >= 1 && (
        <motion.p
          className="absolute bottom-8 left-0 right-0 text-center pointer-events-none"
          style={{
            fontFamily: '"Rajdhani", sans-serif',
            fontSize: '0.62rem',
            letterSpacing: '0.32em',
            color: 'rgba(255,255,255,0.22)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          APPUYER POUR PASSER
        </motion.p>
      )}
    </motion.div>
  );
}
