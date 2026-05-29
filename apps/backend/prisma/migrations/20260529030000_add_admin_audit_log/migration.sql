-- CreateEnum
CREATE TYPE "AdminAction" AS ENUM ('SET_ROLE', 'BAN_USER', 'UNBAN_USER', 'EDIT_STATS', 'EDIT_TITLE', 'DELETE_MATCH', 'EDIT_MATCH', 'REFRESH_IMAGES');

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" TEXT NOT NULL,
    "actor_login" TEXT NOT NULL,
    "actor_role" "Role" NOT NULL,
    "action" "AdminAction" NOT NULL,
    "target_login" TEXT,
    "payload" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_audit_log_actor_login_idx" ON "admin_audit_log"("actor_login");

-- CreateIndex
CREATE INDEX "admin_audit_log_target_login_idx" ON "admin_audit_log"("target_login");
