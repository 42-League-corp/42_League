-- Migration: add bug_reports table (boîte à tickets — report de bugs)
-- Run with: cd apps/backend && npx prisma migrate deploy
-- Or (dev): cd apps/backend && npx prisma migrate dev --name add_bug_reports

-- CreateTable
CREATE TABLE "bug_reports" (
    "id"         TEXT         NOT NULL,
    "text"       TEXT         NOT NULL,
    "status"     TEXT         NOT NULL DEFAULT 'open',
    "author_id"  TEXT         NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bug_reports"
    ADD CONSTRAINT "bug_reports_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("login")
    ON DELETE RESTRICT ON UPDATE CASCADE;
