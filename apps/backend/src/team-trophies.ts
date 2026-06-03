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

// ─── Types publics ────────────────────────────────────────────────────────────

export type TeamTrophyCode = 'carry' | 'duo_de_choc';

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
  return Promise.all([
    computeCarryTrophy(prisma),
    computeDuoDeChocTrophy(prisma),
  ]);
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
