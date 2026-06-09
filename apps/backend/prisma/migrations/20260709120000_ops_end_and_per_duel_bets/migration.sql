-- Ops : fin RÉELLE de l'ops, posée quand les 3 défis forcés sont consommés
-- (avant les 24h). L'ops cesse alors d'être actif et le cooldown court de là.
ALTER TABLE "ops" ADD COLUMN "ended_at" TIMESTAMP(3);

-- Challenge : marque un défi comme « duel d'ops » forcé et le relie à son ops.
-- Sert à rendre chaque duel pariable individuellement et à régler ses paris.
ALTER TABLE "challenges" ADD COLUMN "ops_id" TEXT;
CREATE INDEX "challenges_ops_id_status_idx" ON "challenges"("ops_id", "status");
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_ops_id_fkey" FOREIGN KEY ("ops_id") REFERENCES "ops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PendingMatch : porte le défi d'ops d'origine jusqu'au règlement (au confirm,
-- on solde les paris du duel par le vainqueur du match).
ALTER TABLE "pending_matches" ADD COLUMN "challenge_id" TEXT;

-- Bet : pari sur un duel d'ops PRÉCIS (le Challenge forcé), et non plus sur l'ops
-- global. opsId reste renseigné (l'ops auquel le duel appartient).
ALTER TABLE "bets" ADD COLUMN "challenge_id" TEXT;
CREATE INDEX "bets_challenge_id_status_idx" ON "bets"("challenge_id", "status");
ALTER TABLE "bets" ADD CONSTRAINT "bets_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
