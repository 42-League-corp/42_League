-- ─── Babyfoot 2v2 : persistance des deltas ELO d'équipe ─────────────────────
--
-- Jusqu'ici seuls les deltas ELO INDIVIDUELS (delta_a/b, delta_a2/b2) étaient
-- stockés. Le delta ELO des ENTITÉS BabyfootTeam (Calcul A) était calculé puis
-- jeté, rendant impossible la reconstruction de l'historique ELO d'un duo sur
-- sa page profil. Ces deux colonnes le conservent désormais.
--
-- Nullable : NULL pour les matchs 1v1 et tous les matchs 2v2 antérieurs à cette
-- migration (historique dégradé en douceur ; les nouveaux matchs sont exacts).

ALTER TABLE "played_matches"
  ADD COLUMN "team_delta_a" INTEGER,  -- variation ELO de l'entité BabyfootTeam côté A
  ADD COLUMN "team_delta_b" INTEGER;  -- variation ELO de l'entité BabyfootTeam côté B
