-- ─── Pile-ou-face d'avant-duel de tournoi ────────────────────────────────────
-- Désigne (résultat partagé) qui choisit son avantage avant un match de bracket.

ALTER TABLE "tournament_matches" ADD COLUMN "toss_winner_login" TEXT;
ALTER TABLE "tournament_matches" ADD COLUMN "toss_side" TEXT;
ALTER TABLE "tournament_matches" ADD COLUMN "advantage_pick" TEXT;
ALTER TABLE "tournament_matches" ADD COLUMN "toss_at" TIMESTAMP(3);
