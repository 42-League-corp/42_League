-- Phase de ligue : nombre d'équipes qualifiées pour la phase finale (persistant,
-- modifiable au fil du tournoi, nombre libre ≥ 2). NULL = défaut dérivé côté UI.
ALTER TABLE "tournaments" ADD COLUMN "league_qualify_count" INTEGER;
