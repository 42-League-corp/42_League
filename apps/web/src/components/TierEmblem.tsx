import { tierImage } from '../lib/tierImages';
import type { RankTier, RankTierKey } from '@42-league/shared';

/**
 * Emblème (blason) d'un palier RANKED — l'image dédiée du grade (`public/<tier>.png`).
 * Remplace les icônes génériques Lucide (Shield/Gem/Crown) partout où un grade
 * s'affiche : badges, cartes de la page Grades, frise…
 *
 * Cadré rond par défaut (`object-cover`) : le blason est recentré et les bords
 * (fond) sont rognés. La couleur du palier sert d'anneau/halo pour l'ancrer
 * visuellement quelle que soit la teinte de l'image.
 *
 * - `tier`   : palier (clé + couleur) — voir `@42-league/shared`.
 * - `size`   : diamètre en px (carré). Défaut 36.
 * - `ring`   : anneau coloré du palier autour de l'emblème (défaut true).
 * - `rounded`: arrondi (défaut 'full' = pastille ; 'lg' = écusson carré arrondi).
 */
export function TierEmblem({
  tier,
  size = 36,
  ring = true,
  rounded = 'full',
  className = '',
}: {
  tier: Pick<RankTier, 'key' | 'label' | 'color'> & { key: RankTierKey };
  size?: number;
  ring?: boolean;
  rounded?: 'full' | 'lg';
  className?: string;
}) {
  const radius = rounded === 'full' ? '9999px' : '0.5rem';
  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `${tier.color}1f`,
        ...(ring
          ? { border: `1px solid ${tier.color}66`, boxShadow: `0 0 10px ${tier.color}33` }
          : null),
      }}
      title={tier.label}
    >
      <img
        src={tierImage(tier.key)}
        alt={tier.label}
        loading="lazy"
        draggable={false}
        className="w-full h-full object-cover select-none"
      />
    </span>
  );
}
