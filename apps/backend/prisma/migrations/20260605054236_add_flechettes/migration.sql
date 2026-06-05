-- DropForeignKey
ALTER TABLE "matchmaking_queue" DROP CONSTRAINT "matchmaking_queue_login_fkey";

-- DropForeignKey
ALTER TABLE "pending_matches" DROP CONSTRAINT "pending_matches_partner_1_login_fkey";

-- DropForeignKey
ALTER TABLE "pending_matches" DROP CONSTRAINT "pending_matches_partner_2_login_fkey";

-- DropForeignKey
ALTER TABLE "played_matches" DROP CONSTRAINT "played_matches_player_a2_login_fkey";

-- DropForeignKey
ALTER TABLE "played_matches" DROP CONSTRAINT "played_matches_player_b2_login_fkey";

-- DropIndex
DROP INDEX "matchmaking_queue_game_joined_at_idx";

-- AlterTable
ALTER TABLE "pending_ffa_participants" ADD COLUMN     "remaining" INTEGER;

-- AlterTable
ALTER TABLE "pending_ffas" ADD COLUMN     "start_score" INTEGER;

-- AlterTable
ALTER TABLE "played_ffa_participants" ADD COLUMN     "remaining" INTEGER;

-- AlterTable
ALTER TABLE "played_ffas" ADD COLUMN     "start_score" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "elo_flechettes" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "matches_played_flechettes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tournaments_won_flechettes" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "pending_matches" ADD CONSTRAINT "pending_matches_partner_1_login_fkey" FOREIGN KEY ("partner_1_login") REFERENCES "users"("login") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_matches" ADD CONSTRAINT "pending_matches_partner_2_login_fkey" FOREIGN KEY ("partner_2_login") REFERENCES "users"("login") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "played_matches" ADD CONSTRAINT "played_matches_player_a2_login_fkey" FOREIGN KEY ("player_a2_login") REFERENCES "users"("login") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "played_matches" ADD CONSTRAINT "played_matches_player_b2_login_fkey" FOREIGN KEY ("player_b2_login") REFERENCES "users"("login") ON DELETE SET NULL ON UPDATE CASCADE;
