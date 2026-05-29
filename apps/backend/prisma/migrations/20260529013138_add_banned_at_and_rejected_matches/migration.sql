-- AlterTable
ALTER TABLE "users" ADD COLUMN     "banned_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "rejected_matches" (
    "id" TEXT NOT NULL,
    "declarer_login" TEXT NOT NULL,
    "opponent_login" TEXT NOT NULL,
    "score_declarer" INTEGER NOT NULL,
    "score_opponent" INTEGER NOT NULL,
    "contest_reason" TEXT NOT NULL,
    "contest_message" TEXT NOT NULL,
    "rejected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rejected_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rejected_matches_declarer_login_idx" ON "rejected_matches"("declarer_login");

-- CreateIndex
CREATE INDEX "rejected_matches_opponent_login_idx" ON "rejected_matches"("opponent_login");

-- AddForeignKey
ALTER TABLE "rejected_matches" ADD CONSTRAINT "rejected_matches_declarer_login_fkey" FOREIGN KEY ("declarer_login") REFERENCES "users"("login") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rejected_matches" ADD CONSTRAINT "rejected_matches_opponent_login_fkey" FOREIGN KEY ("opponent_login") REFERENCES "users"("login") ON DELETE RESTRICT ON UPDATE CASCADE;
