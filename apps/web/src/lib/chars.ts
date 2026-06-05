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

/** Normalise une chaîne pour la recherche : minuscules, sans accents/diacritiques. */
export function normalizeSearch(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/**
 * Filtre un roster par requête (nom OU id, insensible à la casse/aux accents).
 * Requête vide → roster complet inchangé.
 */
export function filterRoster<T extends { id: string; name: string }>(roster: T[], query: string): T[] {
  const q = normalizeSearch(query);
  if (!q) return roster;
  return roster.filter((c) => normalizeSearch(c.name).includes(q) || normalizeSearch(c.id).includes(q));
}

// ─── Persos PAR MANCHE (encodage dans le champ perso unique) ──────────────────
//
// Par défaut un joueur choisit UN perso pour tout le set (charA/charB = "mario").
// S'il détaille manche par manche, on encode la liste dans le même champ avec un
// séparateur ("mario>luigi>mario") — aucune migration nécessaire, et rétro-
// compatible : un ancien match (un seul id, sans séparateur) se décode en une
// liste d'un élément.

export const CHAR_SEP = '>';

/** Découpe un champ perso en liste de persos par manche (vide si null). */
export function decodeChars(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split(CHAR_SEP).map((x) => x.trim()).filter(Boolean);
}

/**
 * Encode une liste de persos par manche. Si tous identiques (ou un seul), renvoie
 * l'id simple → reste propre et rétro-compatible quand aucun détail n'est saisi.
 */
export function encodeChars(ids: (string | null | undefined)[]): string {
  const list = ids.map((x) => (x ?? '').trim()).filter(Boolean);
  if (list.length === 0) return '';
  if (list.every((x) => x === list[0])) return list[0]!;
  return list.join(CHAR_SEP);
}

/** Premier perso d'un champ (affichage compact à une seule icône). */
export function primaryChar(s: string | null | undefined): string | null {
  return decodeChars(s)[0] ?? null;
}

/** Favoris stockés sur l'utilisateur pour ce jeu (jamais undefined). */
export function favoritesForGame(
  user: NonNullable<MeResponse['user']> | undefined | null,
  game: FightingGame,
): string[] {
  if (!user) return [];
  return (game === 'streetfighter' ? user.favSf : user.favSmash) ?? [];
}
