-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'info',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_login" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_seen" (
    "announcement_id" TEXT NOT NULL,
    "user_login" TEXT NOT NULL,
    "seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_seen_pkey" PRIMARY KEY ("announcement_id","user_login")
);

-- CreateIndex
CREATE INDEX "announcements_active_created_at_idx" ON "announcements"("active", "created_at");

-- CreateIndex
CREATE INDEX "announcement_seen_user_login_idx" ON "announcement_seen"("user_login");

-- AddForeignKey
ALTER TABLE "announcement_seen" ADD CONSTRAINT "announcement_seen_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_seen" ADD CONSTRAINT "announcement_seen_user_login_fkey" FOREIGN KEY ("user_login") REFERENCES "users"("login") ON DELETE CASCADE ON UPDATE CASCADE;
