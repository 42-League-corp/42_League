// Métadonnées d'obtention des TITRES, pour l'infobulle de profil (cf.
// CursorTooltip). On indique si le titre est UNIQUE (nominatif, un seul porteur)
// ou OBTENABLE (et comment). Le titre « Mysterious » reste VOLONTAIREMENT vague.
//
// La clé est le LIBELLÉ affiché, normalisé (minuscules, sans accents) — robuste
// aux variations de casse. Les titres inconnus (cosmétiques boutique créés via
// GOD) tombent sur un repli générique.

export type TitleKind = 'unique' | 'obtainable' | 'mysterious' | 'cosmetic';

export interface TitleMeta {
  kind: TitleKind;
  /** En-tête court (ex. « Titre unique »). */
  heading: string;
  /** Comment l'obtenir / qui le porte. */
  body: string;
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

const TITLE_META: Record<string, TitleMeta> = {
  'first committer': {
    kind: 'unique',
    heading: 'Titre unique · nominatif',
    body: 'Réservé au tout premier committeur de One League. Un seul porteur, à jamais.',
  },
  visionnaire: {
    kind: 'unique',
    heading: 'Titre unique · nominatif',
    body: 'Décerné au cofondateur qui a imaginé One League. Inattribuable à quiconque d’autre.',
  },
  godfather: {
    kind: 'unique',
    heading: 'Titre unique · nominatif',
    body: 'Titre honorifique attribué à une seule personne. Impossible à débloquer.',
  },
  champion: {
    kind: 'obtainable',
    heading: 'Titre obtenable',
    body: 'Remporte le classement d’une saison pour décrocher le titre de Champion.',
  },
  'vainqueur de tournoi': {
    kind: 'obtainable',
    heading: 'Titre obtenable',
    body: 'Gagne un tournoi, toutes disciplines confondues, et il est à toi.',
  },
  mysterious: {
    kind: 'mysterious',
    heading: 'Titre mystérieux',
    body: 'Personne ne sait vraiment d’où il vient… ni comment on le décroche. 🌈',
  },
};

const FALLBACK: TitleMeta = {
  kind: 'cosmetic',
  heading: 'Titre cosmétique',
  body: 'À débloquer en jeu ou à dénicher en boutique.',
};

/** Métadonnées d'obtention d'un titre par son libellé affiché. */
export function titleMeta(label: string | null | undefined): TitleMeta | null {
  if (!label) return null;
  return TITLE_META[norm(label)] ?? FALLBACK;
}
