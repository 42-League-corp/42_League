-- CreateTable
CREATE TABLE "pending_ffas" (
    "id" TEXT NOT NULL,
    "declarer_login" TEXT NOT NULL,
    "game" TEXT NOT NULL DEFAULT 'smash',
    "declared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_ffas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_ffa_participants" (
    "id" TEXT NOT NULL,
    "pending_id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pending_ffa_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "played_ffas" (
    "id" TEXT NOT NULL,
    "game" TEXT NOT NULL DEFAULT 'smash',
    "played_at" TIMESTAMP(3) NOT NULL,
    "season_id" TEXT,
    "counted_for_elo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "played_ffas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "played_ffa_participants" (
    "id" TEXT NOT NULL,
    "played_id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "rating_before" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "rating_after" INTEGER NOT NULL,

    CONSTRAINT "played_ffa_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_ffas_declarer_login_idx" ON "pending_ffas"("declarer_login");

-- CreateIndex
CREATE INDEX "pending_ffa_participants_login_idx" ON "pending_ffa_participants"("login");

-- CreateIndex
CREATE UNIQUE INDEX "pending_ffa_participants_pending_id_login_key" ON "pending_ffa_participants"("pending_id", "login");

-- CreateIndex
CREATE UNIQUE INDEX "pending_ffa_participants_pending_id_position_key" ON "pending_ffa_participants"("pending_id", "position");

-- CreateIndex
CREATE INDEX "played_ffas_season_id_idx" ON "played_ffas"("season_id");

-- CreateIndex
CREATE INDEX "played_ffas_played_at_idx" ON "played_ffas"("played_at");

-- CreateIndex
CREATE INDEX "played_ffa_participants_login_idx" ON "played_ffa_participants"("login");

-- CreateIndex
CREATE UNIQUE INDEX "played_ffa_participants_played_id_login_key" ON "played_ffa_participants"("played_id", "login");

-- AddForeignKey
ALTER TABLE "pending_ffas" ADD CONSTRAINT "pending_ffas_declarer_login_fkey" FOREIGN KEY ("declarer_login") REFERENCES "users"("login") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_ffa_participants" ADD CONSTRAINT "pending_ffa_participants_pending_id_fkey" FOREIGN KEY ("pending_id") REFERENCES "pending_ffas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_ffa_participants" ADD CONSTRAINT "pending_ffa_participants_login_fkey" FOREIGN KEY ("login") REFERENCES "users"("login") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "played_ffa_participants" ADD CONSTRAINT "played_ffa_participants_played_id_fkey" FOREIGN KEY ("played_id") REFERENCES "played_ffas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "played_ffa_participants" ADD CONSTRAINT "played_ffa_participants_login_fkey" FOREIGN KEY ("login") REFERENCES "users"("login") ON DELETE RESTRICT ON UPDATE CASCADE;

