-- Babyfoot 2v2 : Elo personnel + compteur de matchs distincts du 1v1.
ALTER TABLE "users" ADD COLUMN "elo_babyfoot_2v2" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "users" ADD COLUMN "matches_played_2v2" INTEGER NOT NULL DEFAULT 0;
