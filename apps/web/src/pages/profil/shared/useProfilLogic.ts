import { useMemo } from 'react';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { useGameMode } from '../../../hooks/useGameMode';
import { pickRating } from '../../../lib/gameStats';
import type { PlayedMatch } from '../../../lib/api';

export interface ProfilStats {
  elo: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  totalDelta: number;
  /** Delta ELO sur les 7 derniers jours. */
  delta7d: number;
  /** Plus longue série de victoires consécutives (record perso). */
  longestWinStreak: number;
  /** Série en cours (positive = wins, négative = losses). */
  currentStreak: number;
  /** Score "domination" : moyenne du score adverse sur les wins (plus c'est bas, plus on domine). */
  avgOpponentScoreOnWin: number;
}

export interface ProfilLogic {
  myLogin: string | undefined;
  stats: ProfilStats;
  recentMatches: PlayedMatch[];
}

const EMPTY_STATS: ProfilStats = {
  elo: 1000,
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  total: 0,
  winRate: 0,
  totalDelta: 0,
  delta7d: 0,
  longestWinStreak: 0,
  currentStreak: 0,
  avgOpponentScoreOnWin: 0,
};

export function useProfilLogic(): ProfilLogic {
  const { me, matches } = useLeagueData();
  const { game } = useGameMode();
  const myLogin = me?.login;

  const data = useMemo(() => {
    if (!me?.user || !myLogin) {
      return { stats: EMPTY_STATS, recentMatches: [] as PlayedMatch[] };
    }
    const mine = matches
      .filter(
        (m) =>
          (m.game ?? 'babyfoot') === game &&
          (m.playerALogin === myLogin || m.playerBLogin === myLogin),
      )
      .sort((a, b) => +new Date(b.playedAt) - +new Date(a.playedAt));

    let wins = 0;
    let losses = 0;
    let totalDelta = 0;
    let delta7d = 0;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    let longestWinStreak = 0;
    let runningWinStreak = 0;
    const opponentScoresOnWin: number[] = [];

    // Pass 1 : agrégats globaux (wins, losses, total delta, delta7d, longest streak).
    for (const m of mine) {
      const youAreA = m.playerALogin === myLogin;
      const youWon = (youAreA && m.winner === 'A') || (!youAreA && m.winner === 'B');
      const myDelta = youAreA ? m.deltaA : m.deltaB;

      if (youWon) wins++;
      else losses++;

      if (m.countedForElo) {
        totalDelta += myDelta;
        if (+new Date(m.playedAt) > sevenDaysAgo) {
          delta7d += myDelta;
        }
      }

      if (youWon) {
        runningWinStreak++;
        if (runningWinStreak > longestWinStreak) longestWinStreak = runningWinStreak;
        const oppScore = youAreA ? m.scoreB : m.scoreA;
        opponentScoresOnWin.push(oppScore);
      } else {
        runningWinStreak = 0;
      }
    }

    // Pass 2 : current streak signée — on s'arrête au premier changement de signe.
    // mine est trié du plus récent au plus ancien.
    let currentStreakLen = 0;
    let currentSign: 'win' | 'loss' | null = null;
    for (const m of mine) {
      const youAreA = m.playerALogin === myLogin;
      const youWon = (youAreA && m.winner === 'A') || (!youAreA && m.winner === 'B');
      const sign: 'win' | 'loss' = youWon ? 'win' : 'loss';
      if (currentSign === null) {
        currentSign = sign;
        currentStreakLen = 1;
      } else if (sign === currentSign) {
        currentStreakLen++;
      } else {
        break;
      }
    }
    const signedStreak = currentSign === 'loss' ? -currentStreakLen : currentStreakLen;

    const total = wins + losses;
    const winRate = total === 0 ? 0 : Math.round((wins / total) * 100);
    const avgOpponentScoreOnWin =
      opponentScoresOnWin.length === 0
        ? 0
        : Math.round(
            (opponentScoresOnWin.reduce((s, v) => s + v, 0) / opponentScoresOnWin.length) * 10,
          ) / 10;

    const rating = pickRating(me.user, game);
    return {
      stats: {
        elo: rating.elo,
        matchesPlayed: rating.matchesPlayed,
        wins,
        losses,
        total,
        winRate,
        totalDelta,
        delta7d,
        longestWinStreak,
        currentStreak: signedStreak,
        avgOpponentScoreOnWin,
      },
      recentMatches: mine.slice(0, 10),
    };
  }, [me, myLogin, matches, game]);

  return { myLogin, ...data };
}
