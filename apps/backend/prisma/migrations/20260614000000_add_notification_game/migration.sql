-- Jeu d'origine d'une notification : pilote la couleur de fond + l'emoji côté
-- cloche, et la bascule de mode au clic. Null pour les notifs transverses.
ALTER TABLE "notifications" ADD COLUMN "game" TEXT;
