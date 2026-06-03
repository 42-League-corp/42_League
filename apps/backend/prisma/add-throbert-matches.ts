/**
 * Donne à `throbert` 6 matchs babyfoot déjà joués contre un faux adversaire,
 * histoire d'avoir une vraie courbe ELO sur le profil.
 *
 * Usage (sur l'environnement voulu — staging) :
 *   npm run db:add-throbert-matches -w @42-league/backend
 *
 * Idempotent : les matchs ont des IDs déterministes (upsert), ré-exécutable
 * sans créer de doublon. Le faux user est upserté sur son login.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HERO = 'throbert';
const FOE = 'sparring'; // faux adversaire d'entraînement (campus Le Havre)

// 6 matchs (du plus ancien au plus récent), throbert = joueur A.
// deltaA = variation ELO de throbert ; somme = +43 → courbe globalement montante.
const MATCHES: { scoreA: number; scoreB: number; deltaA: number; daysAgo: number }[] = [
  { scoreA: 10, scoreB: 7, deltaA: 18, daysAgo: 26 },
  { scoreA: 10, scoreB: 5, deltaA: 15, daysAgo: 21 },
  { scoreA: 8, scoreB: 10, deltaA: -12, daysAgo: 16 },
  { scoreA: 10, scoreB: 9, deltaA: 20, daysAgo: 11 },
  { scoreA: 6, scoreB: 10, deltaA: -14, daysAgo: 6 },
  { scoreA: 10, scoreB: 4, deltaA: 16, daysAgo: 2 },
];

async function main() {
  const hero = await prisma.user.findUnique({ where: { login: HERO } });
  if (!hero) {
    console.error(`❌ L'utilisateur "${HERO}" n'existe pas dans cette base. Abandon.`);
    process.exit(1);
  }

  // Faux adversaire (idempotent).
  await prisma.user.upsert({
    where: { login: FOE },
    update: {},
    create: { login: FOE, firstName: 'Sparring', lastName: 'Partner', campus: 'Le Havre', elo: 1000 },
  });
  console.log(`✓ Faux adversaire « ${FOE} » prêt.`);

  const now = Date.now();
  for (let i = 0; i < MATCHES.length; i++) {
    const m = MATCHES[i]!;
    const id = `seed-thr-${i + 1}`;
    const heroWon = m.scoreA > m.scoreB;
    const data = {
      playerALogin: HERO,
      playerBLogin: FOE,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winner: heroWon ? 'A' : 'B',
      playedAt: new Date(now - m.daysAgo * 24 * 3600 * 1000),
      countedForElo: true,
      deltaA: m.deltaA,
      deltaB: -m.deltaA,
      game: 'babyfoot',
    };
    await prisma.playedMatch.upsert({ where: { id }, update: data, create: { id, ...data } });
    console.log(`   ✓ ${id} : ${HERO} ${m.scoreA}–${m.scoreB} ${FOE} (Δ ${m.deltaA > 0 ? '+' : ''}${m.deltaA})`);
  }

  console.log('✅ 6 matchs ajoutés pour throbert — la courbe ELO devrait apparaître.');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
