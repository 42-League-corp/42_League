/**
 * Couleurs & logos par discipline, centralisés ici pour éviter le hardcode
 * dispersé dans les composants. Source de vérité partagée (cartes profil, etc.).
 */
import type { Game } from './gameMode';

export const GAME_COLOR: Record<Game, string> = {
  babyfoot: '#ffc94a',
  smash: '#ff3d50',
  chess: '#56c46e',
  streetfighter: '#ff7a18',
  flechettes: '#14b8a6',
};

export function gameColor(g: Game): string {
  return GAME_COLOR[g];
}

/** Emoji de repli pour les disciplines sans logo PNG (babyfoot, chess). */
export const GAME_EMOJI: Record<Game, string> = {
  babyfoot: '⚽',
  smash: '🎮',
  chess: '♟',
  streetfighter: '🥊',
  flechettes: '🎯',
};

/** Logos PNG (uniquement smash & streetfighter en possèdent). */
export const GAME_LOGO_SRC: Partial<Record<Game, string>> = {
  smash: '/smash-color.png',
  streetfighter: '/sf-color.png',
};
