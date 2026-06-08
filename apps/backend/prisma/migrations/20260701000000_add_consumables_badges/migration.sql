-- Consommables (anti-ops, multiplicateur d'ELO), badges « libres » GOD et
-- bouclier anti-ops.

-- User : flag « multiplicateur d'ELO armé » — le prochain score validé par ce
-- joueur double son gain/perte d'ELO, puis le flag retombe.
ALTER TABLE "users" ADD COLUMN "elo_mult_armed" BOOLEAN NOT NULL DEFAULT false;

-- Ops : date d'annulation par un consommable « anti-ops » (sert de bouclier :
-- le chasseur ne peut pas re-cibler cette cible pendant ANTI_OPS_SHIELD_MS).
ALTER TABLE "ops" ADD COLUMN "cancelled_by_anti_ops_at" TIMESTAMP(3);

-- UserBadge : métadonnées d'affichage des badges « libres » attribués depuis le
-- /GOD (code hors catalogue front).
ALTER TABLE "user_badges" ADD COLUMN "label" TEXT;
ALTER TABLE "user_badges" ADD COLUMN "icon" TEXT;
ALTER TABLE "user_badges" ADD COLUMN "color" TEXT;

-- Inventaire de consommables : empilable (quantity), avec cooldown d'usage.
CREATE TABLE "consumable_inventory" (
    "user_login" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "consumable_inventory_pkey" PRIMARY KEY ("user_login","kind")
);

CREATE INDEX "consumable_inventory_user_login_idx" ON "consumable_inventory"("user_login");

ALTER TABLE "consumable_inventory" ADD CONSTRAINT "consumable_inventory_user_login_fkey"
    FOREIGN KEY ("user_login") REFERENCES "users"("login") ON DELETE CASCADE ON UPDATE CASCADE;

-- Compteur d'achats mensuels par type de consommable (cap mensuel).
CREATE TABLE "consumable_monthly" (
    "user_login" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "month_key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "consumable_monthly_pkey" PRIMARY KEY ("user_login","kind","month_key")
);

CREATE INDEX "consumable_monthly_user_login_idx" ON "consumable_monthly"("user_login");

ALTER TABLE "consumable_monthly" ADD CONSTRAINT "consumable_monthly_user_login_fkey"
    FOREIGN KEY ("user_login") REFERENCES "users"("login") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nouvelles actions d'audit pour la gestion GOD des consommables & badges.
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'GRANT_CONSUMABLE';
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'FORCE_CONSUMABLE';
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'GRANT_BADGE';
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'REMOVE_BADGE';
