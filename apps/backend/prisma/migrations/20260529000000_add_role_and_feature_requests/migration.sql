-- Migration: add Role enum, user.role, and feature_requests table
-- Run with: cd apps/backend && npx prisma migrate deploy
-- Or (dev): cd apps/backend && npx prisma migrate dev --name add_role_and_feature_requests

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');

-- AlterTable: add role column with safe default
ALTER TABLE "users" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "feature_requests" (
    "id"         TEXT         NOT NULL,
    "text"       TEXT         NOT NULL,
    "status"     TEXT         NOT NULL DEFAULT 'pending',
    "author_id"  TEXT         NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "feature_requests"
    ADD CONSTRAINT "feature_requests_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("login")
    ON DELETE RESTRICT ON UPDATE CASCADE;
