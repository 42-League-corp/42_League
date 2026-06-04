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
  // --- Street Fighter 6 — roster de base ---
  { id: 'ryu', name: 'Ryu', color: '#d7322a' },
  { id: 'ken', name: 'Ken', color: '#e8642c' },
  { id: 'chun_li', name: 'Chun-Li', color: '#2f7fd6' },
  { id: 'guile', name: 'Guile', color: '#3f7a3a' },
  { id: 'blanka', name: 'Blanka', color: '#3ba94f' },
  { id: 'dhalsim', name: 'Dhalsim', color: '#c97a1f' },
  { id: 'e_honda', name: 'E. Honda', color: '#1f6fc9' },
  { id: 'zangief', name: 'Zangief', color: '#b13030' },
  { id: 'cammy', name: 'Cammy', color: '#3a9e6f' },
  { id: 'dee_jay', name: 'Dee Jay', color: '#e0b62a' },
  { id: 'juri', name: 'Juri', color: '#9e2f6f' },
  { id: 'luke', name: 'Luke', color: '#2f8fb0' },
  { id: 'jamie', name: 'Jamie', color: '#2f9e8f' },
  { id: 'kimberly', name: 'Kimberly', color: '#e05a9e' },
  { id: 'manon', name: 'Manon', color: '#b56fb0' },
  { id: 'marisa', name: 'Marisa', color: '#c75a3a' },
  { id: 'jp', name: 'JP', color: '#5a6f8f' },
  { id: 'lily', name: 'Lily', color: '#cf9a4a' },
  { id: 'cody', name: 'Cody', color: '#b8b0a0' },
  // --- Street Fighter 6 — DLC (Year 1 & 2) ---
  { id: 'rashid', name: 'Rashid', color: '#3aae9e' },
  { id: 'aki', name: 'A.K.I.', color: '#6f9e2f' },
  { id: 'ed', name: 'Ed', color: '#5f7fb0' },
  { id: 'akuma', name: 'Akuma', color: '#8f2230' },
  { id: 'm_bison', name: 'M. Bison', color: '#7a2fb0' },
  { id: 'terry', name: 'Terry', color: '#d33b3b' },
  { id: 'mai', name: 'Mai', color: '#e0507a' },
  { id: 'elena', name: 'Elena', color: '#2f9e7a' },
  { id: 'sagat', name: 'Sagat', color: '#d8a32a' },
  { id: 'vega', name: 'Vega', color: '#7a8fb0' },
  // --- Classiques : Street Fighter II ---
  { id: 'balrog', name: 'Balrog', color: '#9e3030' },
  { id: 'fei_long', name: 'Fei Long', color: '#c93a3a' },
  { id: 't_hawk', name: 'T. Hawk', color: '#b06a3a' },
  { id: 'dan', name: 'Dan', color: '#e07a2f' },
  // --- Classiques : Street Fighter Alpha ---
  { id: 'sakura', name: 'Sakura', color: '#f08fb0' },
  { id: 'karin', name: 'Karin', color: '#d8a85a' },
  { id: 'rose', name: 'Rose', color: '#b04a8f' },
  { id: 'rolento', name: 'Rolento', color: '#7a8f4a' },
  { id: 'sodom', name: 'Sodom', color: '#c0703a' },
  { id: 'guy', name: 'Guy', color: '#c94a3a' },
  { id: 'birdie', name: 'Birdie', color: '#3a9e5a' },
  { id: 'adon', name: 'Adon', color: '#d85a4a' },
  { id: 'gen', name: 'Gen', color: '#6f7a8f' },
  { id: 'charlie', name: 'Charlie', color: '#4a7a4a' },
  { id: 'r_mika', name: 'R. Mika', color: '#e0507f' },
  { id: 'cracker_jack', name: 'Cracker Jack', color: '#9e6f3a' },
  { id: 'gouken', name: 'Gouken', color: '#b5723a' },
  // --- Classiques : Street Fighter III ---
  { id: 'alex', name: 'Alex', color: '#3a7fb0' },
  { id: 'ryu_iii', name: 'Ryu (III)', color: '#cf3a3a' },
  { id: 'yun', name: 'Yun', color: '#3a9e6f' },
  { id: 'yang', name: 'Yang', color: '#3a7fae' },
  { id: 'dudley', name: 'Dudley', color: '#5a6f9e' },
  { id: 'ibuki', name: 'Ibuki', color: '#4a9e6f' },
  { id: 'makoto', name: 'Makoto', color: '#caa84a' },
  { id: 'elena_iii', name: 'Elena (III)', color: '#2f9e8f' },
  { id: 'oro', name: 'Oro', color: '#b59a5a' },
  { id: 'urien', name: 'Urien', color: '#3a8fb0' },
  { id: 'gill', name: 'Gill', color: '#9a3a9e' },
  { id: 'necro', name: 'Necro', color: '#6f9e3a' },
  { id: 'twelve', name: 'Twelve', color: '#9aa0b5' },
  { id: 'remy', name: 'Remy', color: '#4a6fae' },
  { id: 'q', name: 'Q', color: '#7a7a7a' },
  { id: 'sean', name: 'Sean', color: '#e0903a' },
  { id: 'hugo', name: 'Hugo', color: '#b04a4a' },
  { id: 'kolin', name: 'Kolin', color: '#5ab0d8' },
  // --- Street Fighter V (exclusifs) ---
  { id: 'nash', name: 'Nash', color: '#4a8f5a' },
  { id: 'fang', name: 'F.A.N.G', color: '#7a3a9e' },
  { id: 'laura', name: 'Laura', color: '#3ab09e' },
  { id: 'necalli', name: 'Necalli', color: '#9e4a3a' },
  { id: 'rashid_v', name: 'Rashid (V)', color: '#3aaeae' },
  { id: 'abigail', name: 'Abigail', color: '#c95a3a' },
  { id: 'menat', name: 'Menat', color: '#c04aae' },
  { id: 'zeku', name: 'Zeku', color: '#6f8f4a' },
  { id: 'falke', name: 'Falke', color: '#5a8fb0' },
  { id: 'g', name: 'G', color: '#d8b03a' },
  { id: 'lucia', name: 'Lucia', color: '#3a8fae' },
  { id: 'seth', name: 'Seth', color: '#9aa0b5' },
  { id: 'poison', name: 'Poison', color: '#e05aae' },
  { id: 'kage', name: 'Kage', color: '#7a2f3a' },
  { id: 'gill_v', name: 'Gill (V)', color: '#9a3aae' },
  { id: 'eleven', name: 'Eleven', color: '#8a8f9e' },
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
