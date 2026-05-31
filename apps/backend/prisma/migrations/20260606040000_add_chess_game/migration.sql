-- 3e discipline : Échecs (classement parallèle).
ALTER TABLE "users" ADD COLUMN "elo_chess" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "users" ADD COLUMN "matches_played_chess" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "tournaments_won_chess" INTEGER NOT NULL DEFAULT 0;
