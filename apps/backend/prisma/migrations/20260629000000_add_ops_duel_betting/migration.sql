-- Paris sur les duels d'OPS.
-- La cible d'un pari peut désormais être un duel d'ops (target_type='ops',
-- ops_id renseigné, tournament_id NULL). Vainqueur du duel = qui gagne le plus
-- de matchs 1v1 entre le hunter et sa cible pendant la fenêtre de l'ops ;
-- égalité ou aucun match joué → remboursement des mises.

-- tournament_id devient optionnel (NULL pour un pari d'ops).
ALTER TABLE "bets" ALTER COLUMN "tournament_id" DROP NOT NULL;

-- Nouvelle cible : l'ops parié (NULL pour les paris tournoi/match).
ALTER TABLE "bets" ADD COLUMN "ops_id" TEXT;

-- FK vers l'ops : cascade pour que la suppression d'un ops emporte ses paris
-- (le remboursement des mises ouvertes est fait côté applicatif AVANT le delete).
ALTER TABLE "bets" ADD CONSTRAINT "bets_ops_id_fkey"
  FOREIGN KEY ("ops_id") REFERENCES "ops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "bets_ops_id_status_idx" ON "bets"("ops_id", "status");
