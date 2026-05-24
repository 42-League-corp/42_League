-- CreateTable
CREATE TABLE "challenges" (
    "id" TEXT NOT NULL,
    "challenger_login" TEXT NOT NULL,
    "opponent_login" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "challenges_opponent_login_status_idx" ON "challenges"("opponent_login", "status");

-- CreateIndex
CREATE INDEX "challenges_challenger_login_status_idx" ON "challenges"("challenger_login", "status");

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_challenger_login_fkey" FOREIGN KEY ("challenger_login") REFERENCES "users"("login") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_opponent_login_fkey" FOREIGN KEY ("opponent_login") REFERENCES "users"("login") ON DELETE RESTRICT ON UPDATE CASCADE;
