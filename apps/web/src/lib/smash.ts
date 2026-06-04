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
  { id: 'king_dedede', name: 'King Dedede', color: '#8f6a3a', slug: 'dedede' },
  { id: 'wolf', name: 'Wolf', color: '#8b8f97', slug: 'wolf' },
  { id: 'dr_mario', name: 'Dr. Mario', color: '#8f5a9e', slug: 'drmario' },
  { id: 'rosalina', name: 'Rosalina', color: '#7eb7ff', slug: 'rosetta' },
  { id: 'toon_link', name: 'Toon Link', color: '#9ac84f', slug: 'toonlink' },
  { id: 'young_link', name: 'Young Link', color: '#73b95b', slug: 'younglink' },
  { id: 'pichu', name: 'Pichu', color: '#f2d14a', slug: 'pichu' },
  { id: 'pokemon_trainer', name: 'Pokémon Trainer', color: '#d85a5a', slug: 'ptrainer' },
  { id: 'lucario', name: 'Lucario', color: '#4e7fd6', slug: 'lucario' },
  { id: 'charizard', name: 'Charizard', color: '#e8703a', slug: 'plizardon' },
  { id: 'mewtwo', name: 'Mewtwo', color: '#b77be6', slug: 'mewtwo' },
  { id: 'greninja', name: 'Greninja', color: '#4f87d8', slug: 'gekkouga' },
  { id: 'diddy_kong', name: 'Diddy Kong', color: '#c98a42', slug: 'diddy_kong' },
  { id: 'mii_fighter', name: 'Mii Fighter', color: '#6f7b8f', slug: 'miifighter' },
  { id: 'wii_fit_trainer', name: 'Wii Fit Trainer', color: '#78c8b8', slug: 'wiifit' },
  { id: 'villager', name: 'Villager', color: '#d49c64', slug: 'murabito' },
  { id: 'rob', name: 'R.O.B.', color: '#a8b2bf', slug: 'robot' },
  { id: 'shulk', name: 'Shulk', color: '#e38a55', slug: 'shulk' },
  { id: 'meta_knight', name: 'Meta Knight', color: '#55607a', slug: 'metaknight' },
  { id: 'dark_pit', name: 'Dark Pit', color: '#6b5a8f', slug: 'darkpit' },
  { id: 'lucina', name: 'Lucina', color: '#6d7fe6', slug: 'lucina' },
  { id: 'lucas', name: 'Lucas', color: '#e27b63', slug: 'lucas' },
  { id: 'olimar', name: 'Olimar', color: '#d9a23a', slug: 'pikmin' },
  { id: 'little_mac', name: 'Little Mac', color: '#3b7de0', slug: 'littlemac' },
  { id: 'bowser_jr', name: 'Bowser Jr.', color: '#7ea84f', slug: 'koopajr' },
  { id: 'duck_hunt', name: 'Duck Hunt', color: '#8e6a42', slug: 'duckhunt' },
  { id: 'ice_climbers', name: 'Ice Climbers', color: '#6faee6', slug: 'iceclimber' },
  { id: 'zero_suit_samus', name: 'Zero Suit Samus', color: '#4aa3d8', slug: 'szerosuit' },
  { id: 'robin', name: 'Robin', color: '#7e5f4d', slug: 'reflet' },
  { id: 'corrin', name: 'Corrin', color: '#9fc0d8', slug: 'kamui' },
  { id: 'palutena', name: 'Palutena', color: '#c3a15a', slug: 'palutena' },
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

/** Portrait local du perso (assets public/smash/, cf. scripts/fetch_smash_portraits.py).
 *  Best-effort : image manquante → pastille colorée dans SmashCharIcon. */
export function smashCharImg(c: SmashChar): string {
  return `/smash/${c.id}.png`;
}
