-- 4e discipline : Street Fighter (classement parallèle, mécaniquement identique au Smash).
ALTER TABLE "users" ADD COLUMN "elo_sf" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "users" ADD COLUMN "matches_played_sf" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "tournaments_won_sf" INTEGER NOT NULL DEFAULT 0;
