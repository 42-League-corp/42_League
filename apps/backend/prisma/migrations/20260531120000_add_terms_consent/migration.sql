-- AlterTable: add RGPD consent proof to users (CGU API 42, Art. 4.2)
-- terms_accepted_at = date d'acceptation de la politique de confidentialité
-- terms_version     = version acceptée (re-consentement si la politique change)
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "terms_version" TEXT;
