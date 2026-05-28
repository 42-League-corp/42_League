import { type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Cog } from 'lucide-react';
import { RivetCorners } from './RivetCorners';

interface MetalFrameProps {
  children: ReactNode;
  /** Densité visuelle du décor — `lite` pour les cards de liste, `hero` pour la pièce maîtresse. */
  variant?: 'lite' | 'hero';
  /** Coins rivetés (4 boulons SVG). Activé par défaut. */
  rivets?: boolean;
  /** Rouage animé en haut à droite. */
  gear?: boolean;
  /** Grille HUD très subtile. */
  hudGrid?: boolean;
  /** Sweep doré périodique (réservé au hero). */
  shimmer?: boolean;
  /** Tubes laiton horizontaux en haut et en bas. */
  brassPipes?: boolean;
  /** Halo conique doré en arrière-plan (cosmétique, désactivé si reduced-motion). */
  conic?: boolean;
  /** Glow doré externe (utile pour mettre en avant). */
  glow?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  as?: 'div' | 'button';
  ariaLabel?: string;
}

/**
 * Cartouche métallique réutilisable — pierre angulaire du look RPG/HUD premium.
 *
 * Combine, dans un seul composant maintenable :
 *  - Fond dégradé acier brossé (anthracite chaud)
 *  - Bordure dorée riche avec relief
 *  - Tubes laiton décoratifs (haut/bas)
 *  - Rivets aux 4 coins (SVG, voir RivetCorners)
 *  - Rouage qui tourne (lucide Cog + keyframe gear-spin)
 *  - Grille HUD très estompée
 *  - Halo conique doré ultra lent (uniquement variant `hero`)
 *
 * Le design pioche dans les classes existantes (`metal-plate`, `brass-pipe`,
 * `hud-grid`) pour rester cohérent avec le reste du système.
 *
 * Usage minimal :
 *   <MetalFrame><MyContent /></MetalFrame>
 *
 * Usage hero :
 *   <MetalFrame variant="hero" gear shimmer conic>
 *     <HeroContent />
 *   </MetalFrame>
 */
export function MetalFrame({
  children,
  variant = 'lite',
  rivets = true,
  gear = false,
  hudGrid = true,
  shimmer = false,
  brassPipes = true,
  conic = false,
  glow = false,
  className = '',
  style,
  onClick,
  as = 'div',
  ariaLabel,
}: MetalFrameProps) {
  const reduce = useReducedMotion();
  const isHero = variant === 'hero';

  const baseStyle: CSSProperties = {
    background: isHero
      ? 'linear-gradient(180deg, #2a241c 0%, #1d1914 18%, #15120e 50%, #1d1914 82%, #2a241c 100%)'
      : 'linear-gradient(180deg, rgba(42,36,28,0.7) 0%, rgba(21,18,14,0.92) 100%)',
    border: '1px solid rgba(255, 201, 74, 0.35)',
    boxShadow: glow
      ? 'inset 0 1px 0 rgba(255, 215, 120, 0.18), inset 0 -1px 0 rgba(0,0,0,0.5), 0 12px 36px -8px rgba(255, 201, 74, 0.28), 0 0 0 1px rgba(0,0,0,0.45)'
      : 'inset 0 1px 0 rgba(255, 215, 120, 0.12), inset 0 -1px 0 rgba(0,0,0,0.45), 0 6px 18px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(0,0,0,0.35)',
    ...style,
  };

  const inner = (
    <>
      {/* Tubes laiton haut/bas */}
      {brassPipes && (
        <>
          <div className="absolute top-0 left-3 right-3 h-[2px] brass-pipe rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-3 right-3 h-[2px] brass-pipe rounded-full pointer-events-none" />
        </>
      )}

      {/* Halo conique doré (hero uniquement, opt-in) */}
      {conic && !reduce && (
        <motion.div
          aria-hidden
          className="absolute inset-0 opacity-25 pointer-events-none gpu"
          animate={{ rotate: 360 }}
          transition={{ duration: 40, ease: 'linear', repeat: Infinity }}
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255,201,74,0.35) 60deg, transparent 120deg, rgba(192,138,74,0.25) 200deg, transparent 260deg, rgba(255,201,74,0.25) 340deg, transparent 360deg)',
            filter: 'blur(50px)',
            willChange: 'transform',
          }}
        />
      )}

      {/* Sweep doré */}
      {shimmer && (
        <div aria-hidden className="absolute inset-0 opacity-20 pointer-events-none shimmer" />
      )}

      {/* Grille HUD */}
      {hudGrid && (
        <div aria-hidden className="absolute inset-0 hud-grid opacity-40 pointer-events-none" />
      )}

      {/* Rouage décoratif */}
      {gear && !reduce && (
        <Cog
          className="absolute top-3 right-3 w-5 h-5 text-gold/40 animate-gear-spin pointer-events-none"
          strokeWidth={2}
          aria-hidden
        />
      )}

      {/* Rivets aux 4 coins */}
      {rivets && <RivetCorners />}

      {/* Contenu */}
      <div className="relative z-10">{children}</div>
    </>
  );

  const cls = `relative overflow-hidden rounded-3xl no-select ${
    onClick ? 'tap-transparent active:scale-[0.985] transition-transform' : ''
  } ${className}`;

  if (as === 'button' && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={cls}
        style={baseStyle}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={cls} style={baseStyle} onClick={onClick}>
      {inner}
    </div>
  );
}
