-- Match « en cours » désigné par l'organisateur (bouton « match suivant ») :
-- déclenche l'écran VERSUS chez les spectateurs et met le duel en avant dans
-- l'arbre. Effacé à la confirmation du match. Sans objet pour les échecs.
ALTER TABLE "tournaments" ADD COLUMN "active_match_id" TEXT;
