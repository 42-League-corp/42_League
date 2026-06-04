-- Migration: file d'attente de matchmaking (« match aléatoire »).
-- Une seule entrée par joueur ; on apparie les deux plus anciens d'une même
-- discipline puis on retire leurs entrées.
-- Run with: cd apps/backend && npx prisma migrate deploy
-- Or (dev):  cd apps/backend && npx prisma migrate dev --name add_matchmaking_queue

-- CreateTable
CREATE TABLE "matchmaking_queue" (
    "login"     TEXT         NOT NULL,
    "game"      TEXT         NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matchmaking_queue_pkey" PRIMARY KEY ("login")
);

-- Index pour retrouver vite le plus ancien joueur en attente d'une discipline.
CREATE INDEX "matchmaking_queue_game_joined_at_idx" ON "matchmaking_queue"("game", "joined_at");

-- AddForeignKey : nettoie l'entrée si le joueur est supprimé.
ALTER TABLE "matchmaking_queue"
    ADD CONSTRAINT "matchmaking_queue_login_fkey"
    FOREIGN KEY ("login") REFERENCES "users"("login")
    ON DELETE CASCADE ON UPDATE CASCADE;
