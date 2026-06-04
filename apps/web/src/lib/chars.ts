import type { ComponentType } from 'react';
import { SmashCharIcon } from '../components/SmashCharIcon';
import { SfCharIcon } from '../components/SfCharIcon';
import { SMASH_ROSTER, smashCharName } from './smash';
import { SF_ROSTER, sfCharName } from './sf';
import type { Game } from './gameMode';
import type { MeResponse } from './api';

/**
 * Jeux « de combat » : se jouent avec un personnage (roster), donc seuls éligibles
 * aux persos favoris. Centralise la logique `isSf ? SF_… : SMASH_…` dispersée dans
 * la déclaration de match et les composants de favoris.
 */
export type FightingGame = 'smash' | 'streetfighter';

export function isFightingGame(game: Game): game is FightingGame {
  return game === 'smash' || game === 'streetfighter';
}

/** Roster (id + nom + couleur) du jeu de combat. */
export function rosterForGame(game: FightingGame): { id: string; name: string; color: string }[] {
  return game === 'streetfighter' ? SF_ROSTER : SMASH_ROSTER;
}

/** Composant d'icône perso adapté au jeu (props identiques : id/size/className). */
export function iconForGame(
  game: FightingGame,
): ComponentType<{ id: string | null | undefined; size?: number; className?: string }> {
  return game === 'streetfighter' ? SfCharIcon : SmashCharIcon;
}

/** Nom affichable d'un perso (fallback sur l'id si inconnu). */
export function charName(game: FightingGame, id: string): string {
  return game === 'streetfighter' ? sfCharName(id) : smashCharName(id);
}

/** Favoris stockés sur l'utilisateur pour ce jeu (jamais undefined). */
export function favoritesForGame(
  user: NonNullable<MeResponse['user']> | undefined | null,
  game: FightingGame,
): string[] {
  if (!user) return [];
  return (game === 'streetfighter' ? user.favSf : user.favSmash) ?? [];
}
