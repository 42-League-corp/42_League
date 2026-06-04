import { describe, it, expect } from 'vitest';
import { calculateFfaElo, MAX_DELTA_PER_MATCH } from './elo.js';

describe('calculateFfaElo', () => {
  it('à ratings égaux : 1er = +16, dernier = −16 (amplitude d’un match)', () => {
    const d = calculateFfaElo([1000, 1000, 1000, 1000]);
    expect(d[0]).toBe(16);
    expect(d[d.length - 1]).toBe(-16);
  });

  it('monotone décroissant par rang (le mieux classé gagne le plus)', () => {
    const d = calculateFfaElo([1200, 1100, 1000, 900, 800]);
    for (let i = 1; i < d.length; i++) {
      expect(d[i]).toBeLessThanOrEqual(d[i - 1]!);
    }
  });

  it('le haut du milieu gagne, le bas du milieu perd', () => {
    const d = calculateFfaElo([1000, 1000, 1000, 1000]); // N pair
    expect(d[1]).toBeGreaterThan(0); // 2e = milieu haut
    expect(d[2]).toBeLessThan(0); // 3e = milieu bas
  });

  it('N impair à ratings égaux : le milieu exact stagne (~0)', () => {
    const d5 = calculateFfaElo([1000, 1000, 1000, 1000, 1000]);
    expect(d5[2]).toBe(0); // 3e sur 5 = milieu parfait
    const d3 = calculateFfaElo([1000, 1000, 1000]);
    expect(d3[1]).toBe(0); // 2e sur 3 = milieu parfait
  });

  it('upset : finir 1er contre des joueurs bien mieux classés rapporte plus', () => {
    const equal = calculateFfaElo([1000, 1000, 1000]);
    const upset = calculateFfaElo([800, 1300, 1300]); // l’outsider (800) finit 1er
    expect(upset[0]).toBeGreaterThan(equal[0]!);
  });

  it('chaque delta reste borné par MAX_DELTA_PER_MATCH', () => {
    const d = calculateFfaElo([400, 2400, 2400, 2400, 2400]);
    for (const x of d) {
      expect(Math.abs(x)).toBeLessThanOrEqual(MAX_DELTA_PER_MATCH);
    }
  });

  it('N=3, 4 et 5 renvoient autant de deltas que d’entrées', () => {
    expect(calculateFfaElo([1000, 1000, 1000])).toHaveLength(3);
    expect(calculateFfaElo([1000, 1000, 1000, 1000])).toHaveLength(4);
    expect(calculateFfaElo([1000, 1000, 1000, 1000, 1000])).toHaveLength(5);
  });
});
