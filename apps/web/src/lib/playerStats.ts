import type { PlayedMatch } from './api';

/** Un match récent vu du point de vue d'un joueur donné. */
export interface RecentMatch {
  won: boolean;
  scoreFor: number;
  scoreAgainst: number;
  opponent: string;
  at: string;
}

export interface PlayerStats {
  wins: number;
  losses: number;
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
  // Plus longues séries (V et D) sur tout l'historique.
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let runWins = 0;
  let runLosses = 0;
  const recent: RecentMatch[] = [];
  for (const m of mine) {
    const isA = m.playerALogin === login;
    const won = (isA && m.winner === 'A') || (!isA && m.winner === 'B');
    if (won) {
      wins++;
      runWins++;
      runLosses = 0;
      if (runWins > maxWinStreak) maxWinStreak = runWins;
    } else {
      losses++;
      runLosses++;
      runWins = 0;
      if (runLosses > maxLossStreak) maxLossStreak = runLosses;
    }
    if (recent.length < recentCount) {
      recent.push({
        won,
        scoreFor: isA ? m.scoreA : m.scoreB,
        scoreAgainst: isA ? m.scoreB : m.scoreA,
        opponent: isA ? m.playerBLogin : m.playerALogin,
        at: m.playedAt,
      });
    }
  }

  const games = wins + losses;
  const winRate = games === 0 ? 0 : Math.round((wins / games) * 100);

  // Série en cours, calculée depuis le match le plus récent.
  let streak = 0;
  const first = mine[0];
  if (first) {
    const firstIsA = first.playerALogin === login;
    const firstWon = (firstIsA && first.winner === 'A') || (!firstIsA && first.winner === 'B');
    for (const m of mine) {
      const isA = m.playerALogin === login;
      const won = (isA && m.winner === 'A') || (!isA && m.winner === 'B');
      if (won === firstWon) streak++;
      else break;
    }
    if (!firstWon) streak = -streak;
  }

  return { wins, losses, games, winRate, streak, maxWinStreak, maxLossStreak, recent };
}
