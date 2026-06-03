-- ─── Babyfoot 2v2 : table des duos + extension PlayedMatch + PendingMatch ────
--
-- Isolation : toutes ces colonnes sont NULL pour les matchs 1v1 et pour les
-- autres jeux (smash, chess). Le champ `mode` ('2v2' | NULL) est la sentinelle.

-- ── Table BabyfootTeam ───────────────────────────────────────────────────────
-- Représente un duo stable de joueurs en mode 2v2.
-- La paire (player_1_login, player_2_login) est TOUJOURS triée lexicographiquement
-- pour garantir l'unicité : (alice, bob) == (bob, alice).
CREATE TABLE "babyfoot_teams" (
  "id"             TEXT        NOT NULL,
  "player_1_login" TEXT        NOT NULL,
  "player_2_login" TEXT        NOT NULL,
  "elo"            INTEGER     NOT NULL DEFAULT 1000,
  "name"           TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "babyfoot_teams_pkey" PRIMARY KEY ("id")
);

-- Contrainte d'unicité métier : un seul enregistrement par paire de joueurs.
CREATE UNIQUE INDEX "babyfoot_teams_player_1_login_player_2_login_key"
  ON "babyfoot_teams"("player_1_login", "player_2_login");

-- Index pour les requêtes "donne-moi toutes les équipes de ce joueur".
CREATE INDEX "babyfoot_teams_player_1_login_idx" ON "babyfoot_teams"("player_1_login");
CREATE INDEX "babyfoot_teams_player_2_login_idx" ON "babyfoot_teams"("player_2_login");

-- Clés étrangères vers les joueurs.
ALTER TABLE "babyfoot_teams"
  ADD CONSTRAINT "babyfoot_teams_player_1_login_fkey"
    FOREIGN KEY ("player_1_login") REFERENCES "users"("login")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "babyfoot_teams_player_2_login_fkey"
    FOREIGN KEY ("player_2_login") REFERENCES "users"("login")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Extension de played_matches pour le mode 2v2 ────────────────────────────
-- Toutes les colonnes sont nullable : elles restent NULL pour les matchs 1v1
-- et pour tous les autres jeux.

ALTER TABLE "played_matches"
  ADD COLUMN "mode"           TEXT,        -- NULL | '2v2'
  ADD COLUMN "player_a2_login" TEXT,       -- coéquipier du joueur A
  ADD COLUMN "player_b2_login" TEXT,       -- coéquipier du joueur B
  ADD COLUMN "delta_a2"       INTEGER,     -- variation ELO individuel du coéquipier A
  ADD COLUMN "delta_b2"       INTEGER,     -- variation ELO individuel du coéquipier B
  ADD COLUMN "team_a_id"      TEXT,        -- entité BabyfootTeam côté A
  ADD COLUMN "team_b_id"      TEXT;        -- entité BabyfootTeam côté B

-- FK vers les coéquipiers (joueurs existants).
ALTER TABLE "played_matches"
  ADD CONSTRAINT "played_matches_player_a2_login_fkey"
    FOREIGN KEY ("player_a2_login") REFERENCES "users"("login")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "played_matches_player_b2_login_fkey"
    FOREIGN KEY ("player_b2_login") REFERENCES "users"("login")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK vers les entités BabyfootTeam (SET NULL si un duo est supprimé).
ALTER TABLE "played_matches"
  ADD CONSTRAINT "played_matches_team_a_id_fkey"
    FOREIGN KEY ("team_a_id") REFERENCES "babyfoot_teams"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "played_matches_team_b_id_fkey"
    FOREIGN KEY ("team_b_id") REFERENCES "babyfoot_teams"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Extension de pending_matches pour le mode 2v2 ───────────────────────────

ALTER TABLE "pending_matches"
  ADD COLUMN "mode"             TEXT,  -- NULL | '2v2'
  ADD COLUMN "partner_1_login"  TEXT,  -- coéquipier du déclarant
  ADD COLUMN "partner_2_login"  TEXT;  -- coéquipier de l'adversaire

ALTER TABLE "pending_matches"
  ADD CONSTRAINT "pending_matches_partner_1_login_fkey"
    FOREIGN KEY ("partner_1_login") REFERENCES "users"("login")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "pending_matches_partner_2_login_fkey"
    FOREIGN KEY ("partner_2_login") REFERENCES "users"("login")
    ON DELETE RESTRICT ON UPDATE CASCADE;
