-- AlterTable: add anonymized_at to users (RGPD account deletion support)
ALTER TABLE "users" ADD COLUMN "anonymized_at" TIMESTAMP(3);
