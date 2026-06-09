import { describe, it, expect } from 'vitest';
import { computeGoat, GOAT_WEIGHTS, type GoatMatchInput, type GoatTournamentInput } from './goat.js';

// Fabrique un match 1v1 « plein effet » (countedForElo) pour `winner` contre `loser`.
function match(
  winner: string,
  loser: string,
  scoreW: number,
  scoreL: number,
  deltaW: number,
  at: number,
): GoatMatchInput {
  return {
    countedForElo: true,
    playerALogin: winner,
    playerBLogin: loser,
    deltaA: deltaW,
    deltaB: -deltaW,
    winner: 'A',
    scoreA: scoreW,
    scoreB: scoreL,
    playedAt: at,
  };
}

describe('computeGoat', () => {
  it('les poids somment à 1 (100 %)', () => {
    const total = GOAT_WEIGHTS.reduce((s, w) => s + w.weight, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('classe en tête le joueur dominant (ELO + écarts + titres)', () => {
    const players = [{ login: 'alice' }, { login: 'bob' }];
    // alice gagne 10 matchs larges contre bob → ELO, win rate, marge, série au max.
    const matches: GoatMatchInput[] = [];
    for (let i = 0; i < 10; i++) matches.push(match('alice', 'bob', 10, 2, 12, i));
    const tournaments: GoatTournamentInput[] = [
      { status: 'finished', winnerLogin: 'alice', kind: 'official' },
    ];
    const ranking = computeGoat(players, matches, tournaments);
    const first = ranking[0]!;
    const second = ranking[1]!;
    expect(first.entry.login).toBe('alice');
    expect(first.rank).toBe(1);
    expect(second.entry.login).toBe('bob');
    expect(first.score).toBeGreaterThan(second.score);
  });

  it('amortit les très faibles volumes (un 10-0 unique ne fait pas un GOAT)', () => {
    const players = [{ login: 'rookie' }, { login: 'grinder' }];
    const matches: GoatMatchInput[] = [
      // rookie : 1 seul match, écrasant.
      match('rookie', 'grinder', 10, 0, 15, 0),
      // grinder : 20 matchs gagnés (volume + ELO cumulé) contre rookie.
    ];
    for (let i = 1; i <= 20; i++) matches.push(match('grinder', 'rookie', 5, 3, 10, i));
    const ranking = computeGoat(players, matches, []);
    // Le facteur de confiance (~10 matchs) doit faire passer grinder devant.
    expect(ranking[0]!.entry.login).toBe('grinder');
  });

  it('exclut les nulles (échecs) du palmarès mais elles bougent l’ELO all-time', () => {
    const players = [{ login: 'p1' }, { login: 'p2' }];
    const draw: GoatMatchInput = {
      countedForElo: true,
      playerALogin: 'p1',
      playerBLogin: 'p2',
      deltaA: 5,
      deltaB: -5,
      winner: 'draw',
      scoreA: 1,
      scoreB: 1,
      playedAt: 0,
    };
    const ranking = computeGoat(players, [draw], []);
    const p1 = ranking.find((r) => r.entry.login === 'p1')!;
    // Nulle exclue du palmarès → 0 match compté (wins+losses), mais ELO +5.
    expect(p1.metrics.games).toBe(0);
    expect(p1.metrics.elo).toBe(1005);
  });

  it('renvoie un classement vide pour aucun candidat', () => {
    expect(computeGoat([], [], [])).toEqual([]);
  });
});
