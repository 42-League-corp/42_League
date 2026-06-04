/**
 * Calcul client-side des trophées d'équipe Babyfoot 2v2.
 *
 * Suit le même pattern que `trophies.ts` (calcul pur, pas d'appel API) :
 * les données sont déjà présentes dans le contexte (leaderboard, matches,
 * teams). Aucun état persistant — recalculé à chaque rendu de TrophiesSection.
 *
 * Miroir du service backend `team-trophies.ts` pour cohérence garantie.
 */

import type { BabyfootTeamEntry, LeaderboardEntry, PlayedMatch } from './api';
import type { TrophyColor } from './trophies';

// ─── Constantes (miroir du backend) ──────────────────────────────────────────

const CARRY_MIN_GAP = 100;
const DUO_MIN_MATCHES = 5;
const DUO_WR_DELTA_THRESHOLD = 20; // points de %
const SOMMET_MIN_MATCHES = 3; // matchs 2v2 mini pour figer le "Sommet"
const MACHINE_MIN_WINS = 8; // victoires 2v2 mini pour "Machine de Guerre"
const MURAILLE_MIN_MATCHES = 8; // matchs 2v2 mini pour "La Muraille"
const INCREVABLES_MIN_MATCHES = 12; // matchs 2v2 mini pour "Les Increvables"
const JUMEAUX_MIN_MATCHES = 6; // matchs 2v2 mini pour "Les Jumeaux" (duo le plus équilibré)
const INVAINCUS_MIN_WINS = 5; // victoires mini (0 défaite) pour "Les Invaincus"

// ─── Types ────────────────────────────────────────────────────────────────────

export type TeamTrophyCode =
  | 'carry'
  | 'duo_de_choc'
  | 'sommet'
  | 'machine_de_guerre'
  | 'muraille'
  | 'increvables'
  | 'jumeaux'
  | 'invaincus';

/** Équipe gagnante enrichie pour l'affichage (avatars dénormalisés). */
export interface TeamTrophyWinner extends BabyfootTeamEntry {
  player1ImageUrl?: string | null;
  player2ImageUrl?: string | null;
}

export interface TeamTrophyResult {
  code: TeamTrophyCode;
  emoji: string;
  title: string;
  subtitle: string;
  /** Texte affiché dans le tooltip. */
  description: string;
  color: TrophyColor;
  earned: boolean;
  winner: TeamTrophyWinner | null;
  /** Valeur chiffrée concise ("312 pts d'écart"). */
  value: string;
  /** Condition courte affichée en bas du badge ("min 100 pts d'écart"). */
  hint: string;
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

/**
 * Calcule les trophées 2v2 à partir des données déjà disponibles côté client.
 *
 * @param teams      Classement des équipes (enrichi avec avatars si possible).
 * @param leaderboard Classement individuel — fournit les ELO pour "Carry".
 * @param matches    Historique des matchs — fournit les WR 1v1 pour "Duo de Choc".
 */
export function computeTeamTrophies(
  teams: TeamTrophyWinner[],
  leaderboard: LeaderboardEntry[],
  matches: PlayedMatch[],
): TeamTrophyResult[] {
  return [
    computeSommetTrophy(teams),
    computeMachineTrophy(teams),
    computeMurailleTrophy(teams),
    computeDuoDeChocTrophy(teams, matches),
    computeCarryTrophy(teams, leaderboard),
    computeIncrevablesTrophy(teams),
    computeJumeauxTrophy(teams, leaderboard),
    computeInvaincusTrophy(teams),
  ];
}

// ─── Trophée 1 : Le Plus Gros Carry ──────────────────────────────────────────

function computeCarryTrophy(
  teams: TeamTrophyWinner[],
  leaderboard: LeaderboardEntry[],
): TeamTrophyResult {
  const eloByLogin = new Map(leaderboard.map((u) => [u.login, u.elo]));

  let winner: TeamTrophyWinner | null = null;
  let maxGap = 0;

  for (const team of teams) {
    const elo1 = eloByLogin.get(team.player1Login) ?? 1000;
    const elo2 = eloByLogin.get(team.player2Login) ?? 1000;
    const gap = Math.abs(elo1 - elo2);
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
      `Attribué à l'équipe dont l'écart d'ELO individuel entre ses deux joueurs est le plus important. ` +
      `Le joueur fort porte son coéquipier — c'est lui qui dicte le résultat.`,
    color: 'violet',
    earned,
    winner: earned ? winner : null,
    value: earned ? `${maxGap} pts d'écart` : '—',
    hint: `Écart min. ${CARRY_MIN_GAP} pts requis`,
  };
}

// ─── Trophée 2 : Duo de Choc ──────────────────────────────────────────────────

function computeDuoDeChocTrophy(
  teams: TeamTrophyWinner[],
  matches: PlayedMatch[],
): TeamTrophyResult {
  // Win rates individuels calculés uniquement sur les matchs 1v1 Babyfoot.
  // On exclut les matchs 2v2 en filtrant sur le champ `mode`.
  const onev1 = matches.filter(
    (m) => (m.game ?? 'babyfoot') === 'babyfoot' && (m as { mode?: string | null }).mode !== '2v2',
  );

  const indivStats = new Map<string, { wins: number; total: number }>();
  const ensure = (login: string) => {
    if (!indivStats.has(login)) indivStats.set(login, { wins: 0, total: 0 });
    return indivStats.get(login)!;
  };

  for (const m of onev1) {
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

  let winner: TeamTrophyWinner | null = null;
  let maxDelta = -Infinity;
  let winnerTeamWRPct = 0;
  let winnerAvgIndivWRPct = 0;

  for (const team of teams) {
    const total = team.wins + team.losses;
    if (total < DUO_MIN_MATCHES) continue;

    const teamWR = team.wins / total;
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
      `Décerné à l'équipe (≥${DUO_MIN_MATCHES} matchs 2v2) dont le win rate collectif ` +
      `dépasse d'au moins ${DUO_WR_DELTA_THRESHOLD} points de % la moyenne des win rates en 1v1 de ses deux membres. ` +
      `Prouve une synergie rare : le duo vaut bien plus que la somme de ses parties.`,
    color: 'gold',
    earned,
    winner: earned ? winner : null,
    value: earned
      ? `${winnerTeamWRPct}% WR (vs ${winnerAvgIndivWRPct}% indiv)`
      : '—',
    hint: `≥${DUO_MIN_MATCHES} matchs, +${DUO_WR_DELTA_THRESHOLD}% WR vs individuel`,
  };
}

// ─── Trophée 3 : Sommet ───────────────────────────────────────────────────────

/** Équipe avec l'ELO 2v2 le plus élevé (la mieux classée du tableau). */
function computeSommetTrophy(teams: TeamTrophyWinner[]): TeamTrophyResult {
  let winner: TeamTrophyWinner | null = null;
  let maxElo = -Infinity;

  for (const team of teams) {
    if (team.wins + team.losses < SOMMET_MIN_MATCHES) continue;
    if (team.elo > maxElo) {
      maxElo = team.elo;
      winner = team;
    }
  }

  const earned = winner !== null;

  return {
    code: 'sommet',
    emoji: '👑',
    title: 'Le Sommet',
    subtitle: 'Duo le mieux classé du Babyfoot 2v2',
    description:
      `Décerné à l'équipe au plus haut ELO 2v2 parmi tous les duos ayant disputé ` +
      `au moins ${SOMMET_MIN_MATCHES} matchs. C'est le duo n°1 du classement, le roi du terrain.`,
    color: 'cyan',
    earned,
    winner: earned ? winner : null,
    value: earned ? `${maxElo} ELO` : '—',
    hint: `≥${SOMMET_MIN_MATCHES} matchs 2v2 requis`,
  };
}

// ─── Trophée 4 : Machine de Guerre ────────────────────────────────────────────

/** Équipe totalisant le plus de victoires 2v2. */
function computeMachineTrophy(teams: TeamTrophyWinner[]): TeamTrophyResult {
  let winner: TeamTrophyWinner | null = null;
  let maxWins = 0;

  for (const team of teams) {
    if (team.wins > maxWins) {
      maxWins = team.wins;
      winner = team;
    }
  }

  const earned = winner !== null && maxWins >= MACHINE_MIN_WINS;

  return {
    code: 'machine_de_guerre',
    emoji: '⚔️',
    title: 'Machine de Guerre',
    subtitle: 'Le duo qui empile le plus de victoires',
    description:
      `Récompense l'équipe qui a remporté le plus de matchs 2v2 au total. ` +
      `La quantité brute de victoires, peu importe la manière : ces deux-là ne lâchent rien.`,
    color: 'red',
    earned,
    winner: earned ? winner : null,
    value: earned ? `${maxWins} victoires` : '—',
    hint: `≥${MACHINE_MIN_WINS} victoires 2v2 requises`,
  };
}

// ─── Trophée 5 : La Muraille ──────────────────────────────────────────────────

/** Équipe au meilleur win rate 2v2 (à partir d'un volume minimal de matchs). */
function computeMurailleTrophy(teams: TeamTrophyWinner[]): TeamTrophyResult {
  let winner: TeamTrophyWinner | null = null;
  let bestWR = -Infinity;
  let winnerWRPct = 0;

  for (const team of teams) {
    const total = team.wins + team.losses;
    if (total < MURAILLE_MIN_MATCHES) continue;

    const wr = team.wins / total;
    if (wr > bestWR) {
      bestWR = wr;
      winner = team;
      winnerWRPct = Math.round(wr * 100);
    }
  }

  const earned = winner !== null;

  return {
    code: 'muraille',
    emoji: '🛡️',
    title: 'La Muraille',
    subtitle: 'Meilleur win rate 2v2 de la ligue',
    description:
      `Attribué à l'équipe au plus haut pourcentage de victoires 2v2, sur un minimum de ` +
      `${MURAILLE_MIN_MATCHES} matchs. Une défense impénétrable doublée d'une efficacité redoutable.`,
    color: 'sapphire',
    earned,
    winner: earned ? winner : null,
    value: earned ? `${winnerWRPct}% WR (${winner!.wins}V-${winner!.losses}D)` : '—',
    hint: `≥${MURAILLE_MIN_MATCHES} matchs 2v2 requis`,
  };
}

// ─── Trophée 6 : Les Increvables ──────────────────────────────────────────────

/** Équipe ayant disputé le plus de matchs 2v2 (activité). */
function computeIncrevablesTrophy(teams: TeamTrophyWinner[]): TeamTrophyResult {
  let winner: TeamTrophyWinner | null = null;
  let maxTotal = 0;

  for (const team of teams) {
    const total = team.wins + team.losses;
    if (total > maxTotal) {
      maxTotal = total;
      winner = team;
    }
  }

  const earned = winner !== null && maxTotal >= INCREVABLES_MIN_MATCHES;

  return {
    code: 'increvables',
    emoji: '🔁',
    title: 'Les Increvables',
    subtitle: 'Le duo le plus actif sur la table',
    description:
      `Pour l'équipe qui a disputé le plus grand nombre de matchs 2v2. ` +
      `Toujours partants pour une partie : l'endurance avant tout.`,
    color: 'green',
    earned,
    winner: earned ? winner : null,
    value: earned ? `${maxTotal} matchs` : '—',
    hint: `≥${INCREVABLES_MIN_MATCHES} matchs 2v2 requis`,
  };
}

// ─── Trophée 7 : Les Jumeaux ──────────────────────────────────────────────────

/**
 * Duo le plus ÉQUILIBRÉ : plus petit écart d'ELO individuel entre les deux
 * joueurs (à partir d'un volume minimal de matchs). L'exact opposé du Carry —
 * ici les deux partenaires sont de force égale, la vraie symbiose.
 */
function computeJumeauxTrophy(
  teams: TeamTrophyWinner[],
  leaderboard: LeaderboardEntry[],
): TeamTrophyResult {
  const eloByLogin = new Map(leaderboard.map((u) => [u.login, u.elo]));

  let winner: TeamTrophyWinner | null = null;
  let minGap = Infinity;

  for (const team of teams) {
    if (team.wins + team.losses < JUMEAUX_MIN_MATCHES) continue;
    const elo1 = eloByLogin.get(team.player1Login) ?? 1000;
    const elo2 = eloByLogin.get(team.player2Login) ?? 1000;
    const gap = Math.abs(elo1 - elo2);
    if (gap < minGap) {
      minGap = gap;
      winner = team;
    }
  }

  const earned = winner !== null;

  return {
    code: 'jumeaux',
    emoji: '🪞',
    title: 'Les Jumeaux',
    subtitle: 'Le duo le plus équilibré de la ligue',
    description:
      `Décerné à l'équipe (≥${JUMEAUX_MIN_MATCHES} matchs 2v2) dont les deux joueurs ont l'ELO ` +
      `individuel le plus proche. Aucun ne porte l'autre : deux moitiés d'un même tout, ` +
      `parfaitement synchronisées. L'opposé du Carry.`,
    color: 'magenta',
    earned,
    winner: earned ? winner : null,
    value: earned ? `${minGap} pts d'écart` : '—',
    hint: `≥${JUMEAUX_MIN_MATCHES} matchs, plus petit écart d'ELO`,
  };
}

// ─── Trophée 8 : Les Invaincus ────────────────────────────────────────────────

/**
 * Duo encore jamais battu en 2v2 (0 défaite) avec un minimum de victoires.
 * Parmi les équipes invaincues, on couronne celle au plus grand nombre de wins.
 */
function computeInvaincusTrophy(teams: TeamTrophyWinner[]): TeamTrophyResult {
  let winner: TeamTrophyWinner | null = null;
  let maxWins = 0;

  for (const team of teams) {
    if (team.losses !== 0) continue;
    if (team.wins > maxWins) {
      maxWins = team.wins;
      winner = team;
    }
  }

  const earned = winner !== null && maxWins >= INVAINCUS_MIN_WINS;

  return {
    code: 'invaincus',
    emoji: '💎',
    title: 'Les Invaincus',
    subtitle: 'Duo encore jamais battu en 2v2',
    description:
      `Pour l'équipe qui n'a JAMAIS perdu un match 2v2, avec au moins ${INVAINCUS_MIN_WINS} victoires ` +
      `à son actif. Un parcours sans la moindre tache : tant que personne ne les fait tomber, ` +
      `le trophée est à eux.`,
    color: 'crimson',
    earned,
    winner: earned ? winner : null,
    value: earned ? `${maxWins}-0, invaincus` : '—',
    hint: `0 défaite, ≥${INVAINCUS_MIN_WINS} victoires`,
  };
}

// ─── Helpers d'affichage ─────────────────────────────────────────────────────

/** Nom d'affichage d'une équipe : nom personnalisé ou "P1 & P2". */
export function teamDisplayName(winner: TeamTrophyWinner): string {
  return winner.name ?? `${winner.player1Login} & ${winner.player2Login}`;
}

/** true si l'équipe donnée (par ID) détient ce trophée. */
export function teamHasTrophy(trophy: TeamTrophyResult, teamId: string): boolean {
  return trophy.earned && trophy.winner?.id === teamId;
}
