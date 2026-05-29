import { execSync } from 'node:child_process';

// Applique le schéma Prisma sur la DB de test une seule fois avant toute la
// suite d'intégration. `migrate deploy` est idempotent : ré-exécutable sans
// risque si les migrations sont déjà appliquées.
export default function setup() {
  const url =
    process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:55432/league_test';
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
