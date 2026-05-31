-- CreateTable: badges gagnés par les joueurs (les badges par défaut admin/superadmin
-- sont dérivés du rôle, pas stockés)
CREATE TABLE "user_badges" (
  "id" TEXT NOT NULL,
  "user_login" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "season_id" TEXT,
  "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_badges_user_login_code_key" ON "user_badges"("user_login", "code");
CREATE INDEX "user_badges_user_login_idx" ON "user_badges"("user_login");

ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_login_fkey"
  FOREIGN KEY ("user_login") REFERENCES "users"("login") ON DELETE CASCADE ON UPDATE CASCADE;
