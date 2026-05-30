/**
 * Ajoute 8 joueurs de test (test1 … test8) dans la base.
 *
 * Usage :
 *   npm run db:add-players -w @42-league/backend
 *
 * Idempotent : ré-exécutable sans créer de doublons (upsert sur le login).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COUNT = 8;

async function main() {
  console.log(`🌱 Ajout de ${COUNT} joueurs de test (test1…test${COUNT})…`);
  for (let i = 1; i <= COUNT; i++) {
    const login = `test${i}`;
    await prisma.user.upsert({
      where: { login },
      update: {},
      create: { login, campus: 'Le Havre', elo: 1000 },
    });
    console.log(`   ✓ ${login}`);
  }
  console.log('✅ Terminé.');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
