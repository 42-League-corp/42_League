/**
 * Visuel par défaut d'un tournoi sans image : un dégradé "art" choisi de façon
 * déterministe à partir de son id (même tournoi → même couleur, stable au refresh).
 * Si une image (URL) est fournie, on l'utilise à la place — voir le composant carte.
 */

export interface TournamentArt {
  /** Dégradé CSS de fond. */
  background: string;
  /** Teinte d'accent (texte/halo). */
  accent: string;
}

const PALETTE: TournamentArt[] = [
  { background: 'linear-gradient(135deg, #3a2e10 0%, #1d1914 55%, #2a1f0a 100%)', accent: '#ffc94a' },
  { background: 'linear-gradient(135deg, #0f2e2a 0%, #14201d 55%, #0a2622 100%)', accent: '#3fd6c0' },
  { background: 'linear-gradient(135deg, #2e1033 0%, #1d1422 55%, #260a2a 100%)', accent: '#c97bff' },
  { background: 'linear-gradient(135deg, #33120f 0%, #221412 55%, #2a0a0c 100%)', accent: '#ff6b6b' },
  { background: 'linear-gradient(135deg, #10233a 0%, #141b22 55%, #0a182a 100%)', accent: '#5fb4ff' },
  { background: 'linear-gradient(135deg, #16330f 0%, #182214 55%, #0d2a0a 100%)', accent: '#7fd66e' },
];

/** Hash déterministe simple (djb2) → index de palette. */
function hashSeed(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (h * 33) ^ seed.charCodeAt(i);
  return Math.abs(h);
}

export function tournamentArt(seed: string): TournamentArt {
  const art = PALETTE[hashSeed(seed) % PALETTE.length];
  return art ?? PALETTE[0]!;
}

/**
 * Défense en profondeur côté rendu : ne laisse passer une URL d'image que si
 * elle parse en http(s). Bloque les schémas dangereux (javascript:, data:,
 * vbscript:, file:…) qui, injectés dans un `<img src>` ou un `url()` CSS,
 * permettraient une exécution de code. Retourne `undefined` si l'URL est
 * absente ou non sûre.
 */
export function safeImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const p = new URL(url).protocol;
    return p === 'http:' || p === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}
