-- Paris match « score exact » : pronostic optionnel du score final (obligatoire
-- pour un joueur qui parie sur son propre match). Score pile au règlement → ×4.
-- Run with: cd apps/backend && npx prisma migrate deploy

ALTER TABLE "bets" ADD COLUMN "predicted_score_a" INTEGER;
ALTER TABLE "bets" ADD COLUMN "predicted_score_b" INTEGER;
