-- Lien optionnel vers l'entité concernée (pendingMatch / playedMatch / challenge)
-- afin de marquer la notif cloche « lue » automatiquement quand l'action est
-- traitée (score validé / contesté…). Sert aussi à faire remonter les matchs
-- (score à valider, résultat, contestation) dans la cloche.
ALTER TABLE "notifications" ADD COLUMN "ref_id" TEXT;

CREATE INDEX "notifications_recipient_login_ref_id_idx" ON "notifications"("recipient_login", "ref_id");
