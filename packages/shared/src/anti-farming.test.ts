import { describe, it, expect } from 'vitest';
import {
  shouldCountForElo,
  sameDayPriorCount,
  farmingDecayFactor,
  applyFarmingDecay,
} from './anti-farming.js';

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

// base = 2026-01-10T12:00:00Z → 13:00 à Paris, jour '2026-01-10'.
describe('sameDayPriorCount', () => {
  it('vaut 0 pour le premier match du jour', () => {
    expect(sameDayPriorCount([], base)).toBe(0);
  });

  it('compte les matchs comptés et antérieurs du même jour', () => {
    const priors = [
      counted(new Date(base.getTime() - 2 * 3600_000)),
      counted(new Date(base.getTime() - 1 * 3600_000)),
    ];
    expect(sameDayPriorCount(priors, base)).toBe(2);
  });

  it('ignore les matchs d’un autre jour', () => {
    const priors = [counted(new Date('2026-01-09T12:00:00.000Z'))];
    expect(sameDayPriorCount(priors, base)).toBe(0);
  });

  it('ignore les matchs non comptés et ceux postérieurs', () => {
    const priors = [
      { playedAt: new Date(base.getTime() - 3600_000), countedForElo: false },
      counted(new Date(base.getTime() + 3600_000)),
    ];
    expect(sameDayPriorCount(priors, base)).toBe(0);
  });
});

describe('farmingDecayFactor (×0.75 par rematch du jour)', () => {
  it('décroît géométriquement', () => {
    expect(farmingDecayFactor(0)).toBeCloseTo(1, 10);
    expect(farmingDecayFactor(1)).toBeCloseTo(0.75, 10);
    expect(farmingDecayFactor(2)).toBeCloseTo(0.5625, 10);
    expect(farmingDecayFactor(3)).toBeCloseTo(0.421875, 10);
  });
});

describe('applyFarmingDecay', () => {
  it('reproduit la suite 25 → 19 → 14 → 11', () => {
    expect(applyFarmingDecay(25, farmingDecayFactor(0))).toBe(25);
    expect(applyFarmingDecay(25, farmingDecayFactor(1))).toBe(19);
    expect(applyFarmingDecay(25, farmingDecayFactor(2))).toBe(14);
    expect(applyFarmingDecay(25, farmingDecayFactor(3))).toBe(11);
  });

  it('préserve le signe (la perte décroît aussi)', () => {
    expect(applyFarmingDecay(-25, farmingDecayFactor(1))).toBe(-19);
  });

  it('garde au moins 1 point de mouvement si le delta initial est non nul', () => {
    expect(applyFarmingDecay(2, 0.01)).toBe(1);
    expect(applyFarmingDecay(-2, 0.01)).toBe(-1);
  });

  it('reste à 0 si le delta initial est nul', () => {
    expect(applyFarmingDecay(0, farmingDecayFactor(1))).toBe(0);
  });
});
