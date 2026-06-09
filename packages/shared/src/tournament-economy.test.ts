import { describe, it, expect } from 'vitest';
import {
  betMultiplier,
  betPayout,
  cashPrizeForRounds,
  tournamentEloReward,
  tournamentEloMax,
  TOURNAMENT_ELO_WINNER,
  TOURNAMENT_ELO_WINNER_OFFICIAL,
  TOURNAMENT_ELO_WINNER_FRIENDLY,
  DEFAULT_BET_FINAL_MULT,
} from './tournament-economy.js';

describe('betMultiplier', () => {
  it('0 tour franchi → 0 (mise perdue)', () => {
    expect(betMultiplier(0, 4, 2)).toBe(0);
  });

  it('champion → multiplicateur final exact', () => {
    expect(betMultiplier(4, 4, 2)).toBe(2);
    expect(betMultiplier(3, 3, 10)).toBe(10);
  });

  it('interpolation linéaire — bracket de 16 (4 tours), final ×2', () => {
    expect(betMultiplier(1, 4, 2)).toBeCloseTo(1.25);
    expect(betMultiplier(2, 4, 2)).toBeCloseTo(1.5);
    expect(betMultiplier(3, 4, 2)).toBeCloseTo(1.75);
  });

  it('final élevé ×10 monte proportionnellement', () => {
    // 4 tours : pas de (10-1)/4 = 2.25 par tour.
    expect(betMultiplier(1, 4, 10)).toBeCloseTo(3.25);
    expect(betMultiplier(2, 4, 10)).toBeCloseTo(5.5);
  });

  it('borne les tours au total (jamais au-dessus du final)', () => {
    expect(betMultiplier(9, 3, 2)).toBe(2);
  });

  it('défaut ×2', () => {
    expect(DEFAULT_BET_FINAL_MULT).toBe(2);
  });
});

describe('betPayout', () => {
  it('arrondit le gain mise × multiplicateur', () => {
    expect(betPayout(100, 1, 4, 2)).toBe(125);
    expect(betPayout(100, 0, 4, 2)).toBe(0);
    expect(betPayout(250, 4, 4, 2)).toBe(500);
  });
});

describe('cashPrizeForRounds', () => {
  it('0 tour → 0', () => {
    expect(cashPrizeForRounds(0, 4, 10000)).toBe(0);
  });

  it('champion → base', () => {
    expect(cashPrizeForRounds(4, 4, 10000)).toBe(10000);
  });

  it('paliers proportionnels — base 10000, bracket de 16', () => {
    expect(cashPrizeForRounds(3, 4, 10000)).toBe(7500); // finaliste
    expect(cashPrizeForRounds(2, 4, 10000)).toBe(5000); // demi
    expect(cashPrizeForRounds(1, 4, 10000)).toBe(2500); // 1 tour franchi
  });

  it('base nulle ou négative → 0', () => {
    expect(cashPrizeForRounds(3, 4, 0)).toBe(0);
  });
});

describe('tournamentEloReward', () => {
  it('défaut champion = 100', () => {
    expect(TOURNAMENT_ELO_WINNER).toBe(100);
  });

  describe('élimination directe (le 1er tour EST la qualif)', () => {
    const elim = (bracketRoundsWon: number, totalBracketRounds: number) =>
      tournamentEloReward({ format: 'elimination', qualified: true, bracketRoundsWon, totalBracketRounds });

    it('sorti au 1er tour (0 gagné) → 0', () => {
      expect(elim(0, 4)).toBe(0);
    });

    it('champion → 100', () => {
      expect(elim(4, 4)).toBe(100);
      expect(elim(1, 1)).toBe(100); // bracket de 2
    });

    it('paliers interpolés — bracket de 16 (4 tours)', () => {
      expect(elim(3, 4)).toBe(75); // finaliste
      expect(elim(2, 4)).toBe(50); // demi
      expect(elim(1, 4)).toBe(25); // 1 tour franchi
    });
  });

  describe('poules / ligue (franchir la phase = un palier)', () => {
    const pool = (qualified: boolean, bracketRoundsWon: number, totalBracketRounds: number) =>
      tournamentEloReward({ format: 'pools', qualified, bracketRoundsWon, totalBracketRounds });

    it('non qualifié (sorti en poules/ligue) → 0', () => {
      expect(pool(false, 0, 3)).toBe(0);
    });

    it('qualifié sorti au 1er tour de bracket → déjà > 0', () => {
      // R=3 → total 4 paliers : qualif seule = 1/4 = 25.
      expect(pool(true, 0, 3)).toBe(25);
    });

    it('champion → 100', () => {
      expect(pool(true, 3, 3)).toBe(100);
    });

    it('même barème pour la phase de ligue', () => {
      expect(tournamentEloReward({ format: 'league', qualified: false, bracketRoundsWon: 0, totalBracketRounds: 2 })).toBe(0);
      expect(tournamentEloReward({ format: 'league', qualified: true, bracketRoundsWon: 2, totalBracketRounds: 2 })).toBe(100);
    });
  });

  it('bracket vide / dégénéré → 0', () => {
    expect(tournamentEloReward({ format: 'elimination', qualified: true, bracketRoundsWon: 0, totalBracketRounds: 0 })).toBe(0);
  });

  it('borne les tours gagnés au total du bracket', () => {
    expect(tournamentEloReward({ format: 'elimination', qualified: true, bracketRoundsWon: 9, totalBracketRounds: 3 })).toBe(100);
  });

  describe('plafond selon le type (officiel 100 / amical 50)', () => {
    it('tournamentEloMax mappe le kind', () => {
      expect(TOURNAMENT_ELO_WINNER_OFFICIAL).toBe(100);
      expect(TOURNAMENT_ELO_WINNER_FRIENDLY).toBe(50);
      expect(tournamentEloMax('official')).toBe(100);
      expect(tournamentEloMax('friendly')).toBe(50);
      expect(tournamentEloMax('autre')).toBe(50); // défaut = amical
    });

    it('amical : champion → 50, paliers redispersés en conséquence (bracket de 16)', () => {
      const amical = (k: number) =>
        tournamentEloReward({ format: 'elimination', qualified: true, bracketRoundsWon: k, totalBracketRounds: 4, max: 50 });
      expect(amical(4)).toBe(50); // champion
      expect(amical(3)).toBe(38); // finaliste — round(50·3/4)=37.5→38
      expect(amical(2)).toBe(25); // demi
      expect(amical(1)).toBe(13); // 1 tour — round(50·1/4)=12.5→13
      expect(amical(0)).toBe(0);
    });
  });
});
