-- « ELO ×2 » (kind 'elo_mult') : passage d'un armement « prochain match » à une
-- fenêtre de boost de 6h. `elo_mult_until` = fin de fenêtre (gain ET perte ×2 tant
-- qu'elle est ouverte) ; `elo_mult_week_key` = semaine ISO de la dernière
-- activation (limite : 1 par semaine).
ALTER TABLE "users" DROP COLUMN "elo_mult_armed";
ALTER TABLE "users" ADD COLUMN "elo_mult_until" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "elo_mult_week_key" TEXT;
