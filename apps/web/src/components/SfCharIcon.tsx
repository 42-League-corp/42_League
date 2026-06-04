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
  const label = (c?.name ?? id ?? '?').replace(/[^A-Za-z0-9]/g, '');
  // Deux lettres pour mieux distinguer le large roster (ex. « DH », « MB »),
  // une seule si le nom est trop court (« Q », « G »).
  const initials = (label.slice(0, 2) || '?').toUpperCase();
  return (
    <div
      className={`relative overflow-hidden rounded-lg flex items-center justify-center font-display font-black text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(120% 120% at 30% 22%, ${color}f2 0%, ${color} 48%, ${color}99 100%)`,
        boxShadow: `inset 0 1px 1px rgba(255,255,255,0.28), inset 0 -2px 4px rgba(0,0,0,0.32), 0 1px 2px rgba(0,0,0,0.35)`,
      }}
      title={c?.name ?? id ?? undefined}
    >
      {/* Reflet diagonal subtil pour donner du relief à la pastille. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 42%)' }}
      />
      <span
        className="relative leading-none tracking-tight"
        style={{ fontSize: size * (initials.length > 1 ? 0.38 : 0.46), textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
      >
        {initials}
      </span>
    </div>
  );
}

export type { SfChar };
