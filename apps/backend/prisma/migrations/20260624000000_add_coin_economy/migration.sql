-- ─── Économie de coins : quêtes hebdomadaires + paris ────────────────────────

-- Progression des quêtes hebdo : une ligne par (joueur, semaine ISO). Compteurs
-- accumulés au règlement des matchs classés ; `claimed` = quêtes déjà réclamées.
CREATE TABLE "weekly_quest_progress" (
  "login"          TEXT         NOT NULL,
  "week_key"       TEXT         NOT NULL,
  "matches_played" INTEGER      NOT NULL DEFAULT 0,
  "wins"           INTEGER      NOT NULL DEFAULT 0,
  "games_played"   TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "claimed"        TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "weekly_quest_progress_pkey" PRIMARY KEY ("login", "week_key")
);

CREATE INDEX "weekly_quest_progress_login_idx" ON "weekly_quest_progress"("login");

ALTER TABLE "weekly_quest_progress"
  ADD CONSTRAINT "weekly_quest_progress_login_fkey"
    FOREIGN KEY ("login") REFERENCES "users"("login")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Paris à cote fixe ×2. La mise est débitée à la prise ; un pari gagnant crédite
-- 2× la mise au règlement. Cible = vainqueur d'un tournoi ou d'un match de bracket.
CREATE TABLE "bets" (
  "id"            TEXT         NOT NULL,
  "bettor_login"  TEXT         NOT NULL,
  "target_type"   TEXT         NOT NULL, -- 'tournament' | 'match'
  "tournament_id" TEXT         NOT NULL,
  "match_id"      TEXT,
  "choice_login"  TEXT         NOT NULL,
  "stake"         INTEGER      NOT NULL,
  "status"        TEXT         NOT NULL DEFAULT 'open', -- 'open' | 'won' | 'lost' | 'refunded'
  "payout"        INTEGER      NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settled_at"    TIMESTAMP(3),

  CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bets_bettor_login_idx" ON "bets"("bettor_login");
CREATE INDEX "bets_tournament_id_status_idx" ON "bets"("tournament_id", "status");
CREATE INDEX "bets_match_id_status_idx" ON "bets"("match_id", "status");

ALTER TABLE "bets"
  ADD CONSTRAINT "bets_bettor_login_fkey"
    FOREIGN KEY ("bettor_login") REFERENCES "users"("login")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bets"
  ADD CONSTRAINT "bets_tournament_id_fkey"
    FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
