-- Identité réelle (prénom + nom) issue du profil 42. Affichée à la place du
-- login sur le profil et partout où firstName/lastName sont déjà câblés côté
-- front. Nullable : rétro-rempli au prochain login / à la consultation publique.
ALTER TABLE "users" ADD COLUMN "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN "last_name" TEXT;
