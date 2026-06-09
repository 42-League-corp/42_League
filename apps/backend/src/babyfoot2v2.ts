import type { Prisma } from '@prisma/client';
import {
  calculateBabyfootElo,
  calculateTeamElo,
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
  /** BabyfootTeam.elo courant (Calcul A — entité duo). */
  teamElo: number;
  /** ELO personnel 2v2 de p1 (Calcul B — colonne `eloBabyfoot2v2`). */
  p1Elo: number;
  /** ELO personnel 2v2 de p2 (Calcul B — colonne `eloBabyfoot2v2`). */
  p2Elo: number;
}

// ─── Settlement complet d'un match 2v2 ──────────────────────────────────────

export interface Settle2v2Input {
  /** Résultat du match du point de vue de l'équipe A (déclarant + partner1). */
  winner: Winner;
  /** Score de l'équipe A (orienté déclarant) — alimente le bonus de marge 1v1. */
  scoreA: number;
  /** Score de l'équipe B. */
  scoreB: number;
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
 *   1. Calcul A (équipes) — `calculateTeamElo` sur l'ELO des entités BabyfootTeam.
 *   2. Calcul B (individuel) — MÊME formule que le Babyfoot 1v1
 *      (`calculateBabyfootElo`, marge + upset), mais chaque camp entre dans la
 *      formule avec la MOYENNE des deux ELO 2v2 de ses coéquipiers. Le delta
 *      résultant s'applique aux DEUX joueurs du camp (gain/perte commun au duo).
 *   3. Mise à jour de la colonne `eloBabyfoot2v2` (rating 2v2 DISTINCT du 1v1) et
 *      du compteur `matchesPlayed2v2` des 4 joueurs. L'ELO 1v1 (`elo`) n'est PAS
 *      touché par un match 2v2 (et inversement).
 *
 * Renvoie tous les deltas pour les stocker dans `PlayedMatch` (les deux joueurs
 * d'un même camp partagent le delta du camp : deltaA1 = deltaA2, deltaB1 = deltaB2).
 */
export async function applyElo2v2(
  tx: Prisma.TransactionClient,
  input: Settle2v2Input,
): Promise<Settle2v2Result> {
  const { winner, scoreA, scoreB, sideA, sideB } = input;

  // ── Calcul A : entités BabyfootTeam (échelle de duo persistante). ──────────
  const team = calculateTeamElo(sideA.teamElo, sideB.teamElo, winner);

  // ── Calcul B : ELO 2v2 individuel, formule 1v1 sur la MOYENNE de chaque duo. ─
  const avgA = (sideA.p1Elo + sideA.p2Elo) / 2;
  const avgB = (sideB.p1Elo + sideB.p2Elo) / 2;
  const indiv = calculateBabyfootElo(avgA, avgB, winner, scoreA, scoreB);
  // Le delta du camp s'applique tel quel à ses deux joueurs.
  const dA = indiv.deltaA;
  const dB = indiv.deltaB;

  // Mise à jour des ELO des entités BabyfootTeam.
  await Promise.all([
    tx.babyfootTeam.update({ where: { id: sideA.teamId }, data: { elo: team.newA } }),
    tx.babyfootTeam.update({ where: { id: sideB.teamId }, data: { elo: team.newB } }),
  ]);

  // Mise à jour des ELO 2v2 personnels + compteur de matchs 2v2 des 4 joueurs.
  await Promise.all([
    tx.user.update({
      where: { login: sideA.p1Login },
      data: { eloBabyfoot2v2: sideA.p1Elo + dA, matchesPlayed2v2: { increment: 1 } },
    }),
    tx.user.update({
      where: { login: sideA.p2Login },
      data: { eloBabyfoot2v2: sideA.p2Elo + dA, matchesPlayed2v2: { increment: 1 } },
    }),
    tx.user.update({
      where: { login: sideB.p1Login },
      data: { eloBabyfoot2v2: sideB.p1Elo + dB, matchesPlayed2v2: { increment: 1 } },
    }),
    tx.user.update({
      where: { login: sideB.p2Login },
      data: { eloBabyfoot2v2: sideB.p2Elo + dB, matchesPlayed2v2: { increment: 1 } },
    }),
  ]);

  return {
    team: {
      newTeamAElo: team.newA,
      newTeamBElo: team.newB,
      deltaA: team.deltaA,
      deltaB: team.deltaB,
    },
    individual: {
      newEloA1: sideA.p1Elo + dA, deltaA1: dA,
      newEloA2: sideA.p2Elo + dA, deltaA2: dA,
      newEloB1: sideB.p1Elo + dB, deltaB1: dB,
      newEloB2: sideB.p2Elo + dB, deltaB2: dB,
    },
  };
}
