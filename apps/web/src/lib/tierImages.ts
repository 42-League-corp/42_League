import type { RankTierKey } from '@42-league/shared';

/**
 * Emblème (blason) de chaque palier RANKED. Fichiers dans `public/`, servis à la
 * racine. Source d'images unique pour {@link TierEmblem} & co. : ne référencer
 * les chemins QUE via cette table (pas de string en dur dans les composants).
 */
export const TIER_IMAGES: Record<RankTierKey, string> = {
  etain: '/etain.png',
  bronze: '/bronze.png',
  argent: '/argent.png',
  or: '/or.png',
  diamant: '/diamant.png',
  grandmaster: '/gm.png',
};

/** Chemin de l'emblème d'un palier (clé typée → jamais d'oubli de palier). */
export function tierImage(key: RankTierKey): string {
  return TIER_IMAGES[key];
}
