-- Récompense de tournoi officiel : coins OU cosmétique (existant, ou créé inline
-- en active:false → masqué de la boutique). Versée au vainqueur au settlement.
ALTER TABLE "tournaments" ADD COLUMN "prize_kind" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "tournaments" ADD COLUMN "prize_coins" INTEGER;
ALTER TABLE "tournaments" ADD COLUMN "prize_item_id" TEXT;

ALTER TABLE "tournaments"
  ADD CONSTRAINT "tournaments_prize_item_id_fkey"
  FOREIGN KEY ("prize_item_id") REFERENCES "shop_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
