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
export type RankTierKey = 'etain' | 'bronze' | 'argent' | 'or' | 'diamant';

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

const ETAIN: RankTier = { key: 'etain', label: 'Étain', min: 0, floor: 900, color: '#9aa4ad' };

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
 * Plancher du palier dans lequel se trouve l'ELO (cible de reset).
 *   rankFloor(1500) === 1400
 *   rankFloor(1350) === 1200
 *   rankFloor(1050) === 1000
 *   rankFloor(950)  === 900
 */
export function rankFloor(elo: number): number {
  return rankTier(elo).floor;
}
