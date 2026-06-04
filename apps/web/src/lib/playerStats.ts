import type { PlayedMatch } from './api';

/** Issue d'un match du point de vue d'un joueur donné. */
export type Outcome = 'win' | 'loss' | 'draw';

/**
 * Issue d'un match (V / N / D) pour `login`. Source de vérité partagée par tous
 * les compteurs front : un nul (`winner === 'draw'`, échecs) n'est ni V ni D.
 */
export function outcomeFor(m: PlayedMatch, login: string): Outcome {
  if (m.winner === 'draw') return 'draw';
  const isA = m.playerALogin === login;
  return (isA && m.winner === 'A') || (!isA && m.winner === 'B') ? 'win' : 'loss';
}

/** Un match récent vu du point de vue d'un joueur donné. */
export interface RecentMatch {
  won: boolean;
  /** Match nul (échecs) — ni victoire ni défaite. */
  draw?: boolean;
  scoreFor: number;
  scoreAgainst: number;
  opponent: string;
  at: string;
}

export interface PlayerStats {
  wins: number;
  losses: number;
  /** Nuls (échecs) — exclus du win-rate. */
  draws: number;
  games: number;
  /** 0–100 */
  winRate: number;
  /** Série en cours : positif = victoires consécutives, négatif = défaites. */
  streak: number;
  /** Plus longue série de victoires consécutives (>= 0). */
  maxWinStreak: number;
  /** Plus longue série de défaites consécutives (>= 0). */
  maxLossStreak: number;
  /** Derniers matchs (plus récent d'abord). */
  recent: RecentMatch[];
}

/**
 * Calcule les stats d'un joueur (V/D, win rate, série, derniers matchs) à partir
 * de la liste globale des matchs joués. Utilisé par la hover-card et la vue H2H.
 *
 * @param recentCount nombre de matchs récents à retourner (défaut 3).
 */
export function computePlayerStats(
  login: string,
  matches: PlayedMatch[],
  recentCount = 3,
): PlayerStats {
  // Plus récent d'abord pour la série + les derniers matchs.
  const mine = matches
    .filter((m) => m.playerALogin === login || m.playerBLogin === login)
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

  let wins = 0;
  let losses = 0;
  let draws = 0;
  // Plus longues séries (V et D) sur tout l'historique.
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let runWins = 0;
  let runLosses = 0;
  const recent: RecentMatch[] = [];
  for (const m of mine) {
    const isA = m.playerALogin === login;
    const outcome = outcomeFor(m, login);
    if (outcome === 'win') {
      wins++;
      runWins++;
      runLosses = 0;
      if (runWins > maxWinStreak) maxWinStreak = runWins;
    } else if (outcome === 'loss') {
      losses++;
      runLosses++;
      runWins = 0;
      if (runLosses > maxLossStreak) maxLossStreak = runLosses;
    } else {
      // Nulle : casse les deux séries, ne compte ni en V ni en D.
      draws++;
      runWins = 0;
      runLosses = 0;
    }
    if (recent.length < recentCount) {
      recent.push({
        won: outcome === 'win',
        draw: outcome === 'draw',
        scoreFor: isA ? m.scoreA : m.scoreB,
        scoreAgainst: isA ? m.scoreB : m.scoreA,
        opponent: isA ? m.playerBLogin : m.playerALogin,
        at: m.playedAt,
      });
    }
  }

  // Win-rate sur les parties décisives uniquement (les nuls n'y entrent pas).
  const games = wins + losses;
  const winRate = games === 0 ? 0 : Math.round((wins / games) * 100);

  // Série en cours, calculée depuis le match le plus récent. Un nul l'interrompt.
  let streak = 0;
  const first = mine[0];
  if (first) {
    const firstOutcome = outcomeFor(first, login);
    if (firstOutcome !== 'draw') {
      for (const m of mine) {
        if (outcomeFor(m, login) === firstOutcome) streak++;
        else break;
      }
      if (firstOutcome === 'loss') streak = -streak;
    }
  }

  return { wins, losses, draws, games, winRate, streak, maxWinStreak, maxLossStreak, recent };
}
