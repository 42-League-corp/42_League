import type { Prisma } from '@prisma/client';
import {
  calculate2v2BabyfootElo,
  initTeamElo,
  type Winner,
} from '@42-league/shared';

// ─── Babyfoot 2v2 — utilitaires backend ──────────────────────────────────────
//
// Ce module est STRICTEMENT réservé au mode 2v2 du Babyfoot.
// Il ne doit pas être importé par des chemins de code smash / chess / 1v1.

// ─── Clé canonique d'un duo ──────────────────────────────────────────────────

/**
 * Renvoie les deux logins triés lexicographiquement.
 * Garantit que le duo (A, B) et le duo (B, A) produisent la même clé,
 * ce qui évite les doublons dans la table `babyfoot_teams`.
 */
export function canonicalTeamLogins(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// ─── Upsert silencieux d'un duo ──────────────────────────────────────────────

/**
 * Trouve ou crée silencieusement l'entité BabyfootTeam pour un duo.
 *
 * • Si la paire existe déjà → renvoie l'enregistrement existant sans toucher l'ELO.
 * • Si c'est un nouveau duo → crée l'enregistrement avec l'ELO pondéré (65/35).
 *
 * Les logins passés ne sont pas nécessairement triés ; la fonction les normalise.
 * Les ELO doivent correspondre aux mêmes logins dans le même ordre.
 *
 * À appeler DANS une transaction Prisma lors de la validation d'un match 2v2.
 */
export async function upsertBabyfootTeam(
  tx: Prisma.TransactionClient,
  loginA: string,
  eloA: number,
  loginB: string,
  eloB: number,
): Promise<{ id: string; elo: number }> {
  const [p1, p2] = canonicalTeamLogins(loginA, loginB);
  // Réordonne les ELO pour qu'ils correspondent aux logins canoniques.
  const elo1 = loginA === p1 ? eloA : eloB;
  const elo2 = loginA === p1 ? eloB : eloA;

  const existing = await tx.babyfootTeam.findUnique({
    where: { player1Login_player2Login: { player1Login: p1, player2Login: p2 } },
    select: { id: true, elo: true },
  });
  if (existing) return existing;

  const teamElo = initTeamElo(elo1, elo2);
  return tx.babyfootTeam.create({
    data: { player1Login: p1, player2Login: p2, elo: teamElo },
    select: { id: true, elo: true },
  });
}

// ─── Résolution des côtés A/B pour un match 2v2 ─────────────────────────────

export interface Players2v2 {
  declarerLogin: string;
  partner1Login: string; // coéquipier du déclarant
  opponentLogin: string;
  partner2Login: string; // coéquipier de l'adversaire
}

export interface Side2v2 {
  /** Login « premier » du côté (canoniquement le plus petit). */
  p1Login: string;
  /** Login « second » du côté. */
  p2Login: string;
  /** BabyfootTeam.id */
  teamId: string;
  /** BabyfootTeam.elo courant */
  teamElo: number;
  /** ELO personnel de p1 */
  p1Elo: number;
  /** ELO personnel de p2 */
  p2Elo: number;
}

// ─── Settlement complet d'un match 2v2 ──────────────────────────────────────

export interface Settle2v2Input {
  /** Résultat du match du point de vue de l'équipe A (déclarant + partner1). */
  winner: Winner;
  sideA: Side2v2;
  sideB: Side2v2;
}

export interface Settle2v2Result {
  /** Nouveaux ELO des entités BabyfootTeam. */
  team: { newTeamAElo: number; newTeamBElo: number; deltaA: number; deltaB: number };
  /** Nouveaux ELO individuels (p1/p2 de chaque côté). */
  individual: {
    newEloA1: number; deltaA1: number;
    newEloA2: number; deltaA2: number;
    newEloB1: number; deltaB1: number;
    newEloB2: number; deltaB2: number;
  };
}

/**
 * Calcule et applique les mises à jour ELO pour un match 2v2 de Babyfoot.
 *
 * Effectue dans la transaction :
 *   1. Calcul A (équipes) + Calcul B (individuel anti-carry).
 *   2. Mise à jour des ELO des BabyfootTeam.
 *   3. Mise à jour des ELO individuels (colonne `elo` du Babyfoot 1v1) des 4 joueurs.
 *      Le mode 2v2 partage la colonne `elo` du Babyfoot : un même joueur a un seul
 *      rating personnel Babyfoot qui reflète ses performances en 1v1 ET en 2v2.
 *
 * Renvoie tous les deltas pour les stocker dans `PlayedMatch`.
 */
export async function applyElo2v2(
  tx: Prisma.TransactionClient,
  input: Settle2v2Input,
): Promise<Settle2v2Result> {
  const { winner, sideA, sideB } = input;

  const result = calculate2v2BabyfootElo(
    { teamElo: sideA.teamElo, player1Elo: sideA.p1Elo, player2Elo: sideA.p2Elo },
    { teamElo: sideB.teamElo, player1Elo: sideB.p1Elo, player2Elo: sideB.p2Elo },
    winner,
  );

  const { team, individual } = result;

  // Mise à jour des ELO des entités BabyfootTeam.
  await Promise.all([
    tx.babyfootTeam.update({
      where: { id: sideA.teamId },
      data: { elo: team.newTeamAElo },
    }),
    tx.babyfootTeam.update({
      where: { id: sideB.teamId },
      data: { elo: team.newTeamBElo },
    }),
  ]);

  // Mise à jour des ELO personnels Babyfoot des 4 joueurs.
  // `matchesPlayed` est incrémenté pour chacun via le champ standard.
  await Promise.all([
    tx.user.update({
      where: { login: sideA.p1Login },
      data: { elo: individual.newEloA1, matchesPlayed: { increment: 1 } },
    }),
    tx.user.update({
      where: { login: sideA.p2Login },
      data: { elo: individual.newEloA2, matchesPlayed: { increment: 1 } },
    }),
    tx.user.update({
      where: { login: sideB.p1Login },
      data: { elo: individual.newEloB1, matchesPlayed: { increment: 1 } },
    }),
    tx.user.update({
      where: { login: sideB.p2Login },
      data: { elo: individual.newEloB2, matchesPlayed: { increment: 1 } },
    }),
  ]);

  return { team, individual };
}
