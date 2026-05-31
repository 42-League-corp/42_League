-- CreateTable: relations de suivi (followers/following) + préférences de notif
CREATE TABLE "follows" (
  "id" TEXT NOT NULL,
  "follower_login" TEXT NOT NULL,
  "followee_login" TEXT NOT NULL,
  "notify_tournament" BOOLEAN NOT NULL DEFAULT true,
  "notify_top3" BOOLEAN NOT NULL DEFAULT true,
  "notify_trophy" BOOLEAN NOT NULL DEFAULT true,
  "notify_ops" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "follows_follower_login_followee_login_key" ON "follows"("follower_login", "followee_login");
CREATE INDEX "follows_followee_login_idx" ON "follows"("followee_login");

ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_login_fkey"
  FOREIGN KEY ("follower_login") REFERENCES "users"("login") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_login_fkey"
  FOREIGN KEY ("followee_login") REFERENCES "users"("login") ON DELETE CASCADE ON UPDATE CASCADE;
