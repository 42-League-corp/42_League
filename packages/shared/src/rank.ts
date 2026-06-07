/**
 * Paliers de classement (RANKED TIER) par ELO.
 *
 * Framework-free (TS pur, pas de React) : importable côté backend comme côté front.
 *
 * Échelle (croissante) :
 *   <1000        → Étain
 *   1000–1099    → Bronze
 *   1100–1199    → Argent
 *   1200–1399    → Or
 *   >=1400       → Diamant
 *
 * `floor` = seuil minimal du palier, utilisé comme cible de reset en fin de saison
 * (on ne repart pas de 1000 mais du plancher de son grade courant).
 */
export type RankTierKey = 'etain' | 'bronze' | 'argent' | 'or' | 'diamant' | 'grandmaster';

export interface RankTier {
  key: RankTierKey;
  /** Libellé français du palier. */
  label: string;
  /** ELO minimal (inclus) pour atteindre ce palier. */
  min: number;
  /** Plancher du palier = cible de reset (seuil minimal du grade). */
  floor: number;
  /** Couleur hex associée au palier (texte / bordure / fond léger). */
  color: string;
}

const ETAIN: RankTier = { key: 'etain', label: 'Étain', min: 0, floor: 900, color: '#787f87' };

/** Table des paliers, ordonnée par ELO croissant. */
export const RANK_TIERS: readonly RankTier[] = [
  ETAIN,
  { key: 'bronze', label: 'Bronze', min: 1000, floor: 1000, color: '#cd7f32' },
  { key: 'argent', label: 'Argent', min: 1100, floor: 1100, color: '#c0c0c0' },
  { key: 'or', label: 'Or', min: 1200, floor: 1200, color: '#ffc94a' },
  { key: 'diamant', label: 'Diamant', min: 1400, floor: 1400, color: '#5fd0e0' },
];

/**
 * Palier d'un ELO : le palier le plus élevé dont `min` <= elo.
 * Étain pour tout ELO < 1000.
 */
export function rankTier(elo: number): RankTier {
  let tier: RankTier = ETAIN;
  for (const t of RANK_TIERS) {
    if (elo >= t.min) tier = t;
    else break;
  }
  return tier;
}

/**
 * Grand Master : grade d'élite POSITIONNEL (et non un seuil ELO) attribué au
 * top {@link GRANDMASTER_TOP_N} de chaque classement (chaque discipline). Délibérément
 * HORS de {@link RANK_TIERS} pour ne pas perturber le barème ELO (frise, planchers,
 * reset de saison). `min` = Infinity : il n'est jamais atteint par l'ELO seul.
 */
export const GRANDMASTER_TOP_N = 5;

export const GRANDMASTER: RankTier = {
  key: 'grandmaster',
  label: 'Grand Master',
  min: Infinity,
  floor: 1400,
  color: '#c084fc',
};

/**
 * ELO minimal pour prétendre au Grand Master : il faut DÉJÀ être Diamant.
 * Le top {@link GRANDMASTER_TOP_N} ne suffit pas si l'on n'a pas atteint ce palier.
 */
export const GRANDMASTER_MIN_ELO =
  RANK_TIERS.find((t) => t.key === 'diamant')?.min ?? 1400;

/**
 * Palier d'un joueur en tenant compte de sa POSITION dans le classement de sa
 * discipline : top {@link GRANDMASTER_TOP_N} **ET** déjà Diamant
 * (ELO >= {@link GRANDMASTER_MIN_ELO}) → Grand Master, sinon palier ELO classique.
 *
 * @param elo  score ELO du joueur dans la discipline.
 * @param rank position (1 = 1er) ; null/0/absent = non classé → palier ELO seul.
 */
export function rankTierForRank(elo: number, rank?: number | null): RankTier {
  if (
    rank != null &&
    rank >= 1 &&
    rank <= GRANDMASTER_TOP_N &&
    elo >= GRANDMASTER_MIN_ELO
  )
    return GRANDMASTER;
  return rankTier(elo);
}

/**
 * Plancher du palier dans lequel se trouve l'ELO (cible de reset).
 *   rankFloor(1500) === 1400
 *   rankFloor(1350) === 1200
 *   rankFloor(1050) === 1000
 *   rankFloor(950)  === 900
 */
export function rankFloor(elo: number): number {
  return rankTier(elo).floor;
}

/** Plancher du palier Bronze (cible de reset des Étains). */
const BRONZE_FLOOR = RANK_TIERS.find((t) => t.key === 'bronze')?.floor ?? 1000;

/**
 * ELO cible après reset de fin de saison.
 *
 * Comme {@link rankFloor}, MAIS les Étains (< 1000) sont remontés au plancher
 * Bronze : personne ne reste coincé sous le Bronze entre deux saisons, on
 * repart au minimum au grade Bronze.
 *   seasonResetElo(1500) === 1400  (Diamant → plancher Diamant)
 *   seasonResetElo(1050) === 1000  (Bronze  → plancher Bronze)
 *   seasonResetElo(950)  === 1000  (Étain   → plancher Bronze)
 */
export function seasonResetElo(elo: number): number {
  return rankTier(elo).key === 'etain' ? BRONZE_FLOOR : rankFloor(elo);
}
