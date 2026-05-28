import { type CSSProperties } from 'react';

/**
 * Banque de silhouettes décoratives, inspirées d'un univers RPG/arcade.
 * Toutes sont des SVG vectoriels ultra-légers, sans dépendance externe.
 *
 * Conçues pour être empilées en arrière-plan d'un hero (très faible opacité,
 * `pointer-events-none`) pour donner un côté « authentique » à la carte.
 *
 * Le style est volontairement simple (silhouette pleine) pour rester lisible
 * même à 5-8 % d'opacité sur fond anthracite.
 */

interface SilhouetteProps {
  className?: string;
  style?: CSSProperties;
  /** Couleur de la silhouette — par défaut courant (text-color). */
  color?: string;
}

/** Champion casqué (façon plombier moustachu). */
export function ChampionSilhouette({ className = '', style, color = 'currentColor' }: SilhouetteProps) {
  return (
    <svg viewBox="0 0 80 120" className={className} style={style} aria-hidden>
      {/* Casquette */}
      <path
        d="M22 24 C 22 14, 30 8, 40 8 C 50 8, 58 14, 58 24 L 62 26 L 60 32 L 20 32 L 18 26 Z"
        fill={color}
      />
      {/* Visière */}
      <path d="M16 30 L 64 30 L 62 36 L 18 36 Z" fill={color} opacity="0.85" />
      {/* Tête + moustache (négatif blanc dans le visage) */}
      <ellipse cx="40" cy="42" rx="14" ry="13" fill={color} />
      {/* Corps */}
      <path
        d="M40 56 C 22 56, 14 72, 14 92 L 14 116 L 66 116 L 66 92 C 66 72, 58 56, 40 56 Z"
        fill={color}
      />
      {/* Boutons (creux dans la silhouette) */}
      <circle cx="40" cy="78" r="3" fill="rgba(0,0,0,0.5)" />
      <circle cx="40" cy="92" r="3" fill="rgba(0,0,0,0.5)" />
    </svg>
  );
}

/** Carapace de tortue (vue de dessus). */
export function ShellSilhouette({ className = '', style, color = 'currentColor' }: SilhouetteProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <ellipse cx="50" cy="55" rx="40" ry="32" fill={color} />
      <ellipse cx="50" cy="50" rx="32" ry="24" fill={color} opacity="0.75" />
      {/* Hexagones internes (motifs de carapace) */}
      <polygon points="50,38 60,44 60,56 50,62 40,56 40,44" fill="rgba(0,0,0,0.25)" />
      <polygon points="32,46 40,42 40,50 32,54" fill="rgba(0,0,0,0.18)" />
      <polygon points="68,46 60,42 60,50 68,54" fill="rgba(0,0,0,0.18)" />
    </svg>
  );
}

/** Couronne. */
export function CrownSilhouette({ className = '', style, color = 'currentColor' }: SilhouetteProps) {
  return (
    <svg viewBox="0 0 100 80" className={className} style={style} aria-hidden>
      <path
        d="M10 70 L 90 70 L 86 30 L 70 50 L 50 18 L 30 50 L 14 30 Z"
        fill={color}
      />
      <circle cx="14" cy="30" r="6" fill={color} />
      <circle cx="50" cy="18" r="6" fill={color} />
      <circle cx="86" cy="30" r="6" fill={color} />
      <rect x="10" y="68" width="80" height="6" fill={color} opacity="0.9" />
    </svg>
  );
}

/** Banane stylisée (clin d'œil arcade). */
export function BananaSilhouette({ className = '', style, color = 'currentColor' }: SilhouetteProps) {
  return (
    <svg viewBox="0 0 100 60" className={className} style={style} aria-hidden>
      <path
        d="M8 40 C 8 20, 24 8, 50 8 C 76 8, 92 20, 92 40 C 86 32, 70 28, 50 28 C 30 28, 14 32, 8 40 Z"
        fill={color}
      />
      <path
        d="M14 38 C 22 28, 38 26, 50 26 C 62 26, 78 28, 86 38 C 78 34, 64 33, 50 33 C 36 33, 22 34, 14 38 Z"
        fill="rgba(0,0,0,0.25)"
      />
    </svg>
  );
}

/** Glaive croisé — pour les défis. */
export function CrossedSwordsSilhouette({ className = '', style, color = 'currentColor' }: SilhouetteProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      {/* Lame 1 (haut-gauche → bas-droite) */}
      <rect x="48" y="10" width="4" height="80" fill={color} transform="rotate(45 50 50)" />
      <rect x="34" y="20" width="32" height="6" fill={color} transform="rotate(45 50 50)" />
      {/* Lame 2 (haut-droite → bas-gauche) */}
      <rect x="48" y="10" width="4" height="80" fill={color} transform="rotate(-45 50 50)" />
      <rect x="34" y="20" width="32" height="6" fill={color} transform="rotate(-45 50 50)" />
      {/* Pommeau central */}
      <circle cx="50" cy="50" r="6" fill={color} />
    </svg>
  );
}

/** Trophée stylisé. */
export function TrophySilhouette({ className = '', style, color = 'currentColor' }: SilhouetteProps) {
  return (
    <svg viewBox="0 0 100 120" className={className} style={style} aria-hidden>
      {/* Coupe */}
      <path
        d="M30 14 L 70 14 L 70 40 C 70 56, 62 66, 50 66 C 38 66, 30 56, 30 40 Z"
        fill={color}
      />
      {/* Anses */}
      <path
        d="M30 22 C 18 22, 10 30, 14 44 C 16 50, 22 52, 28 50"
        fill="none"
        stroke={color}
        strokeWidth="6"
      />
      <path
        d="M70 22 C 82 22, 90 30, 86 44 C 84 50, 78 52, 72 50"
        fill="none"
        stroke={color}
        strokeWidth="6"
      />
      {/* Pied */}
      <rect x="44" y="66" width="12" height="22" fill={color} />
      <rect x="30" y="86" width="40" height="10" fill={color} />
      <rect x="22" y="96" width="56" height="10" rx="2" fill={color} />
    </svg>
  );
}
