-- Refonte de la contestation : arbitrage + réputation + malus.
-- rejected_matches devient une file d'arbitrage (status/resolution) et porte la
-- discipline du match (pour le malus d'Elo). users gagne la « marque » de litiges
-- perdus (réputation + escalade du malus) et un cooldown de sanction.
-- Run with: cd apps/backend && npx prisma migrate deploy

ALTER TABLE "rejected_matches" ADD COLUMN "game" TEXT NOT NULL DEFAULT 'babyfoot';
ALTER TABLE "rejected_matches" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "rejected_matches" ADD COLUMN "resolution" TEXT;
ALTER TABLE "rejected_matches" ADD COLUMN "resolved_by" TEXT;
ALTER TABLE "rejected_matches" ADD COLUMN "resolved_at" TIMESTAMP(3);

-- Les contestations déjà historisées ne repartent pas en arbitrage.
UPDATE "rejected_matches" SET "status" = 'dismissed';

CREATE INDEX "rejected_matches_status_idx" ON "rejected_matches"("status");

ALTER TABLE "users" ADD COLUMN "disputes_lost" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "penalty_cooldown_until" TIMESTAMP(3);
