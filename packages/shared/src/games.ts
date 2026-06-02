import {
  calculateBabyfootElo,
  calculateChessElo,
  calculateSmashElo,
  type EloUpdate,
  type Winner,
} from './elo.js';
import type { Game } from './schemas.js';

/**
 * ─── Game Registry ───────────────────────────────────────────────────────────
 *
 * Source de vérité UNIQUE et partagée (front + back) décrivant chaque discipline.
 * Toute la logique « par jeu » (variation d'Elo, nature du score, présence de
 * nulle, rendu d'un résultat) est centralisée ici plutôt qu'éparpillée en
 * ternaires `isSmash ? … : isChess ? … : …`.
 *
 * 👉 Ajouter un jeu = ajouter UNE entrée à `GAMES` (+ sa fonction d'Elo dans
 *    elo.ts). Le cœur de l'application n'a pas à être touché.
 */

export type GameId = Game;

/** Nature du score d'une discipline. */
export type ScoringKind =
  | 'goals' // babyfoot : buts, un camp atteint 10
  | 'sets' // smash : games d'un set Bo3/Bo5
  | 'binary'; // échecs : victoire / défaite (/ nulle)

/**
 * Résultat brut d'un match, champs communs à toutes les disciplines. Les champs
 * optionnels ne concernent que certains jeux (smash : bestOf + vies du gagnant).
 */
export interface MatchOutcome {
  scoreA: number;
  scoreB: number;
  bestOf?: number | null;
  /** Vies (stocks) restantes du gagnant au game décisif — smash uniquement. */
  winnerStocks?: number | null;
}

/** Point de vue d'un joueur sur un résultat, pour l'affichage. */
export type Perspective = 'win' | 'loss' | 'draw';

export interface GameDef {
  id: GameId;
  /** Libellé affichable de la discipline. */
  label: string;
  /** Nature du score (pilote la saisie + l'affichage). */
  scoring: ScoringKind;
  /** La discipline autorise-t-elle la nulle ? (échecs) */
  hasDraw: boolean;
  /** Format de set par défaut (smash). */
  defaultBestOf?: number;
  /** Variation d'Elo de la discipline — signature uniforme, pilotée par le registry. */
  elo(ratingA: number, ratingB: number, winner: Winner, outcome: MatchOutcome): EloUpdate;
  /** Rendu court d'un score « du point de vue A » : "10-4" | "2-1" | "1-0" | "½-½". */
  formatScore(scoreA: number, scoreB: number): string;
  /** Libellé d'un résultat selon le point de vue (gagné / perdu / nul). */
  outcomeLabel(perspective: Perspective): string;
}

export const GAMES: Record<GameId, GameDef> = {
  babyfoot: {
    id: 'babyfoot',
    label: 'Babyfoot',
    scoring: 'goals',
    hasDraw: false,
    elo: (a, b, w, o) => calculateBabyfootElo(a, b, w, o.scoreA, o.scoreB),
    formatScore: (a, b) => `${a}-${b}`,
    outcomeLabel: (p) => (p === 'win' ? 'Victoire' : p === 'loss' ? 'Défaite' : 'Nul'),
  },
  smash: {
    id: 'smash',
    label: 'Smash',
    scoring: 'sets',
    hasDraw: false,
    defaultBestOf: 3,
    elo: (a, b, w, o) =>
      calculateSmashElo(a, b, w, o.scoreA, o.scoreB, o.bestOf ?? 3, o.winnerStocks ?? 1),
    formatScore: (a, b) => `${a}-${b}`,
    outcomeLabel: (p) => (p === 'win' ? 'Victoire' : p === 'loss' ? 'Défaite' : 'Nul'),
  },
  chess: {
    id: 'chess',
    label: 'Échecs',
    scoring: 'binary',
    hasDraw: true,
    elo: (a, b, w) => calculateChessElo(a, b, w),
    // Score binaire stocké 1-0 / 0-1 ; la nulle (futur) se rend "½-½".
    formatScore: (a, b) => (a === b ? '½-½' : a > b ? '1-0' : '0-1'),
    outcomeLabel: (p) => (p === 'win' ? 'Victoire' : p === 'loss' ? 'Défaite' : 'Nulle'),
  },
};

/** Toutes les disciplines, dans l'ordre d'affichage. */
export const GAME_IDS = Object.keys(GAMES) as GameId[];

/** Discipline par défaut (et valeur « legacy » des données antérieures au multi-jeu). */
export const DEFAULT_GAME: GameId = 'babyfoot';

/** Normalise une valeur quelconque en GameId (babyfoot par défaut). */
export function parseGameId(value: unknown): GameId {
  return value === 'smash' || value === 'chess' ? value : 'babyfoot';
}

/** Récupère la définition d'une discipline (retombe sur babyfoot si inconnue). */
export function getGameDef(game: GameId): GameDef {
  return GAMES[game] ?? GAMES.babyfoot;
}

/**
 * Variation d'Elo pilotée par le registry — point d'entrée unique, toutes
 * disciplines. Remplace le `isSmash ? calculateSmashElo : …` historique.
 */
export function applyGameElo(
  game: GameId,
  ratingA: number,
  ratingB: number,
  winner: Winner,
  outcome: MatchOutcome,
): EloUpdate {
  return getGameDef(game).elo(ratingA, ratingB, winner, outcome);
}
