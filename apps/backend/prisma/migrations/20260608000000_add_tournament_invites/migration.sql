-- CreateTable
CREATE TABLE "tournament_invites" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "inviter_login" TEXT NOT NULL,
    "invitee_login" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "tournament_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_invites_tournament_id_invitee_login_key" ON "tournament_invites"("tournament_id", "invitee_login");

-- CreateIndex
CREATE INDEX "tournament_invites_invitee_login_status_idx" ON "tournament_invites"("invitee_login", "status");

-- CreateIndex
CREATE INDEX "tournament_invites_tournament_id_idx" ON "tournament_invites"("tournament_id");

-- AddForeignKey
ALTER TABLE "tournament_invites" ADD CONSTRAINT "tournament_invites_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_invites" ADD CONSTRAINT "tournament_invites_inviter_login_fkey" FOREIGN KEY ("inviter_login") REFERENCES "users"("login") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_invites" ADD CONSTRAINT "tournament_invites_invitee_login_fkey" FOREIGN KEY ("invitee_login") REFERENCES "users"("login") ON DELETE CASCADE ON UPDATE CASCADE;
