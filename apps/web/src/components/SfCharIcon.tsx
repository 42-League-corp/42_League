import { sfChar, type SfChar } from '../lib/sf';

/**
 * Vignette d'un personnage Street Fighter : pastille en dégradé coloré avec
 * l'initiale du perso. Pas de dépendance image distante (robuste hors-ligne),
 * à l'image de la branche fallback de SmashCharIcon.
 */
export function SfCharIcon({
  id,
  size = 48,
  className = '',
}: {
  id: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const c = sfChar(id);
  const color = c?.color ?? '#5b6172';
  return (
    <div
      className={`relative overflow-hidden rounded-lg flex items-center justify-center font-display font-black text-white/90 ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}88)` }}
      title={c?.name ?? id ?? undefined}
    >
      <span style={{ fontSize: size * 0.42 }}>{(c?.name ?? id ?? '?')[0]?.toUpperCase()}</span>
    </div>
  );
}

export type { SfChar };
