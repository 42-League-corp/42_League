/**
 * Métadonnées visuelles par univers (couleur, libellé, logo). Partagé entre le
 * sélecteur d'univers (GameModeSwitch), les pastilles de recherche du matchmaking
 * (MatchmakingButton) et l'overlay VERSUS (logo du mode où l'on a été apparié).
 */
import type { Game } from './gameMode';

export const GAMES: Game[] = ['babyfoot', 'smash', 'chess', 'streetfighter', 'flechettes'];

export interface GameMeta {
  label: string;
  shortLabel: string;
  color: string; // CSS color string (Tailwind ne passe pas en CSS inline)
  borderColor: string;
  bgColor: string;
  glowColor: string;
  // Palette du bouton « Match aléatoire » déclinée à l'identité du mode (dégradé
  // clair→profond, couleur du texte, bordure et glow). Le design du bouton reste
  // le même ; seules les couleurs changent selon l'univers courant.
  button: { from: string; via: string; to: string; text: string; border: string; glow: string };
  // Reçoit `sel` (univers sélectionné) : les logos PNG basculent gris↔couleur ;
  // les SVG l'ignorent et se colorent via `currentColor` sur le parent.
  // `size` (px, défaut 20) permet d'agrandir le logo dans les gros contenants
  // (ex : FAB du sélecteur d'univers) où un PNG à 20px paraît trop petit.
  icon: (sel: boolean, size?: number) => React.ReactElement;
}

export const GAME_META: Record<Game, GameMeta> = {
  babyfoot: {
    label: 'Babyfoot',
    shortLabel: 'Baby',
    color: '#ffc94a',
    borderColor: 'rgba(255,201,74,0.6)',
    bgColor: 'rgba(255,201,74,0.10)',
    glowColor: 'rgba(255,201,74,0.45)',
    button: { from: '#ffd87a', via: '#f0a020', to: '#c5520a', text: '#1a0d00', border: 'rgba(255,201,102,0.6)', glow: 'rgba(255,128,32,0.4)' },
    icon: (sel, size = 20) => (
      <img src={sel ? '/coulour%20baby.png' : '/gray%20baby.png'} alt="" width={size} height={size} loading="eager" decoding="async" className="object-contain" aria-hidden />
    ),
  },
  smash: {
    label: 'Smash',
    shortLabel: 'Smash',
    color: '#ff3d50',
    borderColor: 'rgba(255,61,80,0.6)',
    bgColor: 'rgba(255,61,80,0.10)',
    glowColor: 'rgba(255,61,80,0.45)',
    button: { from: '#ff9aa6', via: '#ff3d50', to: '#a8121f', text: '#2a0307', border: 'rgba(255,128,140,0.6)', glow: 'rgba(255,61,80,0.4)' },
    icon: (sel, size = 20) => (
      <img src={sel ? '/smash-color.png' : '/smash-grey.png'} alt="" width={size} height={size} loading="eager" decoding="async" className="object-contain" aria-hidden />
    ),
  },
  chess: {
    label: 'Échecs',
    shortLabel: 'Échecs',
    color: '#56c46e',
    borderColor: 'rgba(86,196,110,0.6)',
    bgColor: 'rgba(86,196,110,0.10)',
    glowColor: 'rgba(86,196,110,0.45)',
    button: { from: '#9ce6ab', via: '#56c46e', to: '#2c7a40', text: '#04240e', border: 'rgba(140,224,160,0.6)', glow: 'rgba(86,196,110,0.4)' },
    icon: (sel, size = 20) => (
      <img src={sel ? '/chess.png' : '/gray%20chess.png'} alt="" width={size} height={size} loading="eager" decoding="async" className="object-contain" aria-hidden />
    ),
  },
  streetfighter: {
    label: 'Street Fighter',
    shortLabel: 'SF',
    color: '#ff7a18',
    borderColor: 'rgba(255,122,24,0.6)',
    bgColor: 'rgba(255,122,24,0.10)',
    glowColor: 'rgba(255,122,24,0.45)',
    button: { from: '#ffc08a', via: '#ff7a18', to: '#b8480a', text: '#2a1200', border: 'rgba(255,176,102,0.6)', glow: 'rgba(255,122,24,0.4)' },
    icon: (sel, size = 20) => (
      <img src={sel ? '/sf-color.png' : '/sf-grey.png'} alt="" width={size} height={size} loading="eager" decoding="async" className="object-contain" aria-hidden />
    ),
  },
  flechettes: {
    label: 'Fléchettes',
    shortLabel: 'Fléch.',
    color: '#14b8a6',
    borderColor: 'rgba(20,184,166,0.6)',
    bgColor: 'rgba(20,184,166,0.10)',
    glowColor: 'rgba(20,184,166,0.45)',
    button: { from: '#6fe3d6', via: '#14b8a6', to: '#0a7064', text: '#04241f', border: 'rgba(95,224,210,0.6)', glow: 'rgba(20,184,166,0.4)' },
    icon: (sel, size = 20) => (
      <img src={sel ? '/flechette.png' : '/gray%20flechette.png'} alt="" width={size} height={size} loading="eager" decoding="async" className="object-contain" aria-hidden />
    ),
  },
};
