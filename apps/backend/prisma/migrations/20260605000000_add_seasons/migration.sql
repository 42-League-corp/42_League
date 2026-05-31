-- CreateTable: saisons + snapshot des classements + lien match→saison
CREATE TABLE "seasons" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "season_standings" (
  "id" TEXT NOT NULL,
  "season_id" TEXT NOT NULL,
  "login" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "elo" INTEGER NOT NULL,
  "wins" INTEGER NOT NULL,
  "losses" INTEGER NOT NULL,
  CONSTRAINT "season_standings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "season_standings_season_id_idx" ON "season_standings"("season_id");
CREATE INDEX "season_standings_login_idx" ON "season_standings"("login");

ALTER TABLE "played_matches" ADD COLUMN "season_id" TEXT;
CREATE INDEX "played_matches_season_id_idx" ON "played_matches"("season_id");

-- Seed : saison Bêta active + rattachement de tout l'historique existant.
INSERT INTO "seasons" ("id", "name", "is_active", "started_at")
  VALUES ('00000000-0000-0000-0000-0000000be7a0', 'Saison Bêta', true, CURRENT_TIMESTAMP);
UPDATE "played_matches" SET "season_id" = '00000000-0000-0000-0000-0000000be7a0' WHERE "season_id" IS NULL;

-- Badge beta-tester pour tous les inscrits actuels, SAUF les superadmins.
INSERT INTO "user_badges" ("id", "user_login", "code", "season_id", "awarded_at")
  SELECT gen_random_uuid()::text, "login", 'beta_tester', '00000000-0000-0000-0000-0000000be7a0', CURRENT_TIMESTAMP
  FROM "users" WHERE "role" <> 'SUPERADMIN'
  ON CONFLICT ("user_login", "code") DO NOTHING;
