import { useState } from 'react';
import { smashChar, smashCharImg, type SmashChar } from '../lib/smash';

/**
 * Vignette d'un personnage Smash : illustration officielle si elle charge, sinon
 * pastille colorée avec l'initiale (fallback robuste hors-ligne / hotlink bloqué).
 */
export function SmashCharIcon({
  id,
  size = 48,
  className = '',
}: {
  id: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const c = smashChar(id);
  const [broken, setBroken] = useState(false);
  const color = c?.color ?? '#5b6172';
  return (
    <div
      className={`relative overflow-hidden rounded-lg flex items-center justify-center font-display font-black text-white/90 ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}88)` }}
      title={c?.name ?? id ?? undefined}
    >
      {c && !broken ? (
        <img
          src={smashCharImg(c)}
          alt={c.name}
          draggable={false}
          loading="lazy"
          onError={() => setBroken(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <span style={{ fontSize: size * 0.42 }}>{(c?.name ?? id ?? '?')[0]?.toUpperCase()}</span>
      )}
    </div>
  );
}

export type { SmashChar };
