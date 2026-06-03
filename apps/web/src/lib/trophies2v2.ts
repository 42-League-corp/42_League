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

// ─── Types ────────────────────────────────────────────────────────────────────

export type TeamTrophyCode = 'carry' | 'duo_de_choc';

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
    computeCarryTrophy(teams, leaderboard),
    computeDuoDeChocTrophy(teams, matches),
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

// ─── Helpers d'affichage ─────────────────────────────────────────────────────

/** Nom d'affichage d'une équipe : nom personnalisé ou "P1 & P2". */
export function teamDisplayName(winner: TeamTrophyWinner): string {
  return winner.name ?? `${winner.player1Login} & ${winner.player2Login}`;
}

/** true si l'équipe donnée (par ID) détient ce trophée. */
export function teamHasTrophy(trophy: TeamTrophyResult, teamId: string): boolean {
  return trophy.earned && trophy.winner?.id === teamId;
}
