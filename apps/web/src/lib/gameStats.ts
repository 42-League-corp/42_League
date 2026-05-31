import type { Game, MeResponse } from './api';

type MeUser = NonNullable<MeResponse['user']>;

/** Rating + compteurs du joueur pour une discipline donnée. */
export function pickRating(
  user: MeUser,
  game: Game,
): { elo: number; matchesPlayed: number; tournamentsWon: number } {
  if (game === 'smash') {
    return {
      elo: user.eloSmash ?? 1000,
      matchesPlayed: user.matchesPlayedSmash ?? 0,
      tournamentsWon: user.tournamentsWonSmash ?? 0,
    };
  }
  if (game === 'chess') {
    return {
      elo: user.eloChess ?? 1000,
      matchesPlayed: user.matchesPlayedChess ?? 0,
      tournamentsWon: user.tournamentsWonChess ?? 0,
    };
  }
  return {
    elo: user.elo,
    matchesPlayed: user.matchesPlayed,
    tournamentsWon: user.tournamentsWon,
  };
}
