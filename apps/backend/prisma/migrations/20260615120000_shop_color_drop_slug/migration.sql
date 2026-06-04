-- Boutique : suppression du `slug` (jamais utilisé fonctionnellement) + ajout d'une
-- couleur d'accent (titres & badges, choisie dans le créateur Shop GOD).
ALTER TABLE "shop_items" DROP COLUMN "slug";
ALTER TABLE "shop_items" ADD COLUMN "color" TEXT;
