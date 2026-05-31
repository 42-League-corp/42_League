-- Tournoi : format (élimination directe ou poules) + métadonnées de phase de poule sur les matchs.
ALTER TABLE "tournaments" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'elimination';

ALTER TABLE "tournament_matches" ADD COLUMN "stage" TEXT NOT NULL DEFAULT 'bracket';
ALTER TABLE "tournament_matches" ADD COLUMN "pool_index" INTEGER;
