-- Annulation à l'amiable d'un défi accepté (sans perte d'ELO si l'autre camp accepte).
ALTER TABLE "challenges" ADD COLUMN "cancel_request_by" TEXT;
ALTER TABLE "challenges" ADD COLUMN "cancel_request_at" TIMESTAMP(3);
ALTER TABLE "challenges" ADD COLUMN "cancel_accepted_by" TEXT;
