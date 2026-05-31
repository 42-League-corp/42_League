import { describe, it, expect, beforeEach, vi } from 'vitest';

// On mocke la couche DB pour exécuter le moteur de tournoi sans Prisma : on capture
// les données passées à createMany/update et on vérifie la structure produite.
const { createMany, update } = vi.hoisted(() => ({
  createMany: vi.fn(),
  update: vi.fn(),
}));

vi.mock('./db.js', () => ({
  prisma: {
    tournamentMatch: { createMany, update },
  },
}));

import {
  nextPow2,
  totalRounds,
  poolStandings,
  qualifiersFromPools,
  generateBracket,
  generatePools,
  advanceWinner,
  type PoolMatchLite,
} from './tournament.js';

beforeEach(() => {
  createMany.mockReset();
  update.mockReset();
  createMany.mockResolvedValue({ count: 0 });
  update.mockResolvedValue({});
});

/** Récupère le tableau `data` du (premier) appel à createMany. */
type MatchRow = {
  stage: string;
  round: number;
  slot: number;
  poolIndex?: number;
  playerALogin: string | null;
  playerBLogin: string | null;
  winnerLogin?: string | null;
  confirmedAt?: Date | null;
};
function createdRows(): MatchRow[] {
  expect(createMany).toHaveBeenCalledTimes(1);
  return createMany.mock.calls[0]![0].data as MatchRow[];
}

// ───────────────────────── fonctions pures : cas limites ─────────────────────────

describe('nextPow2 — cas limites', () => {
  it('gère 0 et 1', () => {
    expect(nextPow2(1)).toBe(1);
    expect(nextPow2(0)).toBe(1); // boucle jamais entrée, p reste 1
  });
  it('est idempotent sur les puissances de 2', () => {
    for (const p of [2, 4, 16, 32, 64]) expect(nextPow2(p)).toBe(p);
  });
  it('arrondit toujours vers le haut', () => {
    expect(nextPow2(17)).toBe(32);
    expect(nextPow2(33)).toBe(64);
  });
});

describe('totalRounds — cas limites', () => {
  it('compte les rounds des grands brackets', () => {
    expect(totalRounds(32)).toBe(5);
    expect(totalRounds(64)).toBe(6);
  });
  it('vaut 0 pour un bracket de taille 1 et n’est jamais négatif', () => {
    expect(totalRounds(1)).toBe(0);
  });
});

// ───────────────────────── poolStandings : départages & robustesse ───────────────

function pm(
  poolIndex: number | null,
  a: string | null,
  b: string | null,
  sa: number | null,
  sb: number | null,
): PoolMatchLite {
  const winnerLogin =
    sa == null || sb == null ? null : sa > sb ? a : sa < sb ? b : null;
  return { poolIndex, playerALogin: a, playerBLogin: b, scoreA: sa, scoreB: sb, winnerLogin };
}

describe('poolStandings — robustesse', () => {
  it('ignore les matchs incomplets (joueur ou score manquant)', () => {
    const matches: PoolMatchLite[] = [
      pm(0, 'a', 'b', 10, 5),
      pm(0, 'a', 'c', null, null), // pas encore joué
      pm(0, null, 'c', 10, 0), // adversaire manquant
    ];
    const table = poolStandings(matches);
    // Seul a-b compte : a et b ont 1 match, c n'apparaît pas.
    expect(table.map((s) => s.login).sort()).toEqual(['a', 'b']);
    expect(table.find((s) => s.login === 'a')!.played).toBe(1);
  });

  it('départage à buts pour égaux en victoires et différence', () => {
    // a et b : 1 victoire, diff identique, mais a marque plus de buts.
    const matches: PoolMatchLite[] = [
      pm(0, 'a', 'x', 10, 5), // a: +5, 10 bp
      pm(0, 'b', 'y', 8, 3), // b: +5, 8 bp
      pm(0, 'a', 'b', 0, 0), // nul : aucune victoire, diff 0 chacun
    ];
    const table = poolStandings(matches);
    const a = table.find((s) => s.login === 'a')!;
    const b = table.find((s) => s.login === 'b')!;
    expect(a.wins).toBe(b.wins);
    expect(a.diff).toBe(b.diff);
    // a (18 bp) classé avant b (11 bp).
    expect(table.findIndex((s) => s.login === 'a')).toBeLessThan(
      table.findIndex((s) => s.login === 'b'),
    );
  });

  it('comptabilise les buts pour/contre des deux côtés du match', () => {
    const table = poolStandings([pm(0, 'a', 'b', 7, 3)]);
    const a = table.find((s) => s.login === 'a')!;
    const b = table.find((s) => s.login === 'b')!;
    expect([a.goalsFor, a.goalsAgainst]).toEqual([7, 3]);
    expect([b.goalsFor, b.goalsAgainst]).toEqual([3, 7]);
    expect(a.diff).toBe(4);
    expect(b.diff).toBe(-4);
  });

  it('un nul ne donne de victoire à personne', () => {
    const table = poolStandings([pm(0, 'a', 'b', 5, 5)]);
    expect(table.every((s) => s.wins === 0)).toBe(true);
    expect(table.every((s) => s.played === 1)).toBe(true);
  });
});

// ───────────────────────── qualifiersFromPools : seeding croisé ──────────────────

describe('qualifiersFromPools — seeding croisé', () => {
  it('respecte le serpent sur 4 poules (1ers en ordre, 2es inversés)', () => {
    const matches: PoolMatchLite[] = [];
    // 4 poules p0..p3, chacune : 1er = "<p>1", 2e = "<p>2", 3e = "<p>3".
    for (let p = 0; p < 4; p++) {
      matches.push(pm(p, `${p}1`, `${p}2`, 10, 1));
      matches.push(pm(p, `${p}1`, `${p}3`, 10, 1));
      matches.push(pm(p, `${p}2`, `${p}3`, 10, 1));
    }
    const q = qualifiersFromPools(matches);
    // 1ers ordre poules : 01,11,21,31 ; 2es inversés : 32,22,12,02
    expect(q).toEqual(['01', '11', '21', '31', '32', '22', '12', '02']);
  });

  it('qualifyPerPool=1 ne garde que les 1ers, en ordre de poule', () => {
    const matches: PoolMatchLite[] = [
      pm(0, 'a', 'b', 10, 0),
      pm(1, 'c', 'd', 10, 0),
    ];
    expect(qualifiersFromPools(matches, 1)).toEqual(['a', 'c']);
  });

  it('traite poolIndex null comme la poule 0', () => {
    const matches: PoolMatchLite[] = [pm(null, 'a', 'b', 3, 1)];
    expect(qualifiersFromPools(matches, 1)).toEqual(['a']);
  });

  it('ne plante pas si une poule a moins de qualifiés que demandé', () => {
    const matches: PoolMatchLite[] = [pm(0, 'a', 'b', 5, 0)];
    // qualifyPerPool=2 mais 2 joueurs seulement → renvoie a puis b, sans trou.
    const q = qualifiersFromPools(matches, 2);
    expect(q).toEqual(['a', 'b']);
    expect(q).not.toContain(undefined);
  });
});

// ───────────────────────── generateBracket : seeding, byes, propagation ──────────

describe('generateBracket — bracket plein (preSeeded)', () => {
  it('produit l’appariement canonique sur 8 joueurs', async () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    await generateBracket('t', players, { preSeeded: true });
    const rows = createdRows();

    // 8 joueurs → 4 + 2 + 1 = 7 matchs, 3 rounds.
    expect(rows.length).toBe(7);
    const round1 = rows.filter((r) => r.round === 1).sort((a, b) => a.slot - b.slot);
    expect(round1.map((r) => [r.playerALogin, r.playerBLogin])).toEqual([
      ['p1', 'p8'],
      ['p4', 'p5'],
      ['p2', 'p7'],
      ['p3', 'p6'],
    ]);
    // Aucun bye : aucun gagnant pré-rempli, aucun update.
    expect(round1.every((r) => r.winnerLogin == null)).toBe(true);
    expect(update).not.toHaveBeenCalled();
    // Rounds 2 et 3 : placeholders vides.
    expect(rows.filter((r) => r.round === 2).length).toBe(2);
    expect(rows.filter((r) => r.round === 3).length).toBe(1);
    expect(
      rows
        .filter((r) => r.round > 1)
        .every((r) => r.playerALogin == null && r.playerBLogin == null),
    ).toBe(true);
  });

  it('marque tous les matchs au stage "bracket"', async () => {
    await generateBracket('t', ['a', 'b'], { preSeeded: true });
    const rows = createdRows();
    expect(rows.every((r) => r.stage === 'bracket')).toBe(true);
    expect(rows.length).toBe(1); // 2 joueurs → 1 finale, 1 round
  });
});

describe('generateBracket — byes (effectif non puissance de 2)', () => {
  it('attribue les byes aux têtes de série et les propage au round 2 (5 joueurs)', async () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5'];
    await generateBracket('t', players, { preSeeded: true });
    const rows = createdRows();

    // size = 8 → 7 emplacements de match au total.
    expect(rows.length).toBe(7);
    const round1 = rows.filter((r) => r.round === 1).sort((a, b) => a.slot - b.slot);
    // seedOrder(8)=[1,8,4,5,2,7,3,6] → slots :
    // s0 p1 vs (seed8=bye) ; s1 p4 vs p5 ; s2 p2 vs (bye) ; s3 p3 vs (bye)
    expect(round1[0]!.playerALogin).toBe('p1');
    expect(round1[0]!.playerBLogin).toBeNull();
    expect(round1[0]!.winnerLogin).toBe('p1'); // bye auto-qualifié
    expect(round1[0]!.confirmedAt).toBeInstanceOf(Date);

    expect([round1[1]!.playerALogin, round1[1]!.playerBLogin]).toEqual(['p4', 'p5']);
    expect(round1[1]!.winnerLogin).toBeNull(); // vrai match

    // 3 byes (p1, p2, p3) → 3 propagations vers le round 2.
    const byes = round1.filter((r) => r.winnerLogin != null);
    expect(byes.map((r) => r.winnerLogin)).toEqual(['p1', 'p2', 'p3']);
    expect(update).toHaveBeenCalledTimes(3);
  });

  it('propage le bye dans le bon slot/côté du round 2', async () => {
    await generateBracket('t', ['p1', 'p2', 'p3', 'p4', 'p5'], { preSeeded: true });
    // slot0 (p1) → round2 slot0 côté A ; slot2 (p2) → round2 slot1 côté A ;
    // slot3 (p3) → round2 slot1 côté B.
    const calls = update.mock.calls.map((c) => c[0]);
    const targets = calls.map((arg) => ({
      round: arg.where.tournamentId_round_slot.round,
      slot: arg.where.tournamentId_round_slot.slot,
      data: arg.data,
    }));
    expect(targets).toContainEqual({ round: 2, slot: 0, data: { playerALogin: 'p1' } });
    expect(targets).toContainEqual({ round: 2, slot: 1, data: { playerALogin: 'p2' } });
    expect(targets).toContainEqual({ round: 2, slot: 1, data: { playerBLogin: 'p3' } });
  });

  it('ne propage aucun bye quand il n’y a qu’un seul round (3 joueurs → final direct)', async () => {
    // 3 joueurs → size 4, 2 rounds : un bye existe et se propage en finale.
    await generateBracket('t', ['p1', 'p2', 'p3'], { preSeeded: true });
    const rows = createdRows();
    expect(rows.length).toBe(3); // 2 (round1) + 1 (finale)
    // 1 bye (p1) propagé vers la finale (round 2, slot 0, côté A).
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]![0].data).toEqual({ playerALogin: 'p1' });
  });
});

describe('generateBracket — invariants généraux', () => {
  it('chaque joueur apparaît exactement une fois au round 1, pour tout effectif', async () => {
    for (const n of [2, 3, 5, 6, 7, 9, 13]) {
      createMany.mockClear();
      update.mockClear();
      const players = Array.from({ length: n }, (_, i) => `p${i + 1}`);
      await generateBracket(`t${n}`, players, { preSeeded: true });
      const rows = createMany.mock.calls[0]![0].data as MatchRow[];
      const round1 = rows.filter((r) => r.round === 1);
      const present = round1
        .flatMap((r) => [r.playerALogin, r.playerBLogin])
        .filter((x): x is string => !!x);
      expect(present.sort()).toEqual([...players].sort());
      // Pas de doublon.
      expect(new Set(present).size).toBe(n);
    }
  });
});

// ───────────────────────── generatePools : round-robin serpent ───────────────────

describe('generatePools — structure des poules', () => {
  it('forme des poules de 4 (la dernière plus petite) et un round-robin complet', async () => {
    const players = Array.from({ length: 10 }, (_, i) => `p${i + 1}`);
    await generatePools('t', players);
    const rows = createdRows();

    // 10 joueurs / 4 → 3 poules de tailles 4,3,3 → 6+3+3 = 12 matchs.
    expect(rows.length).toBe(12);
    expect(rows.every((r) => r.stage === 'pool' && r.round === 0)).toBe(true);

    // Regroupe par poolIndex et vérifie le round-robin.
    const byPool = new Map<number, MatchRow[]>();
    for (const r of rows) {
      const p = r.poolIndex!;
      if (!byPool.has(p)) byPool.set(p, []);
      byPool.get(p)!.push(r);
    }
    expect(byPool.size).toBe(3);

    for (const poolMatches of byPool.values()) {
      const players = new Set(
        poolMatches.flatMap((m) => [m.playerALogin, m.playerBLogin]),
      );
      const k = players.size;
      // Round-robin : k*(k-1)/2 matchs.
      expect(poolMatches.length).toBe((k * (k - 1)) / 2);
      // Pas d'auto-match, pas de paire en double (non orientée).
      const pairs = new Set<string>();
      for (const m of poolMatches) {
        expect(m.playerALogin).not.toBe(m.playerBLogin);
        const key = [m.playerALogin, m.playerBLogin].sort().join('|');
        expect(pairs.has(key)).toBe(false);
        pairs.add(key);
      }
    }

    // Tous les joueurs sont placés, une seule poule chacun.
    const seen = rows.flatMap((m) => [m.playerALogin, m.playerBLogin]);
    expect(new Set(seen)).toEqual(new Set(players));
  });

  it('une seule poule quand l’effectif tient dans POOL_SIZE', async () => {
    await generatePools('t', ['a', 'b', 'c']);
    const rows = createdRows();
    expect(rows.every((r) => r.poolIndex === 0)).toBe(true);
    expect(rows.length).toBe(3); // round-robin de 3
  });

  it('attribue des slots uniques et croissants', async () => {
    await generatePools('t', Array.from({ length: 8 }, (_, i) => `p${i}`));
    const rows = createdRows();
    const slots = rows.map((r) => r.slot).sort((a, b) => a - b);
    expect(slots).toEqual(slots.map((_, i) => i)); // 0..n-1 sans trou
  });
});

// ───────────────────────── advanceWinner : propagation & finale ──────────────────

describe('advanceWinner', () => {
  it('propage le gagnant au slot/côté du tour suivant (slot pair → A)', async () => {
    const res = await advanceWinner('t', 1, 2, 'winnerX', 3);
    expect(res).toEqual({ isFinal: false });
    expect(update).toHaveBeenCalledTimes(1);
    const arg = update.mock.calls[0]![0];
    expect(arg.where.tournamentId_round_slot).toEqual({
      tournamentId: 't',
      round: 2,
      slot: 1, // floor(2/2)
    });
    expect(arg.data).toEqual({ playerALogin: 'winnerX' }); // 2 % 2 === 0 → côté A
  });

  it('propage côté B pour un slot impair', async () => {
    await advanceWinner('t', 1, 3, 'winnerY', 3);
    const arg = update.mock.calls[0]![0];
    expect(arg.where.tournamentId_round_slot.slot).toBe(1); // floor(3/2)
    expect(arg.data).toEqual({ playerBLogin: 'winnerY' });
  });

  it('signale la finale sans rien propager au dernier round', async () => {
    const res = await advanceWinner('t', 3, 0, 'champion', 3);
    expect(res).toEqual({ isFinal: true });
    expect(update).not.toHaveBeenCalled();
  });

  it('traite tout round >= total comme final (garde-fou)', async () => {
    const res = await advanceWinner('t', 5, 0, 'x', 3);
    expect(res).toEqual({ isFinal: true });
    expect(update).not.toHaveBeenCalled();
  });
});
