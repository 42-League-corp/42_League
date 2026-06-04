-- Migration: file de matchmaking PAR MODE de jeu.
-- Avant : une seule entrée par joueur (PK = login) → un seul « match aléatoire »
-- à la fois. Après : PK composite (login, game) → un joueur peut chercher en
-- babyfoot ET smash ET sf… simultanément, chaque recherche étant indépendante.
-- Run with: cd apps/backend && npx prisma migrate deploy
-- Or (dev):  cd apps/backend && npx prisma migrate dev --name matchmaking_queue_per_game

-- Bascule la clé primaire de (login) vers (login, game).
ALTER TABLE "matchmaking_queue" DROP CONSTRAINT "matchmaking_queue_pkey";
ALTER TABLE "matchmaking_queue" ADD CONSTRAINT "matchmaking_queue_pkey" PRIMARY KEY ("login", "game");
