-- Journal d'usage produit (pages vues + interactions) pour le tableau de bord GOD.
-- Distinct de "admin_audit_log" (actions admin) : ici on mesure l'usage réel de
-- l'app. Lié à users en cascade → la suppression RGPD d'un compte purge son journal.
CREATE TABLE "analytics_events" (
  "id"         TEXT         NOT NULL,
  "login"      TEXT         NOT NULL,
  "type"       TEXT         NOT NULL, -- 'pageview' | 'event'
  "name"       TEXT         NOT NULL, -- chemin de route (pageview) ou id d'action (event)
  "game"       TEXT,                  -- 'babyfoot' | 'smash' | ... | NULL (global)
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at" DESC);
CREATE INDEX "analytics_events_type_name_idx" ON "analytics_events"("type", "name");
CREATE INDEX "analytics_events_login_created_at_idx" ON "analytics_events"("login", "created_at");

ALTER TABLE "analytics_events"
  ADD CONSTRAINT "analytics_events_login_fkey"
    FOREIGN KEY ("login") REFERENCES "users"("login")
    ON DELETE CASCADE ON UPDATE CASCADE;
