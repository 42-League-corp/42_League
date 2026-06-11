// Le moteur de trophées vit désormais dans @42-league/shared (calcul PUR, partagé
// avec le backend pour le podium des revenus passifs). Ce module ré-exporte ce dont
// le front a besoin et conserve un `GameBoards` typé sur le LeaderboardEntry front
// (plus riche que le TrophyUser structurel du moteur partagé).
import type { Game, LeaderboardEntry } from './api';

export { computeTrophies, computeMixTrophies, trophyCountsByLogin } from '@42-league/shared';
export type { TrophyResult, TrophyColor, TrophyMatch, TrophyUser } from '@42-league/shared';

/** Classements par discipline (LeaderboardEntry front). */
export type GameBoards = Partial<Record<Game, LeaderboardEntry[]>>;
