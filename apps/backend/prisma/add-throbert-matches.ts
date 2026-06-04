/**
 * Donne à `throbert` une vraie courbe ELO sur chaque discipline (babyfoot,
 * smash, chess, streetfighter) en lui ajoutant des matchs déjà joués contre un
 * faux adversaire d'entraînement (`sparring`, campus Le Havre).
 *
 * Usage (sur l'environnement voulu — staging) :
 *   npm run db:add-throbert-matches:prod -w @42-league/backend
 *
 * Idempotent : les matchs ont des IDs déterministes par jeu (`seed-throbert-<game>-<i>`),
 * supprimés puis recréés à chaque run. L'ELO et le compteur de matchs de chaque
 * joueur sont recalculés depuis une base propre (1000) à chaque exécution — pas
 * d'inflation en cas de ré-exécution.
 *
 * La courbe du EloChart est dérivée ainsi (cf. apps/web EloChart.computeEloHistory) :
 *   startElo = currentElo - Σ(deltas du jeu courant)
 * Donc l'ELO stocké côté User pour un jeu DOIT valoir base 1000 + Σ(deltas de ce jeu)
 * pour que la courbe parte de 1000 et finisse à la valeur affichée sur le profil.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HERO = 'throbert';
const FOE = 'sparring'; // faux adversaire d'entraînement (campus Le Havre)
const BASE_ELO = 1000;

type Game = 'babyfoot' | 'smash' | 'chess' | 'streetfighter';

// Colonnes User par discipline (elo + compteur de matchs).
const COLUMNS: Record<Game, { elo: 'elo' | 'eloSmash' | 'eloChess' | 'eloSf'; played: 'matchesPlayed' | 'matchesPlayedSmash' | 'matchesPlayedChess' | 'matchesPlayedSf' }> = {
  babyfoot:     { elo: 'elo',      played: 'matchesPlayed' },
  smash:        { elo: 'eloSmash', played: 'matchesPlayedSmash' },
  chess:        { elo: 'eloChess', played: 'matchesPlayedChess' },
  streetfighter:{ elo: 'eloSf',    played: 'matchesPlayedSf' },
};

interface SeedMatch {
  scoreA: number;
  scoreB: number;
  deltaA: number;
  daysAgo: number;
  bestOf?: number;
  charA?: string;
  charB?: string;
}

// 6 matchs par jeu (du plus ancien au plus récent), throbert = joueur A.
// Même motif de delta partout (montée / descente / montée) → courbe vivante.
// deltaA pattern : +18 +15 -12 +20 -14 +16  → Σ = +43.
const GAME_MATCHES: Record<Game, SeedMatch[]> = {
  // Babyfoot : scores jusqu'à 10, pas de chars. (Inchangé.)
  babyfoot: [
    { scoreA: 10, scoreB: 7,  deltaA: 18, daysAgo: 26 },
    { scoreA: 10, scoreB: 5,  deltaA: 15, daysAgo: 21 },
    { scoreA: 8,  scoreB: 10, deltaA: -12, daysAgo: 16 },
    { scoreA: 10, scoreB: 9,  deltaA: 20, daysAgo: 11 },
    { scoreA: 6,  scoreB: 10, deltaA: -14, daysAgo: 6 },
    { scoreA: 10, scoreB: 4,  deltaA: 16, daysAgo: 2 },
  ],
  // Smash : best-of, scores = manches gagnées, chars mario/link.
  smash: [
    { scoreA: 3, scoreB: 1, deltaA: 18, daysAgo: 28, bestOf: 5, charA: 'mario', charB: 'link' },
    { scoreA: 2, scoreB: 0, deltaA: 15, daysAgo: 23, bestOf: 3, charA: 'mario', charB: 'link' },
    { scoreA: 1, scoreB: 3, deltaA: -12, daysAgo: 18, bestOf: 5, charA: 'mario', charB: 'link' },
    { scoreA: 2, scoreB: 1, deltaA: 20, daysAgo: 13, bestOf: 3, charA: 'mario', charB: 'link' },
    { scoreA: 0, scoreB: 2, deltaA: -14, daysAgo: 8,  bestOf: 3, charA: 'mario', charB: 'link' },
    { scoreA: 3, scoreB: 2, deltaA: 16, daysAgo: 3,  bestOf: 5, charA: 'mario', charB: 'link' },
  ],
  // Chess : scores binaires 1-0 / 0-1, pas de chars ni bestOf.
  chess: [
    { scoreA: 1, scoreB: 0, deltaA: 18, daysAgo: 27 },
    { scoreA: 1, scoreB: 0, deltaA: 15, daysAgo: 22 },
    { scoreA: 0, scoreB: 1, deltaA: -12, daysAgo: 17 },
    { scoreA: 1, scoreB: 0, deltaA: 20, daysAgo: 12 },
    { scoreA: 0, scoreB: 1, deltaA: -14, daysAgo: 7 },
    { scoreA: 1, scoreB: 0, deltaA: 16, daysAgo: 2 },
  ],
  // Street Fighter : best-of, scores = rounds, chars ryu/ken.
  streetfighter: [
    { scoreA: 3, scoreB: 1, deltaA: 18, daysAgo: 29, bestOf: 5, charA: 'ryu', charB: 'ken' },
    { scoreA: 2, scoreB: 0, deltaA: 15, daysAgo: 24, bestOf: 3, charA: 'ryu', charB: 'ken' },
    { scoreA: 1, scoreB: 3, deltaA: -12, daysAgo: 19, bestOf: 5, charA: 'ryu', charB: 'ken' },
    { scoreA: 2, scoreB: 1, deltaA: 20, daysAgo: 14, bestOf: 3, charA: 'ryu', charB: 'ken' },
    { scoreA: 0, scoreB: 2, deltaA: -14, daysAgo: 9,  bestOf: 3, charA: 'ryu', charB: 'ken' },
    { scoreA: 3, scoreB: 0, deltaA: 16, daysAgo: 4,  bestOf: 5, charA: 'ryu', charB: 'ken' },
  ],
};

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
    create: { login: FOE, firstName: 'Sparring', lastName: 'Partner', campus: 'Le Havre', elo: BASE_ELO },
  });
  console.log(`✓ Faux adversaire « ${FOE} » prêt.`);

  // Saison active (comme POST /matches : seasonId = saison active ?? null).
  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  const seasonId = activeSeason?.id ?? null;
  console.log(`✓ Saison active : ${activeSeason ? activeSeason.name : '(aucune — seasonId null)'}`);

  // Nettoyage unique de l'ancien préfixe (`seed-thr-*`, babyfoot) pour éviter
  // que les anciens matchs cohabitent avec les nouveaux et faussent la courbe.
  await prisma.playedMatch.deleteMany({ where: { id: { startsWith: 'seed-thr-' } } });

  const now = Date.now();
  const games: Game[] = ['babyfoot', 'smash', 'chess', 'streetfighter'];

  for (const game of games) {
    const matches = GAME_MATCHES[game];
    const prefix = `seed-throbert-${game}`;

    // Idempotence : on purge les anciens seeds de ce jeu avant de recréer.
    await prisma.playedMatch.deleteMany({ where: { id: { startsWith: `${prefix}-` } } });

    let sumDeltaHero = 0;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]!;
      const id = `${prefix}-${i + 1}`;
      const heroWon = m.scoreA > m.scoreB;
      sumDeltaHero += m.deltaA;
      await prisma.playedMatch.create({
        data: {
          id,
          playerALogin: HERO,
          playerBLogin: FOE,
          scoreA: m.scoreA,
          scoreB: m.scoreB,
          winner: heroWon ? 'A' : 'B',
          playedAt: new Date(now - m.daysAgo * 24 * 3600 * 1000),
          countedForElo: true,
          deltaA: m.deltaA,
          deltaB: -m.deltaA,
          seasonId,
          game,
          bestOf: m.bestOf ?? null,
          charA: m.charA ?? null,
          charB: m.charB ?? null,
        },
      });
      console.log(`   ✓ ${id} : ${HERO} ${m.scoreA}–${m.scoreB} ${FOE} (Δ ${m.deltaA > 0 ? '+' : ''}${m.deltaA})`);
    }

    // ELO recalculé depuis une base propre (1000) → pas d'inflation au re-run.
    // startElo (chart) = currentElo - Σ(deltas) = 1000, donc on stocke 1000 + Σ.
    const col = COLUMNS[game];
    const heroElo = BASE_ELO + sumDeltaHero;
    const foeElo = BASE_ELO - sumDeltaHero;
    const played = matches.length;

    await prisma.user.update({
      where: { login: HERO },
      data: { [col.elo]: heroElo, [col.played]: played },
    });
    await prisma.user.update({
      where: { login: FOE },
      data: { [col.elo]: foeElo, [col.played]: played },
    });
    console.log(`   ⇒ ${game} : ${HERO} ELO ${heroElo} (${played} matchs), ${FOE} ELO ${foeElo}`);
  }

  console.log('✅ Courbes ELO multi-disciplines prêtes pour throbert (babyfoot / smash / chess / streetfighter).');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
