// ─────────────────────────────────────────────────────────────────────────────
// Rareté des objets de boutique — source unique de vérité, partagée entre la
// vitrine (ShopPage) et le créateur admin (Shop GOD / CosmeticForm).
//
// La rareté est désormais un champ EXPLICITE de l'objet (choisi dans Shop GOD).
// Pour les anciens objets sans rareté en base, on retombe sur une déduction par
// le prix (`rarityOf`) afin de garder un rendu cohérent.
// ─────────────────────────────────────────────────────────────────────────────

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Ordre croissant de prestige — pour les sélecteurs et l'affichage. */
export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface RarityStyle {
  hex: string;
  /** Dégradé de la bordure (effet liseré premium). */
  border: string;
  /** Libellé français (Shop GOD est mono-langue). */
  label: string;
}

export const RARITY: Record<Rarity, RarityStyle> = {
  common: { hex: '#9fb2c7', border: 'rgba(159,178,199,0.55)', label: 'Commun' },
  rare: { hex: '#4aa8ff', border: 'rgba(74,168,255,0.65)', label: 'Rare' },
  epic: { hex: '#b07bff', border: 'rgba(176,123,255,0.7)', label: 'Épique' },
  legendary: { hex: '#ffc94a', border: 'rgba(255,201,74,0.85)', label: 'Légendaire' },
};

/** Rareté déduite du prix — repli pour les objets sans rareté explicite. */
export function rarityOf(price: number): Rarity {
  if (price >= 900) return 'legendary';
  if (price >= 400) return 'epic';
  if (price >= 150) return 'rare';
  return 'common';
}

/** Rareté effective d'un objet : champ explicite si présent, sinon déduite du prix. */
export function resolveRarity(item: { rarity?: Rarity | null; price: number }): Rarity {
  return item.rarity ?? rarityOf(item.price);
}
