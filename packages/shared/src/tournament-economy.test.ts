import { describe, it, expect } from 'vitest';
import {
  betMultiplier,
  betPayout,
  cashPrizeForRounds,
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
