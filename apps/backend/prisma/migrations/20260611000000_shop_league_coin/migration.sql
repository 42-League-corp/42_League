-- ─── Boutique « League Coin » : porte-monnaie + catalogue + inventaire ─────────

-- Porte-monnaie « League Coin » sur chaque joueur (solde dépensable en boutique).
ALTER TABLE "users" ADD COLUMN "league_coins" INTEGER NOT NULL DEFAULT 0;

-- ── Catalogue d'objets cosmétiques (titres, bannières…) ─────────────────────
CREATE TABLE "shop_items" (
  "id"          TEXT         NOT NULL,
  "slug"        TEXT         NOT NULL,
  "name"        TEXT         NOT NULL,
  "description" TEXT,
  "category"    TEXT         NOT NULL, -- 'title' | 'banner' | 'cosmetic'
  "price"       INTEGER      NOT NULL, -- en League Coins
  "payload"     JSONB,
  "active"      BOOLEAN      NOT NULL DEFAULT true,
  "sort_order"  INTEGER      NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shop_items_slug_key" ON "shop_items"("slug");

-- ── Inventaire : objets possédés par un joueur (+ état équipé) ───────────────
CREATE TABLE "shop_inventory" (
  "user_login"  TEXT         NOT NULL,
  "item_id"     TEXT         NOT NULL,
  "equipped"    BOOLEAN      NOT NULL DEFAULT false,
  "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shop_inventory_pkey" PRIMARY KEY ("user_login", "item_id")
);

CREATE INDEX "shop_inventory_user_login_idx" ON "shop_inventory"("user_login");

-- Clés étrangères (cascade : la suppression d'un joueur ou d'un objet purge l'inventaire).
ALTER TABLE "shop_inventory"
  ADD CONSTRAINT "shop_inventory_user_login_fkey"
    FOREIGN KEY ("user_login") REFERENCES "users"("login")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shop_inventory"
  ADD CONSTRAINT "shop_inventory_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "shop_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
