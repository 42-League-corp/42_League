-- Persos favoris (« mains ») par jeu de combat — ids des rosters front, ordonnés.
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "fav_sf" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "fav_smash" TEXT[] DEFAULT ARRAY[]::TEXT[];
