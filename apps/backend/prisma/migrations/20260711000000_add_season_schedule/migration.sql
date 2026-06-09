-- Clôture programmée d'une saison : bascule auto vers la saison suivante.
ALTER TABLE "seasons" ADD COLUMN "scheduled_end_at" TIMESTAMP(3);
ALTER TABLE "seasons" ADD COLUMN "next_season_name" TEXT;
