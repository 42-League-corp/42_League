/**
 * Catalogue de personnages Street Fighter. Mécaniquement, SF se comporte comme le
 * Smash (sets Bo3/Bo5, deux persos) mais c'est une discipline distincte avec son
 * propre roster. Chaque entrée porte un id stable (stocké en base), un nom affiché
 * et une couleur d'accent. Pas d'image distante : SfCharIcon rend une pastille
 * colorée avec l'initiale (cf. SmashCharIcon, branche fallback).
 */
export interface SfChar {
  id: string;
  name: string;
  color: string;
}

export const SF_ROSTER: SfChar[] = [
  { id: 'ryu', name: 'Ryu', color: '#d7322a' },
  { id: 'ken', name: 'Ken', color: '#e8642c' },
  { id: 'chun_li', name: 'Chun-Li', color: '#2f7fd6' },
  { id: 'guile', name: 'Guile', color: '#3f7a3a' },
  { id: 'blanka', name: 'Blanka', color: '#3ba94f' },
  { id: 'dhalsim', name: 'Dhalsim', color: '#c97a1f' },
  { id: 'e_honda', name: 'E. Honda', color: '#1f6fc9' },
  { id: 'zangief', name: 'Zangief', color: '#b13030' },
  { id: 'sagat', name: 'Sagat', color: '#d8a32a' },
  { id: 'm_bison', name: 'M. Bison', color: '#7a2fb0' },
  { id: 'cammy', name: 'Cammy', color: '#3a9e6f' },
  { id: 'akuma', name: 'Akuma', color: '#8f2230' },
  { id: 'dee_jay', name: 'Dee Jay', color: '#e0b62a' },
  { id: 'cody', name: 'Cody', color: '#b8b0a0' },
  { id: 'juri', name: 'Juri', color: '#9e2f6f' },
  { id: 'luke', name: 'Luke', color: '#2f8fb0' },
  { id: 'jamie', name: 'Jamie', color: '#2f9e8f' },
  { id: 'kimberly', name: 'Kimberly', color: '#e05a9e' },
  { id: 'manon', name: 'Manon', color: '#b56fb0' },
  { id: 'marisa', name: 'Marisa', color: '#c75a3a' },
  { id: 'jp', name: 'JP', color: '#5a6f8f' },
  { id: 'lily', name: 'Lily', color: '#cf9a4a' },
  { id: 'rashid', name: 'Rashid', color: '#3aae9e' },
  { id: 'aki', name: 'A.K.I.', color: '#6f9e2f' },
  { id: 'ed', name: 'Ed', color: '#5f7fb0' },
  { id: 'terry', name: 'Terry', color: '#d33b3b' },
  { id: 'mai', name: 'Mai', color: '#e0507a' },
  { id: 'elena', name: 'Elena', color: '#2f9e7a' },
  { id: 'dan', name: 'Dan', color: '#e07a2f' },
  { id: 'sakura', name: 'Sakura', color: '#f08fb0' },
  { id: 'karin', name: 'Karin', color: '#d8a85a' },
  { id: 'vega', name: 'Vega', color: '#7a8fb0' },
  { id: 'balrog', name: 'Balrog', color: '#9e3030' },
  { id: 'fei_long', name: 'Fei Long', color: '#c93a3a' },
  { id: 't_hawk', name: 'T. Hawk', color: '#b06a3a' },
  { id: 'urien', name: 'Urien', color: '#3a8fb0' },
  { id: 'gill', name: 'Gill', color: '#9a3a9e' },
  { id: 'ibuki', name: 'Ibuki', color: '#4a9e6f' },
  { id: 'makoto', name: 'Makoto', color: '#caa84a' },
  { id: 'dudley', name: 'Dudley', color: '#5a6f9e' },
];

const BY_ID = new Map(SF_ROSTER.map((c) => [c.id, c]));

export function sfChar(id: string | null | undefined): SfChar | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Nom affichable d'un perso (fallback : l'id brut si inconnu). */
export function sfCharName(id: string | null | undefined): string {
  if (!id) return '—';
  return BY_ID.get(id)?.name ?? id;
}
