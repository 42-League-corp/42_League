-- CreateTable: centre de notifications in-app
CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "recipient_login" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "link" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_recipient_login_read_idx" ON "notifications"("recipient_login", "read");
CREATE INDEX "notifications_recipient_login_created_at_idx" ON "notifications"("recipient_login", "created_at");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_login_fkey"
  FOREIGN KEY ("recipient_login") REFERENCES "users"("login") ON DELETE CASCADE ON UPDATE CASCADE;
