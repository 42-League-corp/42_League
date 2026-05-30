/**
 * Génère de FAUX matchs / résultats / demandes de duel entre TOI et un joueur
 * factice « test », pour peupler l'historique et tester l'UI.
 *
 * Usage :
 *   npm run db:seed-test -w @42-league/backend
 *   ME=ton_login npm run db:seed-test -w @42-league/backend   # autre login
 *
 * Idempotent : ré-exécutable, il efface d'abord les données me↔test précédentes.
 * Pour les notifs EN TEMPS RÉEL (push SSE pendant que l'app tourne), utilise
 * plutôt `make -f Makefile.notif …` qui passe par les vraies routes API.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { calculateBabyfootElo } from '@42-league/shared';

const prisma = new PrismaClient();

const ME = process.env.ME ?? 'throbert';
const OPP = 'test';

function daysAgo(d: number) {
  return new Date(Date.now() - d * 86_400_000);
}
function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3_600_000);
}
function daysFromNow(d: number) {
  return new Date(Date.now() + d * 86_400_000);
}
function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// Historique vu DEPUIS MOI : [monScore, scoreTest, ilYaNbJours]
// (un côté doit toujours atteindre 10)
const HISTORY: Array<[number, number, number]> = [
  [10, 7, 21],
  [8, 10, 19],
  [10, 4, 16],
  [10, 9, 14],
  [6, 10, 12],
  [10, 8, 10],
  [10, 5, 8],
  [9, 10, 6],
  [10, 7, 4],
  [10, 2, 3],
  [7, 10, 2],
  [10, 6, 1],
];

async function ensureUsers() {
  // On ne crée MOI que s'il n'existe pas déjà (ne pas écraser tes vraies stats).
  await prisma.user.upsert({
    where: { login: ME },
    update: {},
    create: { login: ME, campus: 'Paris', elo: 1500 },
  });
  // Le joueur de test : recréé proprement à chaque run.
  await prisma.user.upsert({
    where: { login: OPP },
    update: { title: '🤖 Sparring-partner', elo: 1000, matchesPlayed: 0 },
    create: { login: OPP, campus: 'Paris', elo: 1000, title: '🤖 Sparring-partner' },
  });
}

async function cleanPair() {
  const [a, b] = pairKey(ME, OPP);
  await prisma.playedMatch.deleteMany({ where: { playerALogin: a, playerBLogin: b } });
  await prisma.pendingMatch.deleteMany({
    where: {
      OR: [
        { declarerLogin: ME, opponentLogin: OPP },
        { declarerLogin: OPP, opponentLogin: ME },
      ],
    },
  });
  await prisma.challenge.deleteMany({
    where: {
      OR: [
        { challengerLogin: ME, opponentLogin: OPP },
        { challengerLogin: OPP, opponentLogin: ME },
      ],
    },
  });
}

async function seedHistory() {
  const [a, b] = pairKey(ME, OPP);
  // ELO courant des deux joueurs, qu'on fait évoluer match après match.
  let eloA = (await prisma.user.findUniqueOrThrow({ where: { login: a } })).elo;
  let eloB = (await prisma.user.findUniqueOrThrow({ where: { login: b } })).elo;
  let playedA = 0;
  let playedB = 0;

  for (const [myScore, testScore, dAgo] of HISTORY) {
    const scoreMe = myScore;
    const scoreTest = testScore;
    const scoreA = a === ME ? scoreMe : scoreTest;
    const scoreB = a === ME ? scoreTest : scoreMe;
    const winner: 'A' | 'B' = scoreA > scoreB ? 'A' : 'B';

    const upd = calculateBabyfootElo(eloA, eloB, winner, scoreA, scoreB);
    await prisma.playedMatch.create({
      data: {
        id: randomUUID(),
        playerALogin: a,
        playerBLogin: b,
        scoreA,
        scoreB,
        winner,
        playedAt: daysAgo(dAgo),
        countedForElo: true,
        deltaA: upd.deltaA,
        deltaB: upd.deltaB,
      },
    });
    eloA = upd.newA;
    eloB = upd.newB;
    playedA += 1;
    playedB += 1;
  }

  await prisma.user.update({
    where: { login: a },
    data: { elo: eloA, matchesPlayed: { increment: playedA } },
  });
  await prisma.user.update({
    where: { login: b },
    data: { elo: eloB, matchesPlayed: { increment: playedB } },
  });
}

async function seedRequests() {
  // 2 demandes de duel EN ATTENTE : test te défie → notif « défi reçu ».
  await prisma.challenge.createMany({
    data: [
      {
        id: randomUUID(),
        challengerLogin: OPP,
        opponentLogin: ME,
        status: 'pending',
        scheduledAt: daysFromNow(1),
        createdAt: hoursAgo(2),
      },
      {
        id: randomUUID(),
        challengerLogin: OPP,
        opponentLogin: ME,
        status: 'pending',
        scheduledAt: daysFromNow(3),
        createdAt: hoursAgo(1),
      },
    ],
  });

  // 1 match déclaré par test → tu dois CONFIRMER (UI de confirmation/contestation).
  await prisma.pendingMatch.create({
    data: {
      id: randomUUID(),
      declarerLogin: OPP,
      opponentLogin: ME,
      scoreDeclarer: 10,
      scoreOpponent: 8,
      declaredAt: hoursAgo(1),
    },
  });
}

async function main() {
  console.log(`🌱 Faux matchs ${ME} ↔ ${OPP}…`);
  await ensureUsers();
  await cleanPair();
  await seedHistory();
  await seedRequests();
  console.log(`✅ ${HISTORY.length} matchs joués, 2 demandes de duel, 1 match à confirmer.`);
  console.log(`   (recharge l'app — ou émets un event SSE via Makefile.notif)`);
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
