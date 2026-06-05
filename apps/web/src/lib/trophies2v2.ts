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
const DREAM_TEAM_MIN_MATCHES = 3; // matchs 2v2 mini pour "La Dream Team" (plus gros ELO cumulé)
const ODD_COUPLE_MIN_MATCHES = 5; // matchs 2v2 mini pour "Le Couple Improbable"
const ODD_COUPLE_MAX_SOLO_WR = 0.5; // chaque joueur doit être SOUS 50% de WR en solo (1v1)
const WOODEN_SPOON_MIN_MATCHES = 8; // matchs 2v2 mini pour "La Cuillère de Bois" (pire WR)
const MONTAGNES_MIN_MATCHES = 6; // matchs 2v2 mini pour "Les Montagnes Russes" (alternances)
const ROULEAU_MIN_WINS = 5; // victoires 2v2 mini pour "Le Rouleau Compresseur" (écart moyen)
const SANGFROID_MIN_CLOSEWINS = 3; // victoires à 1 but mini pour "Sang-Froid"
const BOURREAUX_MIN_UPSETS = 3; // upsets mini pour "Les Bourreaux"

// ─── Types ────────────────────────────────────────────────────────────────────

export type TeamTrophyCode =
  | 'carry'
  | 'duo_de_choc'
  | 'sommet'
  | 'machine_de_guerre'
  | 'muraille'
  | 'increvables'
  | 'jumeaux'
  | 'invaincus'
  | 'dream_team'
  | 'odd_couple'
  | 'wooden_spoon'
  | 'montagnes_russes'
  | 'rouleau'
  | 'sang_froid'
  | 'bourreaux';

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
  const agg = aggregateTeam2v2(teams, matches);
  return [
    computeSommetTrophy(teams),
    computeMachineTrophy(teams),
    computeMurailleTrophy(teams),
    computeDuoDeChocTrophy(teams, matches),
    computeCarryTrophy(teams, leaderboard),
    computeIncrevablesTrophy(teams),
    computeJumeauxTrophy(teams, leaderboard),
    computeInvaincusTrophy(teams),
    computeDreamTeamTrophy(teams, leaderboard),
    computeOddCoupleTrophy(teams, matches),
    computeWoodenSpoonTrophy(teams),
    computeMontagnesRussesTrophy(teams, agg),
    computeRouleauTrophy(teams, agg),
    computeSangFroidTrophy(teams, agg),
    computeBourreauxTrophy(teams, agg),
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

// ─── Trophée 9 : La Dream Team ────────────────────────────────────────────────

/**
 * Duo « stické » : la plus grosse somme d'ELO individuel des deux joueurs.
 * Deux pointures qui s'allient — distinct du Sommet (ELO 2v2 de l'équipe) et
 * du Carry (écart entre les deux) : ici c'est la puissance brute cumulée.
 */
function computeDreamTeamTrophy(
  teams: TeamTrophyWinner[],
  leaderboard: LeaderboardEntry[],
): TeamTrophyResult {
  const eloByLogin = new Map(leaderboard.map((u) => [u.login, u.elo]));

  let winner: TeamTrophyWinner | null = null;
  let maxSum = -Infinity;

  for (const team of teams) {
    if (team.wins + team.losses < DREAM_TEAM_MIN_MATCHES) continue;
    const sum =
      (eloByLogin.get(team.player1Login) ?? 1000) + (eloByLogin.get(team.player2Login) ?? 1000);
    if (sum > maxSum) {
      maxSum = sum;
      winner = team;
    }
  }

  const earned = winner !== null;

  return {
    code: 'dream_team',
    emoji: '🌟',
    title: 'La Dream Team',
    subtitle: 'Le plus gros ELO individuel cumulé',
    description:
      `Décerné au duo (≥${DREAM_TEAM_MIN_MATCHES} matchs 2v2) dont la somme des ELO individuels de ses ` +
      `deux joueurs est la plus élevée. Deux pointures qui unissent leurs forces : sur le papier, ` +
      `personne ne devrait leur résister.`,
    color: 'violet',
    earned,
    winner: earned ? winner : null,
    value: earned ? `${maxSum} ELO cumulé` : '—',
    hint: `≥${DREAM_TEAM_MIN_MATCHES} matchs, plus gros ELO cumulé`,
  };
}

// ─── Trophée 10 : Le Couple Improbable (Odd Couple) ───────────────────────────

/**
 * « Odd Couple » : les DEUX joueurs sont sous 50 % de WR en 1v1 (nuls séparément),
 * mais le duo gagne plus souvent que chacun ne gagne seul. La preuve que 1 + 1 > 2 :
 * pris à part on ne miserait pas un kopeck sur eux, ensemble ils renversent la table.
 * On couronne le duo dont l'écart "à deux vs meilleur des deux en solo" est le plus grand.
 */
function computeOddCoupleTrophy(
  teams: TeamTrophyWinner[],
  matches: PlayedMatch[],
): TeamTrophyResult {
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

  // WR solo seulement si le joueur a réellement un bilan 1v1 (sinon null → inéligible).
  const soloWR = (login: string): number | null => {
    const s = indivStats.get(login);
    return s && s.total > 0 ? s.wins / s.total : null;
  };

  let winner: TeamTrophyWinner | null = null;
  let bestOverperf = 0;
  let wTeamPct = 0;
  let wSolo1Pct = 0;
  let wSolo2Pct = 0;

  for (const team of teams) {
    const total = team.wins + team.losses;
    if (total < ODD_COUPLE_MIN_MATCHES) continue;

    const wr1 = soloWR(team.player1Login);
    const wr2 = soloWR(team.player2Login);
    if (wr1 === null || wr2 === null) continue; // besoin d'un vrai bilan solo pour les deux
    if (wr1 >= ODD_COUPLE_MAX_SOLO_WR || wr2 >= ODD_COUPLE_MAX_SOLO_WR) continue; // nuls séparément

    const teamWR = team.wins / total;
    if (teamWR <= wr1 || teamWR <= wr2) continue; // strictement meilleurs à deux que chacun seul

    const overperf = teamWR - Math.max(wr1, wr2);
    if (overperf > bestOverperf) {
      bestOverperf = overperf;
      winner = team;
      wTeamPct = Math.round(teamWR * 100);
      wSolo1Pct = Math.round(wr1 * 100);
      wSolo2Pct = Math.round(wr2 * 100);
    }
  }

  const earned = winner !== null;

  return {
    code: 'odd_couple',
    emoji: '🃏',
    title: 'Le Couple Improbable',
    subtitle: 'Nuls séparément, redoutables ensemble',
    description:
      `Décerné au duo (≥${ODD_COUPLE_MIN_MATCHES} matchs 2v2) dont les DEUX joueurs ont un win rate ` +
      `individuel sous les 50 % en 1v1, mais qui gagnent plus souvent à deux que chacun ne gagne seul. ` +
      `Pris séparément on ne miserait pas un kopeck sur eux ; ensemble, ils renversent la table. ` +
      `La pure magie de l'alchimie.`,
    color: 'green',
    earned,
    winner: earned ? winner : null,
    value: earned ? `${wTeamPct}% à deux (vs ${wSolo1Pct}% / ${wSolo2Pct}% solo)` : '—',
    hint: '2 joueurs <50% solo, meilleur WR à deux',
  };
}

// ─── Trophée 11 : La Cuillère de Bois (Wooden Spoon) ──────────────────────────

/**
 * Le pire win rate 2v2 de la ligue (sur un volume minimal de matchs). La
 * distinction des perdants magnifiques : ils enchaînent les défaites mais
 * reviennent toujours. À WR égal, le plus de matchs (la souffrance la plus
 * longue) départage.
 */
function computeWoodenSpoonTrophy(teams: TeamTrophyWinner[]): TeamTrophyResult {
  let winner: TeamTrophyWinner | null = null;
  let worstWR = Infinity;
  let winnerWRPct = 0;

  for (const team of teams) {
    const total = team.wins + team.losses;
    if (total < WOODEN_SPOON_MIN_MATCHES) continue;

    const wr = team.wins / total;
    const better =
      wr < worstWR ||
      (wr === worstWR && winner !== null && total > winner.wins + winner.losses);
    if (better) {
      worstWR = wr;
      winner = team;
      winnerWRPct = Math.round(wr * 100);
    }
  }

  const earned = winner !== null;

  return {
    code: 'wooden_spoon',
    emoji: '🥄',
    title: 'La Cuillère de Bois',
    subtitle: 'Le pire win rate 2v2 de la ligue',
    description:
      `La distinction la plus chérie des perdants magnifiques : le plus faible pourcentage de victoires ` +
      `en 2v2, sur un minimum de ${WOODEN_SPOON_MIN_MATCHES} matchs. Ils enchaînent les défaites… ` +
      `mais reviennent toujours, le sourire aux lèvres. Respect.`,
    color: 'bronze',
    earned,
    winner: earned ? winner : null,
    value: earned ? `${winnerWRPct}% WR (${winner!.wins}V-${winner!.losses}D)` : '—',
    hint: `≥${WOODEN_SPOON_MIN_MATCHES} matchs, plus faible WR`,
  };
}

// ─── Agrégat détaillé des matchs 2v2 par équipe (scores, ordre, ELO adverse) ──

interface Team2v2Agg {
  /** Résultats chronologiques (true = victoire), triés par date croissante. */
  resultsChrono: boolean[];
  /** Écart de buts de chaque victoire (|score vainqueur − score perdant|). */
  winMargins: number[];
  /** Victoires à 1 but d'écart (matchs serrés). */
  closeWins: number;
  /** Victoires contre une équipe au meilleur ELO 2v2 courant (upsets). */
  upsetWins: number;
}

/**
 * Construit, pour chaque équipe, le détail de ses matchs 2v2 (mode='2v2',
 * comptabilisés). Mutualise un seul balayage de l'historique pour alimenter les
 * trophées « scénario » (alternances, écart de score, matchs serrés, upsets).
 * Miroir de `loadTeam2v2Details` côté backend.
 */
function aggregateTeam2v2(
  teams: TeamTrophyWinner[],
  matches: PlayedMatch[],
): Map<string, Team2v2Agg> {
  const eloById = new Map(teams.map((t) => [t.id, t.elo]));
  type Entry = { playedAt: string; won: boolean; margin: number; oppElo: number | null };
  const raw = new Map<string, Entry[]>();
  const push = (id: string, e: Entry) => {
    if (!raw.has(id)) raw.set(id, []);
    raw.get(id)!.push(e);
  };

  for (const m of matches) {
    if (m.mode !== '2v2' || m.countedForElo === false) continue;
    const aId = m.teamAId ?? null;
    const bId = m.teamBId ?? null;
    if (!aId || !bId) continue;
    const margin = Math.abs(m.scoreA - m.scoreB);
    if (eloById.has(aId)) {
      push(aId, { playedAt: m.playedAt, won: m.winner === 'A', margin, oppElo: eloById.get(bId) ?? null });
    }
    if (eloById.has(bId)) {
      push(bId, { playedAt: m.playedAt, won: m.winner === 'B', margin, oppElo: eloById.get(aId) ?? null });
    }
  }

  const out = new Map<string, Team2v2Agg>();
  for (const [id, list] of raw) {
    list.sort((x, y) => +new Date(x.playedAt) - +new Date(y.playedAt));
    const selfElo = eloById.get(id) ?? 1000;
    out.set(id, {
      resultsChrono: list.map((e) => e.won),
      winMargins: list.filter((e) => e.won).map((e) => e.margin),
      closeWins: list.filter((e) => e.won && e.margin === 1).length,
      upsetWins: list.filter((e) => e.won && e.oppElo !== null && e.oppElo > selfElo).length,
    });
  }
  return out;
}

// ─── Trophée 12 : Les Montagnes Russes ────────────────────────────────────────

/** Duo qui alterne le plus victoire/défaite d'un match à l'autre (imprévisible). */
function computeMontagnesRussesTrophy(
  teams: TeamTrophyWinner[],
  agg: Map<string, Team2v2Agg>,
): TeamTrophyResult {
  let winner: TeamTrophyWinner | null = null;
  let maxFlips = -1;

  for (const team of teams) {
    const a = agg.get(team.id);
    if (!a || a.resultsChrono.length < MONTAGNES_MIN_MATCHES) continue;
    let flips = 0;
    for (let i = 1; i < a.resultsChrono.length; i++) {
      if (a.resultsChrono[i] !== a.resultsChrono[i - 1]) flips++;
    }
    if (flips > maxFlips) {
      maxFlips = flips;
      winner = team;
    }
  }

  const earned = winner !== null && maxFlips > 0;

  return {
    code: 'montagnes_russes',
    emoji: '🎢',
    title: 'Les Montagnes Russes',
    subtitle: 'Le duo le plus imprévisible',
    description:
      `Décerné au duo (≥${MONTAGNES_MIN_MATCHES} matchs 2v2) qui alterne le plus souvent entre victoire ` +
      `et défaite d'un match à l'autre. Une partie ils marchent sur l'eau, la suivante ils coulent : ` +
      `impossible de deviner quelle version se présentera.`,
    color: 'magenta',
    earned,
    winner: earned ? winner : null,
    value: earned ? `${maxFlips} revirements` : '—',
    hint: `≥${MONTAGNES_MIN_MATCHES} matchs, max d'alternances V/D`,
  };
}

// ─── Trophée 13 : Le Rouleau Compresseur ──────────────────────────────────────

/** Duo aux victoires les plus écrasantes (plus gros écart de buts moyen en victoire). */
function computeRouleauTrophy(
  teams: TeamTrophyWinner[],
  agg: Map<string, Team2v2Agg>,
): TeamTrophyResult {
  let winner: TeamTrophyWinner | null = null;
  let bestAvg = -1;
  let winnerAvg = 0;

  for (const team of teams) {
    const a = agg.get(team.id);
    if (!a || a.winMargins.length < ROULEAU_MIN_WINS) continue;
    const avg = a.winMargins.reduce((s, x) => s + x, 0) / a.winMargins.length;
    if (avg > bestAvg) {
      bestAvg = avg;
      winner = team;
      winnerAvg = avg;
    }
  }

  const earned = winner !== null;

  return {
    code: 'rouleau',
    emoji: '🚜',
    title: 'Le Rouleau Compresseur',
    subtitle: 'Les victoires les plus écrasantes',
    description:
      `Décerné au duo (≥${ROULEAU_MIN_WINS} victoires 2v2) au plus gros écart de buts moyen dans ses ` +
      `victoires. Quand ils gagnent, ils ne font pas dans la dentelle : ils roulent sur l'adversaire.`,
    color: 'red',
    earned,
    winner: earned ? winner : null,
    value: earned ? `+${winnerAvg.toFixed(1)} buts/victoire` : '—',
    hint: `≥${ROULEAU_MIN_WINS} victoires, plus gros écart moyen`,
  };
}

// ─── Trophée 14 : Sang-Froid ──────────────────────────────────────────────────

/** Duo au plus grand nombre de victoires à 1 but d'écart (nerfs d'acier). */
function computeSangFroidTrophy(
  teams: TeamTrophyWinner[],
  agg: Map<string, Team2v2Agg>,
): TeamTrophyResult {
  let winner: TeamTrophyWinner | null = null;
  let maxClose = 0;

  for (const team of teams) {
    const a = agg.get(team.id);
    if (!a) continue;
    if (a.closeWins > maxClose) {
      maxClose = a.closeWins;
      winner = team;
    }
  }

  const earned = winner !== null && maxClose >= SANGFROID_MIN_CLOSEWINS;

  return {
    code: 'sang_froid',
    emoji: '🧊',
    title: 'Sang-Froid',
    subtitle: 'Le roi des fins de match serrées',
    description:
      `Pour le duo qui a remporté le plus de matchs 2v2 à un seul but d'écart. Quand tout se joue sur ` +
      `la dernière balle, ce sont eux qui gardent les nerfs et plient la partie. Minimum ${SANGFROID_MIN_CLOSEWINS} victoires serrées.`,
    color: 'cyan',
    earned,
    winner: earned ? winner : null,
    value: earned ? `${maxClose} victoires à 1 but` : '—',
    hint: `≥${SANGFROID_MIN_CLOSEWINS} victoires à 1 but d'écart`,
  };
}

// ─── Trophée 15 : Les Bourreaux ───────────────────────────────────────────────

/** Duo qui a fait tomber le plus d'équipes mieux classées qu'elles (upsets). */
function computeBourreauxTrophy(
  teams: TeamTrophyWinner[],
  agg: Map<string, Team2v2Agg>,
): TeamTrophyResult {
  let winner: TeamTrophyWinner | null = null;
  let maxUpsets = 0;

  for (const team of teams) {
    const a = agg.get(team.id);
    if (!a) continue;
    if (a.upsetWins > maxUpsets) {
      maxUpsets = a.upsetWins;
      winner = team;
    }
  }

  const earned = winner !== null && maxUpsets >= BOURREAUX_MIN_UPSETS;

  return {
    code: 'bourreaux',
    emoji: '😈',
    title: 'Les Bourreaux',
    subtitle: 'Tombeurs de plus forts qu’eux',
    description:
      `Récompense le duo qui a battu le plus d'équipes au meilleur ELO 2v2 que le sien. Les briseurs de ` +
      `hiérarchie : peu importe le favori en face, ils n'ont peur de personne. Minimum ${BOURREAUX_MIN_UPSETS} upsets.`,
    color: 'crimson',
    earned,
    winner: earned ? winner : null,
    value: earned ? `${maxUpsets} upsets` : '—',
    hint: `≥${BOURREAUX_MIN_UPSETS} victoires contre mieux classé`,
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
