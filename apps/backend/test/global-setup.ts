import { execSync } from 'node:child_process';

// Matérialise le schéma sur la DB de test (jetable) une seule fois avant toute
// la suite d'intégration.
//
// On utilise `db push` (état final depuis schema.prisma) et NON `migrate deploy`
// (rejoue les migrations dans l'ordre des timestamps). Raison : certaines
// migrations historiques sont datées « dans le futur » (jusqu'au 24 juin), si
// bien qu'une migration générée plus tard avec le vrai timestamp du jour se
// classe AVANT ses dépendances (ex. add_flechettes touche `matchmaking_queue`
// qui n'existe qu'à une migration ultérieure). Sur une DB incrémentale
// (staging/prod) ça passe — la table existe déjà — mais `migrate deploy` à blanc
// échoue. La DB de test n'a besoin que du schéma final, pas de l'historique :
// `db push --force-reset` le reconstruit proprement, sans toucher aux migrations.
export default function setup() {
  const url =
    process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:55432/league_test';
  execSync('npx prisma db push --force-reset --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
