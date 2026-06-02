-- AddColumn: discipline sur les badges ('' = global, 'babyfoot'/'smash'/'chess' = spécifique).
-- Permet de distinguer champion babyfoot et champion chess lors de la même saison.
ALTER TABLE "user_badges" ADD COLUMN "game" TEXT NOT NULL DEFAULT '';

-- L'ancienne contrainte d'unicité (user_login, code) ne permettait qu'un seul badge
-- par code par joueur. La nouvelle (user_login, code, game) autorise le même badge
-- pour des disciplines distinctes (ex. 'season_champion' × 'babyfoot' + 'chess').
DROP INDEX IF EXISTS "user_badges_user_login_code_key";
CREATE UNIQUE INDEX "user_badges_user_login_code_game_key" ON "user_badges"("user_login", "code", "game");
