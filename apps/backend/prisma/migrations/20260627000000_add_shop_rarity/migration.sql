-- Boutique : rareté explicite des objets ('common' | 'rare' | 'epic' | 'legendary').
-- Pilote la couleur de la carte en vitrine. Null = rareté déduite du prix (objets antérieurs).
ALTER TABLE "shop_items" ADD COLUMN "rarity" TEXT;
