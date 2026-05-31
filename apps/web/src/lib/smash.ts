/**
 * Catalogue de personnages Smash (sous-ensemble populaire). Chaque entrée porte
 * un id stable (stocké en base), un nom affiché, une couleur d'accent et un slug
 * pour l'image officielle smashbros.com. L'image est « best-effort » : en cas
 * d'échec de chargement, on retombe sur une pastille colorée (voir SmashCharIcon).
 */
export interface SmashChar {
  id: string;
  name: string;
  color: string;
  slug: string; // smashbros.com /assets_v2/img/fighter/<slug>/main.png
}

export const SMASH_ROSTER: SmashChar[] = [
  { id: 'mario', name: 'Mario', color: '#e52521', slug: 'mario' },
  { id: 'luigi', name: 'Luigi', color: '#3aa14b', slug: 'luigi' },
  { id: 'peach', name: 'Peach', color: '#f48fb1', slug: 'peach' },
  { id: 'bowser', name: 'Bowser', color: '#5a8f2f', slug: 'koopa' },
  { id: 'donkey_kong', name: 'Donkey Kong', color: '#7a4a23', slug: 'donkey_kong' },
  { id: 'yoshi', name: 'Yoshi', color: '#54a338', slug: 'yoshi' },
  { id: 'kirby', name: 'Kirby', color: '#ff9ec7', slug: 'kirby' },
  { id: 'fox', name: 'Fox', color: '#c98e3a', slug: 'fox' },
  { id: 'falco', name: 'Falco', color: '#5b78b5', slug: 'falco' },
  { id: 'pikachu', name: 'Pikachu', color: '#f6c700', slug: 'pikachu' },
  { id: 'jigglypuff', name: 'Jigglypuff', color: '#f7b8d2', slug: 'purin' },
  { id: 'link', name: 'Link', color: '#2e9e5b', slug: 'link' },
  { id: 'zelda', name: 'Zelda', color: '#d8b15a', slug: 'zelda' },
  { id: 'sheik', name: 'Sheik', color: '#9aa0b5', slug: 'sheik' },
  { id: 'ganondorf', name: 'Ganondorf', color: '#6b5a2e', slug: 'ganon' },
  { id: 'samus', name: 'Samus', color: '#e8732c', slug: 'samus' },
  { id: 'captain_falcon', name: 'Captain Falcon', color: '#3b5bdb', slug: 'captain' },
  { id: 'ness', name: 'Ness', color: '#d33b3b', slug: 'ness' },
  { id: 'marth', name: 'Marth', color: '#4f6bb0', slug: 'marth' },
  { id: 'roy', name: 'Roy', color: '#c0392b', slug: 'roy' },
  { id: 'ike', name: 'Ike', color: '#2f6f8f', slug: 'ike' },
  { id: 'mr_game_and_watch', name: 'Mr. Game & Watch', color: '#222222', slug: 'gamewatch' },
  { id: 'pit', name: 'Pit', color: '#cfa14a', slug: 'pit' },
  { id: 'wario', name: 'Wario', color: '#e0b400', slug: 'wario' },
  { id: 'snake', name: 'Snake', color: '#5a6b3a', slug: 'snake' },
  { id: 'sonic', name: 'Sonic', color: '#1f6fd6', slug: 'sonic' },
  { id: 'mega_man', name: 'Mega Man', color: '#2a8fe0', slug: 'rockman' },
  { id: 'pac_man', name: 'Pac-Man', color: '#f6c700', slug: 'pacman' },
  { id: 'cloud', name: 'Cloud', color: '#9fb7c9', slug: 'cloud' },
  { id: 'bayonetta', name: 'Bayonetta', color: '#3a3a4a', slug: 'bayonetta' },
  { id: 'inkling', name: 'Inkling', color: '#e8417a', slug: 'inkling' },
  { id: 'ridley', name: 'Ridley', color: '#8a2f6f', slug: 'ridley' },
  { id: 'king_k_rool', name: 'King K. Rool', color: '#b59a3a', slug: 'krool' },
  { id: 'isabelle', name: 'Isabelle', color: '#e6c84a', slug: 'shizue' },
  { id: 'incineroar', name: 'Incineroar', color: '#c0392b', slug: 'gaogaen' },
  { id: 'joker', name: 'Joker', color: '#c0152b', slug: 'jack' },
  { id: 'hero', name: 'Hero', color: '#3b78c2', slug: 'brave' },
  { id: 'banjo', name: 'Banjo & Kazooie', color: '#b9772a', slug: 'banjo' },
  { id: 'terry', name: 'Terry', color: '#d33b3b', slug: 'terry' },
  { id: 'steve', name: 'Steve', color: '#5a8f4a', slug: 'pickel' },
  { id: 'sephiroth', name: 'Sephiroth', color: '#9aa0b5', slug: 'edge' },
  { id: 'kazuya', name: 'Kazuya', color: '#7a3a3a', slug: 'demon' },
  { id: 'sora', name: 'Sora', color: '#e05a8a', slug: 'trail' },
];

const BY_ID = new Map(SMASH_ROSTER.map((c) => [c.id, c]));

export function smashChar(id: string | null | undefined): SmashChar | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Nom affichable d'un perso (fallback : l'id brut si inconnu). */
export function smashCharName(id: string | null | undefined): string {
  if (!id) return '—';
  return BY_ID.get(id)?.name ?? id;
}

/** URL de l'illustration officielle (best-effort). */
export function smashCharImg(c: SmashChar): string {
  return `https://www.smashbros.com/assets_v2/img/fighter/${c.slug}/main.png`;
}
