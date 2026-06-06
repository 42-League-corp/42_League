-- Tournois 2v2 (babyfoot doubles) + économie des paris/cash-prize.
-- mode : '1v1' | '2v2'. En 2v2, chaque entrée est une paire représentée par son
-- login « capitaine » ; le coéquipier est stocké dans partner_login.
ALTER TABLE "tournaments" ADD COLUMN "mode" TEXT NOT NULL DEFAULT '1v1';
-- Multiplicateur final d'un pari sur le vainqueur (amicaux 2 ; officiels réglables 2..10).
ALTER TABLE "tournaments" ADD COLUMN "bet_final_mult" INTEGER NOT NULL DEFAULT 2;
-- Cash-prize (coins) du champion pour les officiels ; paliers dérivés au prorata du tour atteint.
ALTER TABLE "tournaments" ADD COLUMN "cash_prize_base" INTEGER;
-- 2v2 : coéquipier du capitaine d'une entrée.
ALTER TABLE "tournament_entries" ADD COLUMN "partner_login" TEXT;
