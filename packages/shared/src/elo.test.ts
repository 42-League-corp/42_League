import { describe, it, expect } from 'vitest';
import {
  applyElo,
  expectedScore,
  kFactor,
  K_PLACEMENT,
  K_RANKED,
  PLACEMENT_MATCHES,
} from './elo.js';

describe('expectedScore', () => {
  it('returns 0.5 when ratings are equal', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
  });

  it('strongly favors the much-higher-rated player', () => {
    expect(expectedScore(1400, 1000)).toBeGreaterThan(0.9);
  });

  it('is symmetric', () => {
    expect(expectedScore(1200, 1000) + expectedScore(1000, 1200)).toBeCloseTo(1);
  });
});

describe('kFactor', () => {
  it('uses placement K during placements', () => {
    expect(kFactor(0)).toBe(K_PLACEMENT);
    expect(kFactor(PLACEMENT_MATCHES - 1)).toBe(K_PLACEMENT);
  });

  it('uses ranked K after placements', () => {
    expect(kFactor(PLACEMENT_MATCHES)).toBe(K_RANKED);
    expect(kFactor(100)).toBe(K_RANKED);
  });
});

describe('applyElo', () => {
  it('is zero-sum when both players are out of placements', () => {
    const r = applyElo(1000, 1000, 'A', 50, 50);
    expect(r.deltaA + r.deltaB).toBe(0);
  });

  it('gives a big boost to an underdog winner', () => {
    const r = applyElo(1000, 1400, 'A', 50, 50);
    expect(r.deltaA).toBeGreaterThan(15);
    expect(r.deltaB).toBeLessThan(-15);
  });

  it('gives only a small gain when the favorite wins', () => {
    const r = applyElo(1400, 1000, 'A', 50, 50);
    expect(r.deltaA).toBeLessThan(5);
    expect(r.deltaA).toBeGreaterThan(0);
  });

  it('moves a fresh player faster than a settled one', () => {
    const settled = applyElo(1000, 1000, 'A', 50, 50);
    const placement = applyElo(1000, 1000, 'A', 0, 50);
    expect(Math.abs(placement.deltaA)).toBeGreaterThan(Math.abs(settled.deltaA));
  });

  it('returns updated absolute ratings consistent with deltas', () => {
    const r = applyElo(1000, 1000, 'B', 50, 50);
    expect(r.newA).toBe(1000 + r.deltaA);
    expect(r.newB).toBe(1000 + r.deltaB);
  });
});
