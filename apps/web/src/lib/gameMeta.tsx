/**
 * Métadonnées visuelles par univers (couleur, libellé, logo). Partagé entre le
 * sélecteur d'univers (GameModeSwitch), les pastilles de recherche du matchmaking
 * (MatchmakingButton) et l'overlay VERSUS (logo du mode où l'on a été apparié).
 */
import type { Game } from './gameMode';

export const GAMES: Game[] = ['babyfoot', 'smash', 'chess', 'streetfighter'];

export interface GameMeta {
  label: string;
  shortLabel: string;
  color: string; // CSS color string (Tailwind ne passe pas en CSS inline)
  borderColor: string;
  bgColor: string;
  glowColor: string;
  // Reçoit `sel` (univers sélectionné) : les logos PNG basculent gris↔couleur ;
  // les SVG l'ignorent et se colorent via `currentColor` sur le parent.
  icon: (sel: boolean) => React.ReactElement;
}

export const GAME_META: Record<Game, GameMeta> = {
  babyfoot: {
    label: 'Babyfoot',
    shortLabel: 'Baby',
    color: '#ffc94a',
    borderColor: 'rgba(255,201,74,0.6)',
    bgColor: 'rgba(255,201,74,0.10)',
    glowColor: 'rgba(255,201,74,0.45)',
    icon: () => (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <rect x="2" y="5" width="20" height="2" rx="1" fill="currentColor" opacity="0.55" />
        <rect x="10.8" y="5" width="2.4" height="10" rx="1" fill="currentColor" />
        <circle cx="12" cy="9.5" r="2.8" fill="currentColor" />
        <rect x="8.5" y="12" width="7" height="4.5" rx="1.2" fill="currentColor" />
        <circle cx="12" cy="20" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  smash: {
    label: 'Smash',
    shortLabel: 'Smash',
    color: '#ff3d50',
    borderColor: 'rgba(255,61,80,0.6)',
    bgColor: 'rgba(255,61,80,0.10)',
    glowColor: 'rgba(255,61,80,0.45)',
    icon: (sel) => (
      <img src={sel ? '/smash-color.png' : '/smash-grey.png'} alt="" width={20} height={20} loading="eager" decoding="async" className="object-contain" aria-hidden />
    ),
  },
  chess: {
    label: 'Échecs',
    shortLabel: 'Échecs',
    color: '#56c46e',
    borderColor: 'rgba(86,196,110,0.6)',
    bgColor: 'rgba(86,196,110,0.10)',
    glowColor: 'rgba(86,196,110,0.45)',
    icon: () => (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <path d="M12 2 v4 M10 4 h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 7 C8.5 7 8 11 10.5 13 L9 19 h6 l-1.5 -6 C16 11 15.5 7 12 7 Z" fill="currentColor" />
        <rect x="7.5" y="19" width="9" height="2.5" rx="1" fill="currentColor" />
        <rect x="6" y="21" width="12" height="2" rx="1" fill="currentColor" />
      </svg>
    ),
  },
  streetfighter: {
    label: 'Street Fighter',
    shortLabel: 'SF',
    color: '#ff7a18',
    borderColor: 'rgba(255,122,24,0.6)',
    bgColor: 'rgba(255,122,24,0.10)',
    glowColor: 'rgba(255,122,24,0.45)',
    icon: (sel) => (
      <img src={sel ? '/sf-color.png' : '/sf-grey.png'} alt="" width={20} height={20} loading="eager" decoding="async" className="object-contain" aria-hidden />
    ),
  },
};
