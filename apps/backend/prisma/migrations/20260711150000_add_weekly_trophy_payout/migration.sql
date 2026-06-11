-- Revenus passifs hebdomadaires (podium des trophées). Table d'idempotence : une
-- ligne par semaine ISO effectivement payée, pour ne jamais créditer deux fois la
-- même semaine (redémarrages du process, ticks multiples du planificateur).
-- Run with: cd apps/backend && npx prisma migrate deploy
CREATE TABLE "weekly_trophy_payout" (
    "week_key" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "top1" TEXT,
    "top2" TEXT,
    "top3" TEXT,

    CONSTRAINT "weekly_trophy_payout_pkey" PRIMARY KEY ("week_key")
);
