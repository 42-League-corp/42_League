/**
 * Script one-shot : ajoute un PendingMatch pour tester la notif / contest UI.
 * Usage : npm run db:add-notif -w @42-league/backend
 *
 * Modifie TARGET_LOGIN pour choisir qui reçoit la notif.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

// ← change ici si ton login n'est pas throbert
const TARGET_LOGIN = 'abidaux';

// Qui "déclare" la game (un autre joueur de la whitelist)
const DECLARER_LOGIN = 'sbonneau';

async function main() {
  const match = await prisma.pendingMatch.create({
    data: {
      id: randomUUID(),
      declarerLogin: DECLARER_LOGIN,
      opponentLogin: TARGET_LOGIN,
      scoreDeclarer: 10,
      scoreOpponent: 7,
      declaredAt: new Date(),
    },
  });

  console.log('✅ PendingMatch créé :');
  console.log(`   ${DECLARER_LOGIN} a déclaré 10–7 contre ${TARGET_LOGIN}`);
  console.log(`   id: ${match.id}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
