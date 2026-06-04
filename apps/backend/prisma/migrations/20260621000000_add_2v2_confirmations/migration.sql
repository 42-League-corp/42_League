-- Confirmations progressives 2v2 sur les pending_matches.
--
-- Le déclarant est considéré auto-validé (il a déclaré, donc il valide).
-- Les 3 autres joueurs (partner1, opp1, opp2) doivent chacun confirmer.
-- Settlement uniquement quand les 3 champs sont à TRUE.
--
-- NULL = match 1v1 (champs non applicables).
-- FALSE (défaut) = en attente de confirmation.
-- TRUE = confirmé.

ALTER TABLE "pending_matches"
  ADD COLUMN "partner_1_confirmed" BOOLEAN DEFAULT FALSE,
  ADD COLUMN "opp_1_confirmed"     BOOLEAN DEFAULT FALSE,
  ADD COLUMN "opp_2_confirmed"     BOOLEAN DEFAULT FALSE;
