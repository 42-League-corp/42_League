import { useMemo } from 'react';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { useGameMode } from '../../../hooks/useGameMode';
import type { PlayedMatch } from '../../../lib/api';

/** Une de mes games, enrichie de son impact ELO et win-rate. */
export interface MyMatchStat {
  match: PlayedMatch;
  won: boolean;
  opponent: string;
  myScore: number;
  oppScore: number;
  /** Variation d'ELO pour moi sur cette game. */
  delta: number;
  counted: boolean;
  /** Win-rate cumulé (%) juste après cette game. */
  wrAfter: number;
  /** Variation du win-rate (points de %) provoquée par cette game (signée). */
  wrImpact: number;
}

export interface HistoriqueData {
  myLogin: string | undefined;
  /** Toutes les games de la league, plus récentes d'abord. */
  global: PlayedMatch[];
  /** Mes games, plus récentes d'abord, enrichies des impacts. */
  mine: MyMatchStat[];
  refresh: () => Promise<void>;
}

/**
 * Logique de la page Historique — sépare l'historique global du babyfoot de
 * mon historique perso, et calcule pour chacune de mes games l'impact ELO
 * (déjà fourni par l'API) ainsi que l'impact sur mon win-rate (calculé en
 * rejouant mes games dans l'ordre chronologique).
 */
export function useHistoriqueLogic(): HistoriqueData {
  const { matches: allMatches, me, refresh } = useLeagueData();
  const { game } = useGameMode();
  const myLogin = me?.login;
  // Historique filtré par discipline (mode courant).
  const matches = useMemo(
    () => allMatches.filter((m) => (m.game ?? 'babyfoot') === game),
    [allMatches, game],
  );

  const global = useMemo(
    () => [...matches].sort((a, b) => +new Date(b.playedAt) - +new Date(a.playedAt)),
    [matches],
  );

  const mine = useMemo<MyMatchStat[]>(() => {
    if (!myLogin) return [];
    const asc = matches
      .filter((m) => m.playerALogin === myLogin || m.playerBLogin === myLogin)
      .sort((a, b) => +new Date(a.playedAt) - +new Date(b.playedAt));

    let wins = 0;
    const stats: MyMatchStat[] = asc.map((m, i) => {
      const youAreA = m.playerALogin === myLogin;
      const won = (youAreA && m.winner === 'A') || (!youAreA && m.winner === 'B');
      const wrBefore = i === 0 ? 0 : (wins / i) * 100;
      if (won) wins++;
      const wrAfter = (wins / (i + 1)) * 100;
      return {
        match: m,
        won,
        opponent: youAreA ? m.playerBLogin : m.playerALogin,
        myScore: youAreA ? m.scoreA : m.scoreB,
        oppScore: youAreA ? m.scoreB : m.scoreA,
        delta: youAreA ? m.deltaA : m.deltaB,
        counted: m.countedForElo,
        wrAfter: Math.round(wrAfter),
        wrImpact: wrAfter - wrBefore,
      };
    });

    return stats.reverse();
  }, [matches, myLogin]);

  return { myLogin, global, mine, refresh };
}
