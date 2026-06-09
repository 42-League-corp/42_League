-- Reset admin du cooldown d'ops (POST /admin/ops/:login/reset-cooldown).
-- `ops_cooldown_reset_at` : quand renseigné, tout ops dont expires_at <= cette date
-- est ignoré pour le calcul du cooldown → le joueur peut re-déclarer un ops.
ALTER TABLE "users" ADD COLUMN "ops_cooldown_reset_at" TIMESTAMP(3);
