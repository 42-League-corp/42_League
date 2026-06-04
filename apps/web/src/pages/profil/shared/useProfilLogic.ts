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
  /** Login de l'adversaire qui a brisé la plus longue série de victoires (null si record en cours). */
  streakBrokenBy: string | null;
  /** Date ISO du match qui a brisé la plus longue série (null si record en cours). */
  streakBrokenAt: string | null;
  /** true si la plus longue série de victoires est encore en cours (jamais brisée). */
  streakOngoing: boolean;
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
  streakBrokenBy: null,
  streakBrokenAt: null,
  streakOngoing: false,
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

    // Pass 3 : qui a brisé la plus longue série de victoires (et quand).
    // On itère dans l'ordre chronologique (du plus ancien au plus récent) sur une
    // copie dédiée, pour ne pas perturber les passes ci-dessus qui travaillent en
    // newest-first. On retient la 1re série maximale et, pour celle-ci, le 1er match
    // perdu qui l'a stoppée. Si la série maximale est la dernière séquence et n'a
    // jamais été suivie d'une défaite → record toujours en cours (pas de breaker).
    const chrono = [...mine].reverse();
    let streakBrokenBy: string | null = null;
    let streakBrokenAt: string | null = null;
    let streakOngoing = false;
    if (longestWinStreak > 0) {
      let run = 0;
      let bestRun = 0;
      let breaker: PlayedMatch | null = null; // match perdu qui a brisé la meilleure série
      for (const m of chrono) {
        const youAreA = m.playerALogin === myLogin;
        const youWon = (youAreA && m.winner === 'A') || (!youAreA && m.winner === 'B');
        if (youWon) {
          run++;
        } else {
          // Une défaite : si la série qui vient de s'achever est la nouvelle meilleure
          // (strictement, pour garder la 1re occurrence en cas d'égalité), on note le
          // match qui l'a brisée — c'est ce match perdu (m).
          if (run > bestRun) {
            bestRun = run;
            breaker = m;
          }
          run = 0;
        }
      }
      // À la fin, si la série courante (non clôturée par une défaite) est strictement
      // la meilleure, c'est qu'elle est toujours en cours → pas de breaker.
      if (run > bestRun) {
        streakOngoing = true;
        breaker = null;
      }
      if (!streakOngoing && breaker) {
        const youAreA = breaker.playerALogin === myLogin;
        streakBrokenBy = youAreA ? breaker.playerBLogin : breaker.playerALogin;
        streakBrokenAt = breaker.playedAt;
      }
    }

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
        streakBrokenBy,
        streakBrokenAt,
        streakOngoing,
      },
      recentMatches: mine.slice(0, 10),
    };
  }, [me, myLogin, matches, game]);

  return { myLogin, ...data };
}
