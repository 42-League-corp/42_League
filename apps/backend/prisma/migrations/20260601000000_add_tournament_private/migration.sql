-- AlterTable: tournoi privé (sur invitation uniquement)
ALTER TABLE "tournaments" ADD COLUMN "is_private" BOOLEAN NOT NULL DEFAULT false;
