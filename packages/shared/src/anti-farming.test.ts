import { describe, it, expect } from 'vitest';
import {
  shouldCountForElo,
  MAX_COUNTED_PER_PAIR_PER_WINDOW,
} from './anti-farming.js';

const day = (n: number) => new Date(2026, 0, n);

describe('shouldCountForElo', () => {
  it('counts when no prior matches exist', () => {
    expect(shouldCountForElo([], day(10))).toBe(true);
  });

  it('counts the second match in the window', () => {
    expect(
      shouldCountForElo(
        [{ playedAt: day(8), countedForElo: true }],
        day(10),
      ),
    ).toBe(true);
  });

  it('rejects the third counted match in the window', () => {
    expect(
      shouldCountForElo(
        [
          { playedAt: day(8), countedForElo: true },
          { playedAt: day(9), countedForElo: true },
        ],
        day(10),
      ),
    ).toBe(false);
  });

  it('ignores prior matches outside the 7-day window', () => {
    expect(
      shouldCountForElo(
        [
          { playedAt: day(1), countedForElo: true },
          { playedAt: day(2), countedForElo: true },
        ],
        day(10),
      ),
    ).toBe(true);
  });

  it('ignores prior matches that themselves did not count', () => {
    expect(
      shouldCountForElo(
        [
          { playedAt: day(8), countedForElo: false },
          { playedAt: day(9), countedForElo: false },
        ],
        day(10),
      ),
    ).toBe(true);
  });

  it('boundary: a match exactly 7 days old is inside the window', () => {
    const newAt = new Date('2026-01-10T12:00:00Z');
    const sevenDaysAgo = new Date('2026-01-03T12:00:00Z');
    expect(
      shouldCountForElo(
        [
          { playedAt: sevenDaysAgo, countedForElo: true },
          { playedAt: new Date('2026-01-05T00:00:00Z'), countedForElo: true },
        ],
        newAt,
      ),
    ).toBe(false);
  });

  it('respects the configured cap value', () => {
    const priors = Array.from({ length: MAX_COUNTED_PER_PAIR_PER_WINDOW }, () => ({
      playedAt: day(9),
      countedForElo: true,
    }));
    expect(shouldCountForElo(priors, day(10))).toBe(false);
  });
});
