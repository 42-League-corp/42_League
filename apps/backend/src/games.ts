import type { Prisma, User } from '@prisma/client';
import {
  GAME_IDS,
  applyGameElo,
  parseGameId,
  validateTournamentScore,
  type GameId,
} from '@42-league/shared';

// Ré-exports : `index.ts` n'importe la « connaissance jeu » que d'ici.
export { GAME_IDS, applyGameElo, parseGameId, validateTournamentScore };
export type { GameId };

/**
 * ─── Pont Prisma du Game Registry ────────────────────────────────────────────
 *
 * Mappe chaque discipline vers ses colonnes de stats sur le modèle `User`.
 * C'est le SEUL endroit du backend qui connaît les noms `eloSmash`, `eloChess`,
 * etc. Quand on normalisera ces colonnes en table `PlayerGameStat`, seule cette
 * couche changera — les appelants (leaderboard, settle, tournois) restent stables.
 */
interface RatingColumns {
  elo: 'elo' | 'eloSmash' | 'eloChess' | 'eloSf';
  matchesPlayed: 'matchesPlayed' | 'matchesPlayedSmash' | 'matchesPlayedChess' | 'matchesPlayedSf';
  tournamentsWon: 'tournamentsWon' | 'tournamentsWonSmash' | 'tournamentsWonChess' | 'tournamentsWonSf';
}

const COLUMNS: Record<GameId, RatingColumns> = {
  babyfoot: { elo: 'elo', matchesPlayed: 'matchesPlayed', tournamentsWon: 'tournamentsWon' },
  smash: {
    elo: 'eloSmash',
    matchesPlayed: 'matchesPlayedSmash',
    tournamentsWon: 'tournamentsWonSmash',
  },
  chess: {
    elo: 'eloChess',
    matchesPlayed: 'matchesPlayedChess',
    tournamentsWon: 'tournamentsWonChess',
  },
  streetfighter: {
    elo: 'eloSf',
    matchesPlayed: 'matchesPlayedSf',
    tournamentsWon: 'tournamentsWonSf',
  },
};

/** Champs du `User` nécessaires à la lecture des stats par discipline (toutes les colonnes par-jeu). */
type RatingFields = Pick<User, RatingColumns[keyof RatingColumns]>;

/** Rating Elo courant du joueur pour une discipline. */
export function readElo(user: RatingFields, game: GameId): number {
  return user[COLUMNS[game].elo];
}

/** Stats unifiées d'un joueur pour une discipline (clés indépendantes du jeu). */
export function projectStats(
  user: RatingFields,
  game: GameId,
): { elo: number; matchesPlayed: number; tournamentsWon: number } {
  const c = COLUMNS[game];
  return {
    elo: user[c.elo],
    matchesPlayed: user[c.matchesPlayed],
    tournamentsWon: user[c.tournamentsWon],
  };
}

/** `orderBy` Prisma pour classer sur l'Elo de la discipline. */
export function eloOrderBy(game: GameId): Prisma.UserOrderByWithRelationInput {
  return { [COLUMNS[game].elo]: 'desc' } as Prisma.UserOrderByWithRelationInput;
}

/**
 * Fragment d'update Prisma : pose le nouvel Elo de la discipline et (par défaut)
 * incrémente son compteur de matchs joués.
 */
export function ratingUpdate(
  game: GameId,
  newElo: number,
  incrementMatches = true,
): Prisma.UserUpdateInput {
  const c = COLUMNS[game];
  const data: Record<string, unknown> = { [c.elo]: newElo };
  if (incrementMatches) data[c.matchesPlayed] = { increment: 1 };
  return data as Prisma.UserUpdateInput;
}

/** Fragment d'update Prisma : ajuste le compteur de tournois gagnés (±1) de la discipline. */
export function tournamentsWonDelta(game: GameId, delta: number): Prisma.UserUpdateInput {
  return { [COLUMNS[game].tournamentsWon]: { increment: delta } } as Prisma.UserUpdateInput;
}
