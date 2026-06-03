import type { Game } from './api';

/**
 * Source minimale de stats par discipline. Structurel → compatible aussi bien
 * avec `MeResponse['user']` (mon profil) qu'avec `UserProfile['user']` (fiche
 * d'un autre joueur) : les deux exposent l'ELO global + les colonnes par-jeu.
 */
export interface RatingSource {
  elo: number;
  matchesPlayed: number;
  tournamentsWon: number;
  eloSmash?: number;
  matchesPlayedSmash?: number;
  tournamentsWonSmash?: number;
  eloChess?: number;
  matchesPlayedChess?: number;
  tournamentsWonChess?: number;
  eloSf?: number;
  matchesPlayedSf?: number;
  tournamentsWonSf?: number;
}

/** Rating + compteurs du joueur pour une discipline donnée. */
export function pickRating(
  user: RatingSource,
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
  if (game === 'streetfighter') {
    return {
      elo: user.eloSf ?? 1000,
      matchesPlayed: user.matchesPlayedSf ?? 0,
      tournamentsWon: user.tournamentsWonSf ?? 0,
    };
  }
  return {
    elo: user.elo,
    matchesPlayed: user.matchesPlayed,
    tournamentsWon: user.tournamentsWon,
  };
}
