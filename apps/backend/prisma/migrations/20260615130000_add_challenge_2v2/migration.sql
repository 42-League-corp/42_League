-- Défis 2v2 Babyfoot : colonnes nullables (les défis 1v1 existants restent NULL).
ALTER TABLE "challenges" ADD COLUMN "mode" TEXT;
ALTER TABLE "challenges" ADD COLUMN "partner_login" TEXT;
ALTER TABLE "challenges" ADD COLUMN "opponent_partner_login" TEXT;
ALTER TABLE "challenges" ADD COLUMN "opponent_accepted_at" TIMESTAMP(3);
ALTER TABLE "challenges" ADD COLUMN "opponent_partner_accepted_at" TIMESTAMP(3);
