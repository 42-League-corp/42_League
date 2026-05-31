/**
 * Petit badge pill « RANKED » à poser à côté d'un score ELO.
 * Doré semi-transparent, discret mais visible. Taille via `size`.
 */
export function RankedBadge({
  className = '',
  size = 'sm',
}: {
  className?: string;
  size?: 'xs' | 'sm';
}) {
  const sizeCls = size === 'xs' ? 'text-[8px] px-1 py-px' : 'text-[9px] px-1.5 py-0.5';
  return (
    <span
      className={`inline-flex items-center rounded-full font-extrabold uppercase tracking-[0.12em] bg-gold/15 text-gold border border-gold/25 leading-none ${sizeCls} ${className}`}
    >
      Ranked
    </span>
  );
}
