import { describe, it, expect } from 'vitest';
import { shouldCountForElo } from './anti-farming.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const base = new Date('2026-01-10T12:00:00.000Z');
const counted = (playedAt: Date) => ({ playedAt, countedForElo: true });

// Ranked illimité : shouldCountForElo renvoie toujours true, quel que soit
// l'historique de la paire. L'ancien plafond anti-farming a été supprimé.
describe('shouldCountForElo (ranked illimité)', () => {
  it('compte un match sans historique', () => {
    expect(shouldCountForElo([], base)).toBe(true);
  });

  it('compte même avec de nombreux matchs récents entre la même paire', () => {
    const priors = Array.from({ length: 50 }, (_, i) =>
      counted(new Date(base.getTime() - i * 1000)),
    );
    expect(shouldCountForElo(priors, base)).toBe(true);
  });

  it('compte plusieurs matchs le même jour', () => {
    const today = [
      counted(new Date(base.getTime() - 3000)),
      counted(new Date(base.getTime() - 2000)),
      counted(new Date(base.getTime() - 1000)),
    ];
    expect(shouldCountForElo(today, base)).toBe(true);
  });

  it('compte malgré un historique ancien', () => {
    const priors = [counted(new Date(base.getTime() - 30 * MS_PER_DAY))];
    expect(shouldCountForElo(priors, base)).toBe(true);
  });
});
