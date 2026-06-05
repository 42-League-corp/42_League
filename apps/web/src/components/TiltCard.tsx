import { useRef, useState, type CSSProperties, type ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TiltCard — carte avec tilt 3D + halo de brillance qui suit le curseur.
//
// Logique d'animation PARTAGÉE par toutes les cartes de trophées (solo, mix,
// FFA, équipes 2v2) pour qu'elles réagissent toutes de la même façon au hover,
// quelle que soit la section.
// ─────────────────────────────────────────────────────────────────────────────

/** #rrggbb → rgba(r,g,b,alpha) — pour teinter le halo selon la couleur du trophée. */
function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function TiltCard({
  children,
  className = '',
  glowHex,
  style,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  /** Couleur (hex #rrggbb) du halo de brillance qui suit le curseur. */
  glowHex: string;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState(
    'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)',
  );
  const [shine, setShine] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const tX = (y - 0.5) * -10;
    const tY = (x - 0.5) * 10;
    setTransform(`perspective(600px) rotateX(${tX}deg) rotateY(${tY}deg) scale(1.025)`);
    setShine({ x: x * 100, y: y * 100, opacity: 1 });
  };

  const handleMouseLeave = () => {
    setTransform('perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)');
    setShine((s) => ({ ...s, opacity: 0 }));
  };

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ ...style, transform, transition: 'transform 0.12s ease-out', transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {children}
      {/* Halo de brillance */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${shine.x}% ${shine.y}%, ${hexToRgba(glowHex, 0.22)} 0%, transparent 65%)`,
          opacity: shine.opacity,
          transition: 'opacity 0.25s ease',
        }}
      />
    </div>
  );
}
