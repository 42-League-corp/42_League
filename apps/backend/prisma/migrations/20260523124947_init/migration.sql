-- CreateTable
CREATE TABLE "users" (
    "login" TEXT NOT NULL,
    "ft_id" INTEGER,
    "campus" TEXT,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("login")
);

-- CreateTable
CREATE TABLE "pending_matches" (
    "id" TEXT NOT NULL,
    "declarer_login" TEXT NOT NULL,
    "opponent_login" TEXT NOT NULL,
    "score_declarer" INTEGER NOT NULL,
    "score_opponent" INTEGER NOT NULL,
    "declared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "played_matches" (
    "id" TEXT NOT NULL,
    "player_a_login" TEXT NOT NULL,
    "player_b_login" TEXT NOT NULL,
    "score_a" INTEGER NOT NULL,
    "score_b" INTEGER NOT NULL,
    "winner" TEXT NOT NULL,
    "played_at" TIMESTAMP(3) NOT NULL,
    "counted_for_elo" BOOLEAN NOT NULL,
    "delta_a" INTEGER NOT NULL,
    "delta_b" INTEGER NOT NULL,

    CONSTRAINT "played_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_ft_id_key" ON "users"("ft_id");

-- CreateIndex
CREATE INDEX "pending_matches_opponent_login_idx" ON "pending_matches"("opponent_login");

-- CreateIndex
CREATE INDEX "played_matches_player_a_login_player_b_login_played_at_idx" ON "played_matches"("player_a_login", "player_b_login", "played_at");

-- AddForeignKey
ALTER TABLE "pending_matches" ADD CONSTRAINT "pending_matches_declarer_login_fkey" FOREIGN KEY ("declarer_login") REFERENCES "users"("login") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_matches" ADD CONSTRAINT "pending_matches_opponent_login_fkey" FOREIGN KEY ("opponent_login") REFERENCES "users"("login") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "played_matches" ADD CONSTRAINT "played_matches_player_a_login_fkey" FOREIGN KEY ("player_a_login") REFERENCES "users"("login") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "played_matches" ADD CONSTRAINT "played_matches_player_b_login_fkey" FOREIGN KEY ("player_b_login") REFERENCES "users"("login") ON DELETE RESTRICT ON UPDATE CASCADE;
