-- Mini-OPS : cooldown d'ACHAT (1 achat toutes les 48 h). On trace la date du dernier
-- achat soumis à cooldown par (joueur, type de consommable) pour borner le rythme
-- d'acquisition indépendamment du cap mensuel. Nullable : aucun impact sur les
-- consommables existants (anti_ops / elo_mult / force_duel n'ont pas de cooldown
-- d'achat).
-- Run with: cd apps/backend && npx prisma migrate deploy
ALTER TABLE "consumable_inventory" ADD COLUMN "last_bought_at" TIMESTAMP(3);
