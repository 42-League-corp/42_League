import { describe, it, expect, vi } from 'vitest';

// tournament.ts importe prisma au niveau module → mock requis pour les tests
// de fonctions pures qui ne touchent pas la DB.
vi.mock('./db.js', () => ({ prisma: {} }));

import {
  nextPow2,
  totalRounds,
  poolStandings,
  qualifiersFromPools,
  type PoolMatchLite,
} from './tournament.js';

describe('nextPow2', () => {
  it('arrondit à la puissance de 2 supérieure', () => {
    expect(nextPow2(6)).toBe(8);
    expect(nextPow2(8)).toBe(8);
    expect(nextPow2(9)).toBe(16);
    expect(nextPow2(12)).toBe(16);
    expect(nextPow2(2)).toBe(2);
  });
});

describe('totalRounds', () => {
  it('compte les rounds d’un bracket', () => {
    expect(totalRounds(8)).toBe(3);
    expect(totalRounds(16)).toBe(4);
    expect(totalRounds(2)).toBe(1);
  });
});

// Helper : fabrique un match de poule terminé.
function pm(
  poolIndex: number,
  a: string,
  b: string,
  sa: number,
  sb: number,
): PoolMatchLite {
  return {
    poolIndex,
    playerALogin: a,
    playerBLogin: b,
    scoreA: sa,
    scoreB: sb,
    winnerLogin: sa > sb ? a : b,
  };
}

describe('poolStandings', () => {
  it('classe par victoires puis différence de buts', () => {
    // Poule de 3 : a bat b et c ; b bat c.
    const matches = [pm(0, 'a', 'b', 10, 5), pm(0, 'a', 'c', 10, 2), pm(0, 'b', 'c', 10, 8)];
    const table = poolStandings(matches);
    expect(table.map((s) => s.login)).toEqual(['a', 'b', 'c']);
    expect(table[0]!.wins).toBe(2);
    expect(table[0]!.diff).toBe(13); // (10-5)+(10-2)
  });

  it('départage à la différence de buts à égalité de victoires', () => {
    // a bat b, b bat c, c bat a → 1 victoire chacun ; on départage au goal-average.
    const matches = [pm(0, 'a', 'b', 10, 9), pm(0, 'b', 'c', 10, 0), pm(0, 'c', 'a', 10, 8)];
    const table = poolStandings(matches);
    expect(table.every((s) => s.wins === 1)).toBe(true);
    // b : +10-0 puis 9-10 → diff -1 ? a: 10-9 + 8-10 → -1 ; c: 0-10 + 10-8 → -8
    // a et b à -1, départagés aux buts pour ; b a 19 buts pour, a en a 18.
    expect(table[0]!.login).toBe('b');
  });
});

describe('qualifiersFromPools', () => {
  it('prend le top 2 par poule avec seeding croisé', () => {
    // 2 poules de 3. Poule 0: a>b>c. Poule 1: d>e>f.
    const matches = [
      pm(0, 'a', 'b', 10, 1),
      pm(0, 'a', 'c', 10, 1),
      pm(0, 'b', 'c', 10, 1),
      pm(1, 'd', 'e', 10, 1),
      pm(1, 'd', 'f', 10, 1),
      pm(1, 'e', 'f', 10, 1),
    ];
    const q = qualifiersFromPools(matches);
    // 1ers dans l'ordre des poules (a, d), puis 2es en ordre inversé (e, b).
    expect(q).toEqual(['a', 'd', 'e', 'b']);
  });
});
