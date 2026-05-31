-- AlterTable: add deletion_scheduled_at to users
-- RGPD Art. 17 — suppression de compte avec période de grâce :
-- la suppression marque ce champ ; l'anonymisation définitive est différée
-- (job quotidien) après ACCOUNT_GRACE_DAYS jours, sauf reconnexion entre-temps.
ALTER TABLE "users" ADD COLUMN "deletion_scheduled_at" TIMESTAMP(3);
