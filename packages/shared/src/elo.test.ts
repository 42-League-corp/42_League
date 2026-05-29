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

  // ─────────────────────────────────────────────────────────────────────────
  // Constantes
  // ─────────────────────────────────────────────────────────────────────────
  describe('constantes du module', () => {
    it('K vaut exactement 32', () => {
      expect(K).toBe(32);
    });

    it('DEFAULT_ELO vaut exactement 1000', () => {
      expect(DEFAULT_ELO).toBe(1000);
    });

    it('K et DEFAULT_ELO sont des nombres', () => {
      expect(typeof K).toBe('number');
      expect(typeof DEFAULT_ELO).toBe('number');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Invariant somme-nulle sur une large matrice de ratings et scores
  // ─────────────────────────────────────────────────────────────────────────
  describe('invariant somme-nulle (matrice exhaustive)', () => {
    const ratings = [100, 500, 800, 1000, 1200, 1500, 2000, 2400, 2800];
    const loserScores = [-10, -5, -1, 0, 1, 3, 5, 7, 9];

    it('deltaA + deltaB === 0 pour A gagnant sur toute la matrice', () => {
      for (const ra of ratings) {
        for (const rb of ratings) {
          for (const ls of loserScores) {
            const r = calculateBabyfootElo(ra, rb, 'A', 10, ls);
            expect(r.deltaA + r.deltaB).toBe(0);
          }
        }
      }
    });

    it('deltaA + deltaB === 0 pour B gagnant sur toute la matrice', () => {
      for (const ra of ratings) {
        for (const rb of ratings) {
          for (const ls of loserScores) {
            const r = calculateBabyfootElo(ra, rb, 'B', ls, 10);
            expect(r.deltaA + r.deltaB).toBe(0);
          }
        }
      }
    });

    it('newA et newB cohérents avec les deltas sur toute la matrice', () => {
      for (const ra of ratings) {
        for (const rb of ratings) {
          for (const ls of loserScores) {
            const r = calculateBabyfootElo(ra, rb, 'A', 10, ls);
            expect(r.newA).toBe(ra + r.deltaA);
            expect(r.newB).toBe(rb + r.deltaB);
          }
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Symétrie : peu importe quel joueur est "A" ou "B", le même vrai
  // gagnant obtient le même gain de points.
  // ─────────────────────────────────────────────────────────────────────────
  describe('symétrie A/B', () => {
    const cases: Array<[number, number, number]> = [
      [1000, 1000, 5],
      [1200, 1000, 0],
      [1000, 1400, 5],
      [800, 1600, 9],
      [2800, 100, 0],
      [100, 2800, -10],
      [1500, 1500, 7],
    ];

    for (const [a, b, s] of cases) {
      it(`gagnant identique : (${a},${b},'A',10,${s}) ↔ (${b},${a},'B',${s},10)`, () => {
        // Dans les deux cas le joueur de rating "a" gagne contre le rating "b".
        const left = calculateBabyfootElo(a, b, 'A', 10, s);
        const right = calculateBabyfootElo(b, a, 'B', s, 10);
        expect(left.deltaA).toBe(right.deltaB);
        expect(left.deltaB).toBe(right.deltaA);
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Monotonicité par rapport à l'écart de rating (favori qui gagne)
  // ─────────────────────────────────────────────────────────────────────────
  describe('monotonicité : écart de rating du favori', () => {
    it('plus le favori est largement favori, moins il gagne de points', () => {
      // Le gagnant a un rating supérieur ; on augmente progressivement l'écart.
      const gaps = [0, 100, 200, 400, 800];
      let previous = Infinity;
      for (const gap of gaps) {
        const r = calculateBabyfootElo(1000 + gap, 1000, 'A', 10, 5);
        expect(r.deltaA).toBeLessThanOrEqual(previous);
        previous = r.deltaA;
      }
    });

    it('un favori extrême gagne moins quà rating égal', () => {
      const equal = calculateBabyfootElo(1000, 1000, 'A', 10, 5);
      const heavy = calculateBabyfootElo(2000, 1000, 'A', 10, 5);
      expect(heavy.deltaA).toBeLessThan(equal.deltaA);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Monotonicité par rapport à l'écart de buts (multiplicateur M)
  // ─────────────────────────────────────────────────────────────────────────
  describe('monotonicité : écart de buts', () => {
    it('le gain croît (au sens large) quand le score du perdant baisse', () => {
      const scores = [9, 7, 5, 3, 1, 0, -5, -10];
      let previous = -Infinity;
      for (const ls of scores) {
        const r = calculateBabyfootElo(1000, 1000, 'A', 10, ls);
        expect(r.deltaA).toBeGreaterThanOrEqual(previous);
        previous = r.deltaA;
      }
    });

    it('un écrasement transfère strictement plus quun match serré', () => {
      const close = calculateBabyfootElo(1000, 1000, 'A', 10, 9);
      const crush = calculateBabyfootElo(1000, 1000, 'A', 10, 0);
      expect(crush.deltaA).toBeGreaterThan(close.deltaA);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Amplification des upsets : l'outsider qui gagne gagne plus que le favori
  // qui gagne, dans des conditions de score identiques.
  // ─────────────────────────────────────────────────────────────────────────
  describe('amplification des upsets', () => {
    it("l'outsider 1000 battant 1400 gagne plus que le favori 1400 battant 1000", () => {
      const upset = calculateBabyfootElo(1000, 1400, 'A', 10, 5);
      const favorite = calculateBabyfootElo(1400, 1000, 'A', 10, 5);
      expect(upset.deltaA).toBeGreaterThan(favorite.deltaA);
    });

    it('un upset rapporte toujours plus de 16 points (au-dessus du gain à rating égal)', () => {
      const upset = calculateBabyfootElo(1000, 1400, 'A', 10, 5);
      const equal = calculateBabyfootElo(1000, 1000, 'A', 10, 5);
      expect(upset.deltaA).toBeGreaterThan(equal.deltaA);
    });

    it("l'upset extrême (100 bat 2800) approche le maximum théorique", () => {
      const r = calculateBabyfootElo(100, 2800, 'A', 10, 0);
      // E ≈ 0, M=2 → P ≈ round(32 * 2 * 1) = 64
      expect(r.deltaA).toBe(64);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Valeurs exactes calculées à la main
  // ─────────────────────────────────────────────────────────────────────────
  describe('valeurs exactes (calcul manuel)', () => {
    it('1000 vs 1000, 10-0 → P=32 (E=0.5, M=2)', () => {
      const r = calculateBabyfootElo(1000, 1000, 'A', 10, 0);
      // P = round(32 * 2.0 * 0.5) = round(32) = 32
      expect(r.deltaA).toBe(32);
      expect(r.deltaB).toBe(-32);
    });

    it('1000 vs 1000, 10-9 → P=18 (E=0.5, M=1.1)', () => {
      const r = calculateBabyfootElo(1000, 1000, 'A', 10, 9);
      // P = round(32 * 1.1 * 0.5) = round(17.6) = 18
      expect(r.deltaA).toBe(18);
      expect(r.deltaB).toBe(-18);
    });

    it('1000 vs 1000, 10-5 → P=24 (E=0.5, M=1.5)', () => {
      const r = calculateBabyfootElo(1000, 1000, 'A', 10, 5);
      // P = round(32 * 1.5 * 0.5) = round(24) = 24
      expect(r.deltaA).toBe(24);
      expect(r.deltaB).toBe(-24);
    });

    it('1000 vs 1000, 10-3 → P=27 (E=0.5, M=1.7)', () => {
      const r = calculateBabyfootElo(1000, 1000, 'A', 10, 3);
      // P = round(32 * 1.7 * 0.5) = round(27.2) = 27
      expect(r.deltaA).toBe(27);
      expect(r.deltaB).toBe(-27);
    });

    it('favori 1200 bat 1000, 10-5 → P=12', () => {
      const r = calculateBabyfootElo(1200, 1000, 'A', 10, 5);
      // E = 1/(1+10^((1000-1200)/400)) = 1/(1+10^-0.5) ≈ 0.75975
      // P = round(32 * 1.5 * (1-0.75975)) = round(32*1.5*0.24025) = round(11.53) = 12
      expect(r.deltaA).toBe(12);
      expect(r.deltaB).toBe(-12);
    });

    it('outsider 1000 bat 1200, 10-5 → P=36', () => {
      const r = calculateBabyfootElo(1000, 1200, 'A', 10, 5);
      // E ≈ 0.24025
      // P = round(32 * 1.5 * 0.75975) = round(36.47) = 36
      expect(r.deltaA).toBe(36);
      expect(r.deltaB).toBe(-36);
    });

    it('favori 1200 bat 1000, 10-0 → P=15', () => {
      const r = calculateBabyfootElo(1200, 1000, 'A', 10, 0);
      // E ≈ 0.75975, M=2 → round(32 * 2 * 0.24025) = round(15.38) = 15
      expect(r.deltaA).toBe(15);
      expect(r.deltaB).toBe(-15);
    });

    it('outsider 1000 bat 1200, 10-0 → P=49', () => {
      const r = calculateBabyfootElo(1000, 1200, 'A', 10, 0);
      // E ≈ 0.24025, M=2 → round(32 * 2 * 0.75975) = round(48.62) = 49
      expect(r.deltaA).toBe(49);
      expect(r.deltaB).toBe(-49);
    });

    it('outsider 1000 bat 1400, 10-0 → P=58', () => {
      const r = calculateBabyfootElo(1000, 1400, 'A', 10, 0);
      // E = 1/(1+10^(400/400)) = 1/(1+10) = 0.090909, M=2
      // P = round(32 * 2 * 0.909090) = round(58.18) = 58
      expect(r.deltaA).toBe(58);
      expect(r.deltaB).toBe(-58);
    });

    it('favori 1400 bat 1000, 10-0 → P=6', () => {
      const r = calculateBabyfootElo(1400, 1000, 'A', 10, 0);
      // E = 0.909090, M=2 → round(32 * 2 * 0.090909) = round(5.818) = 6
      expect(r.deltaA).toBe(6);
      expect(r.deltaB).toBe(-6);
    });

    it('favori 1100 bat 1000, 10-5 → P=17', () => {
      const r = calculateBabyfootElo(1100, 1000, 'A', 10, 5);
      // E = 1/(1+10^(-100/400)) = 1/(1+10^-0.25) ≈ 0.640065
      // P = round(32 * 1.5 * 0.359935) = round(17.28) = 17
      expect(r.deltaA).toBe(17);
      expect(r.deltaB).toBe(-17);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Bornes du multiplicateur M
  // ─────────────────────────────────────────────────────────────────────────
  describe('bornes du multiplicateur M', () => {
    it('M = 1.1 minimum quand loserScore = 9 (à rating égal P=18)', () => {
      const r = calculateBabyfootElo(1000, 1000, 'A', 10, 9);
      // M = 1 + 1*0.1 = 1.1 ; P = round(32*1.1*0.5) = 18
      expect(r.deltaA).toBe(18);
    });

    it('M = 2.0 maximum normal quand loserScore = 0 (à rating égal P=32)', () => {
      const r = calculateBabyfootElo(1000, 1000, 'A', 10, 0);
      // M = 1 + 10*0.1 = 2.0 ; P = round(32*2*0.5) = 32
      expect(r.deltaA).toBe(32);
    });

    it('le gain à 10-0 est exactement K à rating égal (M=2, E=0.5)', () => {
      const r = calculateBabyfootElo(1000, 1000, 'A', 10, 0);
      expect(r.deltaA).toBe(K);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scores négatifs (gamelles) : loserScore peut descendre jusqu'à -10
  // ─────────────────────────────────────────────────────────────────────────
  describe('scores négatifs (gamelles)', () => {
    it('1000 vs 1000, 10--10 → M=3.0, P=48', () => {
      const r = calculateBabyfootElo(1000, 1000, 'A', 10, -10);
      // goalDiff = 10 - (-10) = 20 ; M = 1 + 20*0.1 = 3.0
      // P = round(32 * 3 * 0.5) = round(48) = 48
      expect(r.deltaA).toBe(48);
      expect(r.deltaB).toBe(-48);
    });

    it('1000 vs 1000, 10--5 → M=2.5, P=40', () => {
      const r = calculateBabyfootElo(1000, 1000, 'A', 10, -5);
      // goalDiff = 15 ; M = 2.5 ; P = round(32 * 2.5 * 0.5) = 40
      expect(r.deltaA).toBe(40);
      expect(r.deltaB).toBe(-40);
    });

    it('une gamelle transfère plus quune victoire 10-0 (à conditions égales)', () => {
      const crush = calculateBabyfootElo(1000, 1000, 'A', 10, 0); // M=2
      const gamelle = calculateBabyfootElo(1000, 1000, 'A', 10, -10); // M=3
      expect(gamelle.deltaA).toBeGreaterThan(crush.deltaA);
    });

    it('P reste entier et somme-nulle avec scores négatifs', () => {
      for (let ls = -10; ls <= -1; ls++) {
        const r = calculateBabyfootElo(1200, 900, 'A', 10, ls);
        expect(Number.isInteger(r.deltaA)).toBe(true);
        expect(r.deltaA + r.deltaB).toBe(0);
      }
    });

    it('upset extrême avec gamelle (100 bat 2800, 10--10) approche le max', () => {
      const r = calculateBabyfootElo(100, 2800, 'A', 10, -10);
      // E ≈ 0, M=3 → round(32 * 3 * 1) = 96
      expect(r.deltaA).toBe(96);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Grands écarts de rating : E tend vers 0 ou 1, pas de NaN/Infinity
  // ─────────────────────────────────────────────────────────────────────────
  describe('grands écarts de rating', () => {
    it("le favori écrasant (2800 bat 100, 10-0) gagne très peu (P≈0)", () => {
      const r = calculateBabyfootElo(2800, 100, 'A', 10, 0);
      // E ≈ 1 → P = round(32 * 2 * ~0) = 0
      // (deltaB peut être -0 puisqu'il vaut -P ; +0 ajouté pour normaliser le signe)
      expect(r.deltaA + 0).toBe(0);
      expect(r.deltaB + 0).toBe(0);
      expect(r.deltaA + r.deltaB).toBe(0);
    });

    it("l'outsider écrasant (100 bat 2800, 10-0) gagne près du max (P=64)", () => {
      const r = calculateBabyfootElo(100, 2800, 'A', 10, 0);
      expect(r.deltaA).toBe(64);
    });

    it('aucun NaN ni Infinity pour des ratings extrêmes', () => {
      const extremes = [0, 1, 100, 2800, 5000, 10000];
      for (const ra of extremes) {
        for (const rb of extremes) {
          const r = calculateBabyfootElo(ra, rb, 'A', 10, 0);
          expect(Number.isFinite(r.deltaA)).toBe(true);
          expect(Number.isFinite(r.deltaB)).toBe(true);
          expect(Number.isFinite(r.newA)).toBe(true);
          expect(Number.isFinite(r.newB)).toBe(true);
          expect(Number.isNaN(r.deltaA)).toBe(false);
          expect(Number.isNaN(r.deltaB)).toBe(false);
        }
      }
    });

    it('le favori extrême ne gagne jamais plus que loutsider symétrique', () => {
      const favorite = calculateBabyfootElo(2800, 100, 'A', 10, 0);
      const outsider = calculateBabyfootElo(100, 2800, 'A', 10, 0);
      expect(favorite.deltaA).toBeLessThanOrEqual(outsider.deltaA);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Propriétés générales : P entier non négatif, zéro-sum, égalité des
  // magnitudes gagnant/perdant.
  // ─────────────────────────────────────────────────────────────────────────
  describe('propriétés générales', () => {
    const ratings = [100, 700, 1000, 1300, 1800, 2500];
    const loserScores = [-10, -3, 0, 4, 9];

    it('le gain du gagnant est un entier non négatif', () => {
      for (const ra of ratings) {
        for (const rb of ratings) {
          for (const ls of loserScores) {
            const r = calculateBabyfootElo(ra, rb, 'A', 10, ls);
            expect(Number.isInteger(r.deltaA)).toBe(true);
            expect(r.deltaA).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    it('la magnitude du gagnant égale celle du perdant (transfert pur)', () => {
      for (const ra of ratings) {
        for (const rb of ratings) {
          for (const ls of loserScores) {
            const r = calculateBabyfootElo(ra, rb, 'A', 10, ls);
            expect(r.deltaA).toBe(-r.deltaB);
            expect(Math.abs(r.deltaA)).toBe(Math.abs(r.deltaB));
          }
        }
      }
    });

    it('quand B gagne, deltaB est un entier non négatif et deltaA son opposé', () => {
      for (const ra of ratings) {
        for (const rb of ratings) {
          for (const ls of loserScores) {
            const r = calculateBabyfootElo(ra, rb, 'B', ls, 10);
            expect(Number.isInteger(r.deltaB)).toBe(true);
            expect(r.deltaB).toBeGreaterThanOrEqual(0);
            expect(r.deltaA).toBe(-r.deltaB);
          }
        }
      }
    });

    it('le total des ratings est conservé (newA + newB === ratingA + ratingB)', () => {
      for (const ra of ratings) {
        for (const rb of ratings) {
          for (const ls of loserScores) {
            const r = calculateBabyfootElo(ra, rb, 'A', 10, ls);
            expect(r.newA + r.newB).toBe(ra + rb);
          }
        }
      }
    });
  });
});
