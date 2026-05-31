-- Mode Smash Bros : classement parallèle + champs de match spécifiques.

-- Rating / compteurs Smash sur l'utilisateur.
ALTER TABLE "users" ADD COLUMN "elo_smash" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "users" ADD COLUMN "matches_played_smash" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "tournaments_won_smash" INTEGER NOT NULL DEFAULT 0;

-- Jeu sur les défis.
ALTER TABLE "challenges" ADD COLUMN "game" TEXT NOT NULL DEFAULT 'babyfoot';

-- Matchs en attente : jeu + détails smash.
ALTER TABLE "pending_matches" ADD COLUMN "game" TEXT NOT NULL DEFAULT 'babyfoot';
ALTER TABLE "pending_matches" ADD COLUMN "best_of" INTEGER;
ALTER TABLE "pending_matches" ADD COLUMN "char_declarer" TEXT;
ALTER TABLE "pending_matches" ADD COLUMN "char_opponent" TEXT;
ALTER TABLE "pending_matches" ADD COLUMN "stocks" INTEGER;

-- Matchs joués : jeu + détails smash.
ALTER TABLE "played_matches" ADD COLUMN "game" TEXT NOT NULL DEFAULT 'babyfoot';
ALTER TABLE "played_matches" ADD COLUMN "best_of" INTEGER;
ALTER TABLE "played_matches" ADD COLUMN "char_a" TEXT;
ALTER TABLE "played_matches" ADD COLUMN "char_b" TEXT;
ALTER TABLE "played_matches" ADD COLUMN "stocks_a" INTEGER;
ALTER TABLE "played_matches" ADD COLUMN "stocks_b" INTEGER;
