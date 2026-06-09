-- Co-organisateurs d'un tournoi : logins ayant tous les droits d'organisation
-- (comme le créateur). + Nom d'équipe optionnel pour les duos (2v2).
-- Run with: cd apps/backend && npx prisma migrate deploy
ALTER TABLE "tournaments" ADD COLUMN "co_organizers" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "tournament_entries" ADD COLUMN "team_name" TEXT;
