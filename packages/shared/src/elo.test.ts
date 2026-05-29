import { describe, it, expect } from 'vitest';
import { calculateBabyfootElo, K, DEFAULT_ELO } from './elo.js';

describe('calculateBabyfootElo', () => {
  it('est à somme nulle : deltaA + deltaB === 0', () => {
    const r = calculateBabyfootElo(1000, 1000, 'A', 10, 5);
    expect(r.deltaA + r.deltaB).toBe(0);
  });

  it('le gagnant gagne des points, le perdant en perd', () => {
    const r = calculateBabyfootElo(1000, 1000, 'A', 10, 5);
    expect(r.deltaA).toBeGreaterThan(0);
    expect(r.deltaB).toBeLessThan(0);
  });

  it("boost plus élevé pour l'outsider qui gagne", () => {
    const upset = calculateBabyfootElo(1000, 1400, 'A', 10, 5);
    const expected = calculateBabyfootElo(1400, 1000, 'A', 10, 5);
    expect(upset.deltaA).toBeGreaterThan(expected.deltaA);
  });

  it('un écart de buts plus grand transfère plus de points', () => {
    const close = calculateBabyfootElo(1000, 1000, 'A', 10, 9); // Δ=1
    const crush = calculateBabyfootElo(1000, 1000, 'A', 10, 0); // Δ=10
    expect(crush.deltaA).toBeGreaterThan(close.deltaA);
  });

  it('victoire 10-0 : multiplicateur maximum M=2 (Δ=10)', () => {
    const r = calculateBabyfootElo(1000, 1000, 'A', 10, 0);
    // E=0.5, M=2, P = round(32 * 2 * 0.5) = 32
    expect(r.deltaA).toBe(32);
    expect(r.deltaB).toBe(-32);
  });

  it('victoire 10-9 : multiplicateur minimum M=1.1 (Δ=1)', () => {
    const r = calculateBabyfootElo(1000, 1000, 'A', 10, 9);
    // E=0.5, M=1.1, P = round(32 * 1.1 * 0.5) = round(17.6) = 18
    expect(r.deltaA).toBe(18);
    expect(r.deltaB).toBe(-18);
  });

  it('fonctionne si B est le gagnant', () => {
    const r = calculateBabyfootElo(1000, 1000, 'B', 5, 10);
    expect(r.deltaB).toBeGreaterThan(0);
    expect(r.deltaA).toBeLessThan(0);
    expect(r.deltaA + r.deltaB).toBe(0);
  });

  it('les nouveaux ratings sont cohérents avec les deltas', () => {
    const r = calculateBabyfootElo(1000, 1200, 'A', 10, 3);
    expect(r.newA).toBe(1000 + r.deltaA);
    expect(r.newB).toBe(1200 + r.deltaB);
  });

  it('K=32 est le facteur de base', () => {
    expect(K).toBe(32);
  });

  it('DEFAULT_ELO est 1000', () => {
    expect(DEFAULT_ELO).toBe(1000);
  });
});
