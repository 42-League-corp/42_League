-- CreateTable
CREATE TABLE "ops" (
    "id" TEXT NOT NULL,
    "owner_login" TEXT NOT NULL,
    "target_login" TEXT NOT NULL,
    "declared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ops_owner_login_expires_at_idx" ON "ops"("owner_login", "expires_at");

-- CreateIndex
CREATE INDEX "ops_target_login_expires_at_idx" ON "ops"("target_login", "expires_at");

-- AddForeignKey
ALTER TABLE "ops" ADD CONSTRAINT "ops_owner_login_fkey" FOREIGN KEY ("owner_login") REFERENCES "users"("login") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops" ADD CONSTRAINT "ops_target_login_fkey" FOREIGN KEY ("target_login") REFERENCES "users"("login") ON DELETE RESTRICT ON UPDATE CASCADE;
