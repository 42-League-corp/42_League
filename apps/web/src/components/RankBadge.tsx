import { Crown, Gem, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { rankTierForRank } from '@42-league/shared';

/**
 * Badge pill « palier RANKED » à poser à côté d'un score ELO.
 * Couleur dérivée du palier (texte / bordure / fond léger), façon RankedBadge.
 *
 * - `elo`        : score servant à déterminer le palier.
 * - `rank`       : position dans le classement de la discipline ; top 5 → Grand Master.
 * - `size`       : 'xs' (compact, listes) | 'sm' (par défaut).
 * - `showLabel`  : libellé du palier (par défaut true) ; sinon icône/point seul.
 */
export function RankBadge({
  elo,
  rank,
  size = 'sm',
  showLabel = true,
  asLink = false,
  className = '',
}: {
  elo: number;
  /** Position (1 = 1er) dans le classement ; top 5 → grade Grand Master. */
  rank?: number | null;
  size?: 'xs' | 'sm';
  showLabel?: boolean;
  /** Enveloppe le badge dans un lien vers /grades. */
  asLink?: boolean;
  className?: string;
}) {
  const tier = rankTierForRank(elo, rank);
  const Icon = tier.key === 'grandmaster' ? Crown : tier.key === 'diamant' ? Gem : Shield;
  const iconCls = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  const sizeCls = showLabel
    ? size === 'xs'
      ? 'text-[8px] px-1 py-px gap-0.5'
      : 'text-[9px] px-1.5 py-0.5 gap-1'
    : size === 'xs'
      ? 'p-0.5'
      : 'p-1';
  const badge = (
    <span
      className={`inline-flex items-center rounded-full font-extrabold uppercase tracking-[0.12em] leading-none border ${sizeCls} ${asLink ? 'cursor-pointer hover:brightness-125 transition-[filter]' : ''} ${className}`}
      style={{
        color: tier.color,
        borderColor: `${tier.color}40`,
        backgroundColor: `${tier.color}26`,
      }}
      title={tier.label}
    >
      <Icon className={iconCls} strokeWidth={2.5} />
      {showLabel && <span>{tier.label}</span>}
    </span>
  );
  if (asLink) return <Link to="/grades">{badge}</Link>;
  return badge;
}
