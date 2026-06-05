-- ─── Verrou de paris des matchs de tournoi ───────────────────────────────────
-- Posé au PREMIER score saisi, jamais remis à null : empêche la réouverture du
-- marché de paris (et la fuite d'information sur le score) après un reject.

ALTER TABLE "tournament_matches" ADD COLUMN "bets_locked_at" TIMESTAMP(3);
