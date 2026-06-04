/**
 * Service de trophées d'équipe Babyfoot 2v2.
 *
 * Entièrement calculé à la demande (aucun stockage en base) pour rester
 * cohérent avec le pattern des trophées individuels (computeTrophies côté front).
 *
 * Deux trophées :
 *   1. « Le Plus Gros Carry »   — écart d'ELO individuel maximal dans un duo.
 *   2. « Duo de Choc »          — WR 2v2 supérieur de ≥20 % à la moyenne individuelle.
 *
 * @module team-trophies
 */

import type { PrismaClient } from '@prisma/client';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Écart d'ELO minimal (en points) pour décerner le trophée Carry. */
const CARRY_MIN_GAP = 100;

/** Nombre minimal de matchs 2v2 validés pour être éligible au trophée Duo de Choc. */
const DUO_MIN_MATCHES = 5;

/** Amélioration minimale du WR 2v2 vs WR individuel moyen (en points de %, 0–100). */
const DUO_WR_DELTA_THRESHOLD = 20;

/** Matchs 2v2 minimum pour figer le trophée « Le Sommet » (meilleur ELO). */
const SOMMET_MIN_MATCHES = 3;

/** Victoires 2v2 minimum pour décerner « Machine de Guerre ». */
const MACHINE_MIN_WINS = 8;

/** Matchs 2v2 minimum pour décerner « La Muraille » (meilleur win rate). */
const MURAILLE_MIN_MATCHES = 8;

/** Matchs 2v2 minimum pour décerner « Les Increvables » (le plus actif). */
const INCREVABLES_MIN_MATCHES = 12;

/** Matchs 2v2 minimum pour « Les Jumeaux » (duo le plus équilibré). */
const JUMEAUX_MIN_MATCHES = 6;

/** Victoires minimum (0 défaite) pour « Les Invaincus ». */
const INVAINCUS_MIN_WINS = 5;

// ─── Types publics ────────────────────────────────────────────────────────────

export type TeamTrophyCode =
  | 'carry'
  | 'duo_de_choc'
  | 'sommet'
  | 'machine_de_guerre'
  | 'muraille'
  | 'increvables'
  | 'jumeaux'
  | 'invaincus';

export interface TeamTrophyResult {
  code: TeamTrophyCode;
  emoji: string;
  title: string;
  subtitle: string;
  /** Description longue affichée dans le tooltip et la page TeamProfile. */
  description: string;
  earned: boolean;
  /** null quand personne ne détient encore le trophée. */
  teamId: string | null;
  teamName: string | null;
  player1Login: string | null;
  player2Login: string | null;
  teamElo: number | null;
  /** Valeur chiffrée concise (ex. "312 pts d'écart" ou "+23% vs individuel"). */
  value: string;
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

/**
 * Calcule et renvoie les deux trophées d'équipe 2v2.
 * À appeler depuis `GET /teams/trophies`.
 */
export async function computeTeamTrophies(
  prisma: PrismaClient,
): Promise<TeamTrophyResult[]> {
  const [carry, duo, records] = await Promise.all([
    computeCarryTrophy(prisma),
    computeDuoDeChocTrophy(prisma),
    loadTeamRecords(prisma),
  ]);

  return [
    computeSommetTrophy(records),
    computeMachineTrophy(records),
    computeMurailleTrophy(records),
    duo,
    carry,
    computeIncrevablesTrophy(records),
    computeJumeauxTrophy(records),
    computeInvaincusTrophy(records),
  ];
}

// ─── Récapitulatif par équipe (réutilisé par 4 trophées) ──────────────────────

interface TeamRecord {
  id: string;
  name: string | null;
  player1Login: string;
  player2Login: string;
  elo: number;
  /** ELO individuel courant de chaque joueur (pour « Les Jumeaux »). */
  player1Elo: number;
  player2Elo: number;
  wins: number;
  losses: number;
  total: number;
}

/**
 * Charge tous les duos avec leur bilan 2v2 (victoires / défaites / total),
 * en ne comptant que les matchs comptabilisés pour l'ELO.
 */
async function loadTeamRecords(prisma: PrismaClient): Promise<TeamRecord[]> {
  const teams = await prisma.babyfootTeam.findMany({
    include: {
      player1: { select: { elo: true } },
      player2: { select: { elo: true } },
      matchesAsTeamA: {
        where: { mode: '2v2', countedForElo: true },
        select: { winner: true },
      },
      matchesAsTeamB: {
        where: { mode: '2v2', countedForElo: true },
        select: { winner: true },
      },
    },
  });

  return teams.map((t) => {
    const wins =
      t.matchesAsTeamA.filter((m) => m.winner === 'A').length +
      t.matchesAsTeamB.filter((m) => m.winner === 'B').length;
    const total = t.matchesAsTeamA.length + t.matchesAsTeamB.length;
    return {
      id: t.id,
      name: t.name,
      player1Login: t.player1Login,
      player2Login: t.player2Login,
      elo: t.elo,
      player1Elo: t.player1.elo,
      player2Elo: t.player2.elo,
      wins,
      losses: total - wins,
      total,
    };
  });
}

/** Sérialise un TeamRecord gagnant vers la forme TeamTrophyResult. */
function awarded(
  base: Omit<TeamTrophyResult, 'teamId' | 'teamName' | 'player1Login' | 'player2Login' | 'teamElo'>,
  winner: TeamRecord | null,
): TeamTrophyResult {
  const earned = base.earned && winner !== null;
  return {
    ...base,
    earned,
    teamId: earned ? winner!.id : null,
    teamName: earned ? winner!.name : null,
    player1Login: earned ? winner!.player1Login : null,
    player2Login: earned ? winner!.player2Login : null,
    teamElo: earned ? winner!.elo : null,
  };
}

// ─── Trophée 3 : Le Sommet ────────────────────────────────────────────────────

/** Duo au plus haut ELO 2v2 (min. SOMMET_MIN_MATCHES matchs). */
function computeSommetTrophy(records: TeamRecord[]): TeamTrophyResult {
  let winner: TeamRecord | null = null;
  let maxElo = -Infinity;

  for (const t of records) {
    if (t.total < SOMMET_MIN_MATCHES) continue;
    if (t.elo > maxElo) {
      maxElo = t.elo;
      winner = t;
    }
  }

  return awarded(
    {
      code: 'sommet',
      emoji: '👑',
      title: 'Le Sommet',
      subtitle: 'Duo le mieux classé du Babyfoot 2v2',
      description:
        `Décerné à l'équipe au plus haut ELO 2v2 parmi tous les duos ayant disputé au moins ` +
        `${SOMMET_MIN_MATCHES} matchs. Le duo n°1 du classement, le roi du terrain.`,
      earned: winner !== null,
      value: winner !== null ? `${maxElo} ELO` : '—',
    },
    winner,
  );
}

// ─── Trophée 4 : Machine de Guerre ────────────────────────────────────────────

/** Duo totalisant le plus de victoires 2v2 (min. MACHINE_MIN_WINS). */
function computeMachineTrophy(records: TeamRecord[]): TeamTrophyResult {
  let winner: TeamRecord | null = null;
  let maxWins = 0;

  for (const t of records) {
    if (t.wins > maxWins) {
      maxWins = t.wins;
      winner = t;
    }
  }

  const earned = winner !== null && maxWins >= MACHINE_MIN_WINS;

  return awarded(
    {
      code: 'machine_de_guerre',
      emoji: '⚔️',
      title: 'Machine de Guerre',
      subtitle: 'Le duo qui empile le plus de victoires',
      description:
        `Récompense l'équipe ayant remporté le plus de matchs 2v2 au total. ` +
        `La quantité brute de victoires : ces deux-là ne lâchent rien. Minimum ${MACHINE_MIN_WINS} victoires.`,
      earned,
      value: earned ? `${maxWins} victoires` : '—',
    },
    earned ? winner : null,
  );
}

// ─── Trophée 5 : La Muraille ──────────────────────────────────────────────────

/** Duo au meilleur win rate 2v2 (min. MURAILLE_MIN_MATCHES matchs). */
function computeMurailleTrophy(records: TeamRecord[]): TeamTrophyResult {
  let winner: TeamRecord | null = null;
  let bestWR = -Infinity;
  let winnerWRPct = 0;

  for (const t of records) {
    if (t.total < MURAILLE_MIN_MATCHES) continue;
    const wr = t.wins / t.total;
    if (wr > bestWR) {
      bestWR = wr;
      winner = t;
      winnerWRPct = Math.round(wr * 100);
    }
  }

  return awarded(
    {
      code: 'muraille',
      emoji: '🛡️',
      title: 'La Muraille',
      subtitle: 'Meilleur win rate 2v2 de la ligue',
      description:
        `Attribué à l'équipe au plus haut pourcentage de victoires 2v2, sur un minimum de ` +
        `${MURAILLE_MIN_MATCHES} matchs. Une défense impénétrable doublée d'une efficacité redoutable.`,
      earned: winner !== null,
      value: winner !== null ? `${winnerWRPct}% WR (${winner.wins}V-${winner.losses}D)` : '—',
    },
    winner,
  );
}

// ─── Trophée 6 : Les Increvables ──────────────────────────────────────────────

/** Duo ayant disputé le plus de matchs 2v2 (min. INCREVABLES_MIN_MATCHES). */
function computeIncrevablesTrophy(records: TeamRecord[]): TeamTrophyResult {
  let winner: TeamRecord | null = null;
  let maxTotal = 0;

  for (const t of records) {
    if (t.total > maxTotal) {
      maxTotal = t.total;
      winner = t;
    }
  }

  const earned = winner !== null && maxTotal >= INCREVABLES_MIN_MATCHES;

  return awarded(
    {
      code: 'increvables',
      emoji: '🔁',
      title: 'Les Increvables',
      subtitle: 'Le duo le plus actif sur la table',
      description:
        `Pour l'équipe ayant disputé le plus grand nombre de matchs 2v2. ` +
        `Toujours partants pour une partie : l'endurance avant tout. Minimum ${INCREVABLES_MIN_MATCHES} matchs.`,
      earned,
      value: earned ? `${maxTotal} matchs` : '—',
    },
    earned ? winner : null,
  );
}

// ─── Trophée 7 : Les Jumeaux ──────────────────────────────────────────────────

/** Duo le plus équilibré : plus petit écart d'ELO individuel (min. de matchs). */
function computeJumeauxTrophy(records: TeamRecord[]): TeamTrophyResult {
  let winner: TeamRecord | null = null;
  let minGap = Infinity;

  for (const t of records) {
    if (t.total < JUMEAUX_MIN_MATCHES) continue;
    const gap = Math.abs(t.player1Elo - t.player2Elo);
    if (gap < minGap) {
      minGap = gap;
      winner = t;
    }
  }

  return awarded(
    {
      code: 'jumeaux',
      emoji: '🪞',
      title: 'Les Jumeaux',
      subtitle: 'Le duo le plus équilibré de la ligue',
      description:
        `Décerné à l'équipe (≥${JUMEAUX_MIN_MATCHES} matchs 2v2) dont les deux joueurs ont l'ELO ` +
        `individuel le plus proche. Aucun ne porte l'autre : la vraie symbiose, l'opposé du Carry.`,
      earned: winner !== null,
      value: winner !== null ? `${minGap} pts d'écart` : '—',
    },
    winner,
  );
}

// ─── Trophée 8 : Les Invaincus ────────────────────────────────────────────────

/** Duo encore jamais battu (0 défaite), au plus grand nombre de victoires. */
function computeInvaincusTrophy(records: TeamRecord[]): TeamTrophyResult {
  let winner: TeamRecord | null = null;
  let maxWins = 0;

  for (const t of records) {
    if (t.losses !== 0) continue;
    if (t.wins > maxWins) {
      maxWins = t.wins;
      winner = t;
    }
  }

  const earned = winner !== null && maxWins >= INVAINCUS_MIN_WINS;

  return awarded(
    {
      code: 'invaincus',
      emoji: '💎',
      title: 'Les Invaincus',
      subtitle: 'Duo encore jamais battu en 2v2',
      description:
        `Pour l'équipe qui n'a JAMAIS perdu un match 2v2, avec au moins ${INVAINCUS_MIN_WINS} ` +
        `victoires. Un parcours immaculé : le trophée est à eux tant que personne ne les fait tomber.`,
      earned,
      value: earned ? `${maxWins}-0, invaincus` : '—',
    },
    earned ? winner : null,
  );
}

// ─── Trophée 1 : Le Plus Gros Carry ──────────────────────────────────────────

/**
 * Trophée « Le Plus Gros Carry » :
 * Équipe dont l'écart absolu d'ELO entre ses deux joueurs (ELO personnel courant)
 * est le plus important parmi tous les duos existants.
 *
 * Note : utilise l'ELO courant plutôt qu'un instantané à la création du duo,
 * car aucun snapshot de création n'est stocké. Le trophée est donc « vivant » :
 * il peut changer de main quand les joueurs progressent.
 */
async function computeCarryTrophy(prisma: PrismaClient): Promise<TeamTrophyResult> {
  const teams = await prisma.babyfootTeam.findMany({
    include: {
      player1: { select: { login: true, elo: true } },
      player2: { select: { login: true, elo: true } },
    },
  });

  let winner: (typeof teams)[number] | null = null;
  let maxGap = 0;

  for (const team of teams) {
    const gap = Math.abs(team.player1.elo - team.player2.elo);
    if (gap > maxGap) {
      maxGap = gap;
      winner = team;
    }
  }

  const earned = winner !== null && maxGap >= CARRY_MIN_GAP;

  return {
    code: 'carry',
    emoji: '🏋️',
    title: 'Le Plus Gros Carry',
    subtitle: 'Duo avec le plus grand écart de niveau',
    description:
      `Attribué à l'équipe dont l'écart d'ELO personnel entre ses deux joueurs est le plus important. ` +
      `Le joueur fort porte son coéquipier sur ses épaules. Écart minimum requis : ${CARRY_MIN_GAP} pts.`,
    earned,
    teamId: earned ? winner!.id : null,
    teamName: earned ? winner!.name : null,
    player1Login: earned ? winner!.player1Login : null,
    player2Login: earned ? winner!.player2Login : null,
    teamElo: earned ? winner!.elo : null,
    value: earned ? `${maxGap} pts d'écart` : '—',
  };
}

// ─── Trophée 2 : Duo de Choc ──────────────────────────────────────────────────

/**
 * Trophée « Duo de Choc » :
 * Équipe (≥ DUO_MIN_MATCHES matchs 2v2 comptabilisés) dont le win rate collectif
 * dépasse d'au moins 20 points de % la moyenne des win rates individuels en 1v1.
 *
 * WR_team  = wins_2v2 / (wins_2v2 + losses_2v2)
 * WR_indiv = (WR_j1_1v1 + WR_j2_1v1) / 2
 * Delta    = (WR_team - WR_indiv) × 100   [en points de %]
 *
 * Si un joueur n'a aucun match 1v1, son WR individuel est supposé à 50 %.
 */
async function computeDuoDeChocTrophy(prisma: PrismaClient): Promise<TeamTrophyResult> {
  const [teams, matches1v1] = await Promise.all([
    prisma.babyfootTeam.findMany({
      include: {
        matchesAsTeamA: {
          where: { mode: '2v2', countedForElo: true },
          select: { winner: true },
        },
        matchesAsTeamB: {
          where: { mode: '2v2', countedForElo: true },
          select: { winner: true },
        },
      },
    }),
    // Matchs 1v1 (mode IS NULL) comptabilisés, Babyfoot uniquement.
    prisma.playedMatch.findMany({
      where: { game: 'babyfoot', mode: null, countedForElo: true },
      select: { playerALogin: true, playerBLogin: true, winner: true },
    }),
  ]);

  // ── Win rates individuels en 1v1 ───────────────────────────────────────────

  const indivStats = new Map<string, { wins: number; total: number }>();

  const ensure = (login: string) => {
    if (!indivStats.has(login)) indivStats.set(login, { wins: 0, total: 0 });
    return indivStats.get(login)!;
  };

  for (const m of matches1v1) {
    const a = ensure(m.playerALogin);
    const b = ensure(m.playerBLogin);
    a.total++;
    b.total++;
    if (m.winner === 'A') a.wins++;
    else b.wins++;
  }

  const indivWR = (login: string): number => {
    const s = indivStats.get(login);
    return s && s.total > 0 ? s.wins / s.total : 0.5;
  };

  // ── Recherche du meilleur duo ───────────────────────────────────────────────

  let winner: (typeof teams)[number] | null = null;
  let maxDelta = -Infinity;
  let winnerTeamWRPct = 0;
  let winnerAvgIndivWRPct = 0;

  for (const team of teams) {
    const teamWins =
      team.matchesAsTeamA.filter((m) => m.winner === 'A').length +
      team.matchesAsTeamB.filter((m) => m.winner === 'B').length;
    const teamTotal = team.matchesAsTeamA.length + team.matchesAsTeamB.length;

    if (teamTotal < DUO_MIN_MATCHES) continue;

    const teamWR = teamWins / teamTotal;
    const avgIndivWR = (indivWR(team.player1Login) + indivWR(team.player2Login)) / 2;
    const deltaPct = (teamWR - avgIndivWR) * 100;

    if (deltaPct > maxDelta) {
      maxDelta = deltaPct;
      winner = team;
      winnerTeamWRPct = Math.round(teamWR * 100);
      winnerAvgIndivWRPct = Math.round(avgIndivWR * 100);
    }
  }

  const earned = winner !== null && maxDelta >= DUO_WR_DELTA_THRESHOLD;

  return {
    code: 'duo_de_choc',
    emoji: '⚡',
    title: 'Duo de Choc',
    subtitle: `WR 2v2 supérieur de ${DUO_WR_DELTA_THRESHOLD}%+ à la moyenne individuelle`,
    description:
      `Décerné à l'équipe (≥${DUO_MIN_MATCHES} matchs 2v2 comptabilisés) dont le win rate collectif ` +
      `dépasse d'au moins ${DUO_WR_DELTA_THRESHOLD} points de % la moyenne des win rates individuels ` +
      `en 1v1 de ses deux joueurs. Prouve une synergie exceptionnelle : le duo vaut mieux que la somme de ses membres.`,
    earned,
    teamId: earned ? winner!.id : null,
    teamName: earned ? winner!.name : null,
    player1Login: earned ? winner!.player1Login : null,
    player2Login: earned ? winner!.player2Login : null,
    teamElo: earned ? winner!.elo : null,
    value: earned
      ? `${winnerTeamWRPct}% WR (vs ${winnerAvgIndivWRPct}% indiv)`
      : '—',
  };
}
