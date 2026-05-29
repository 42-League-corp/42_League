import { describe, it, expect } from 'vitest';
import {
  shouldCountForElo,
  ANTI_FARMING_WINDOW_DAYS,
  MAX_COUNTED_PER_PAIR_PER_WINDOW,
  type PriorMatch,
} from './anti-farming.js';

const day = (n: number) => new Date(2026, 0, n);

// Base date fixe pour des tests deterministes (UTC).
const base = new Date('2026-01-15T12:00:00Z');
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const windowStart = new Date(base.getTime() - ANTI_FARMING_WINDOW_DAYS * MS_PER_DAY);

const counted = (playedAt: Date): PriorMatch => ({ playedAt, countedForElo: true });
const uncounted = (playedAt: Date): PriorMatch => ({ playedAt, countedForElo: false });
const offset = (ms: number) => new Date(base.getTime() + ms);

describe('constants', () => {
  it('fenetre anti-farming = 7 jours', () => {
    expect(ANTI_FARMING_WINDOW_DAYS).toBe(7);
  });

  it('plafond de matchs comptes par paire = 2', () => {
    expect(MAX_COUNTED_PER_PAIR_PER_WINDOW).toBe(2);
  });
});

describe('shouldCountForElo', () => {
  // --- Cas existants conserves ---
  it('counts when no prior matches exist', () => {
    expect(shouldCountForElo([], day(10))).toBe(true);
  });

  it('counts the second match in the window', () => {
    expect(
      shouldCountForElo([{ playedAt: day(8), countedForElo: true }], day(10)),
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
    const priors = Array.from(
      { length: MAX_COUNTED_PER_PAIR_PER_WINDOW },
      () => ({ playedAt: day(9), countedForElo: true }),
    );
    expect(shouldCountForElo(priors, day(10))).toBe(false);
  });

  // --- Comptage de base sous / au / au-dessus du plafond ---
  describe('comptage sous, au et au-dessus du plafond', () => {
    it('historique vide => autorise', () => {
      expect(shouldCountForElo([], base)).toBe(true);
    });

    it('1 match compte dans la fenetre => autorise (sous le plafond)', () => {
      expect(shouldCountForElo([counted(offset(-MS_PER_DAY))], base)).toBe(true);
    });

    it('2 matchs comptes dans la fenetre => refuse (plafond atteint)', () => {
      expect(
        shouldCountForElo(
          [counted(offset(-MS_PER_DAY)), counted(offset(-2 * MS_PER_DAY))],
          base,
        ),
      ).toBe(false);
    });

    it('3 matchs comptes dans la fenetre => refuse', () => {
      expect(
        shouldCountForElo(
          [
            counted(offset(-MS_PER_DAY)),
            counted(offset(-2 * MS_PER_DAY)),
            counted(offset(-3 * MS_PER_DAY)),
          ],
          base,
        ),
      ).toBe(false);
    });

    it('10 matchs comptes dans la fenetre => refuse', () => {
      const priors = Array.from({ length: 10 }, (_, i) =>
        counted(offset(-(i + 1) * 1000)),
      );
      expect(shouldCountForElo(priors, base)).toBe(false);
    });
  });

  // --- Propriete de securite: les matchs non comptes ne consomment pas le quota ---
  describe('propriete de securite: countedForElo===false ne consomme pas le quota', () => {
    it('5 non comptes + 1 compte => autorise (seul le compte compte)', () => {
      const priors: PriorMatch[] = [
        uncounted(offset(-1000)),
        uncounted(offset(-2000)),
        uncounted(offset(-3000)),
        uncounted(offset(-4000)),
        uncounted(offset(-5000)),
        counted(offset(-6000)),
      ];
      expect(shouldCountForElo(priors, base)).toBe(true);
    });

    it('100 matchs non comptes dans la fenetre => autorise', () => {
      const priors = Array.from({ length: 100 }, (_, i) =>
        uncounted(offset(-(i + 1) * 1000)),
      );
      expect(shouldCountForElo(priors, base)).toBe(true);
    });

    it('2 non comptes + 2 comptes => refuse (les 2 comptes atteignent le plafond)', () => {
      const priors: PriorMatch[] = [
        uncounted(offset(-1000)),
        counted(offset(-2000)),
        uncounted(offset(-3000)),
        counted(offset(-4000)),
      ];
      expect(shouldCountForElo(priors, base)).toBe(false);
    });
  });

  // --- Precision des bornes de la fenetre ---
  describe('precision des bornes de la fenetre', () => {
    it('un match exactement a windowStart est inclus (>= windowStart)', () => {
      // Deux matchs exactement a la borne basse comptent => plafond atteint.
      expect(
        shouldCountForElo([counted(windowStart), counted(windowStart)], base),
      ).toBe(false);
    });

    it('un seul match exactement a windowStart => autorise (sous le plafond)', () => {
      expect(shouldCountForElo([counted(windowStart)], base)).toBe(true);
    });

    it('un match 1ms avant windowStart est exclu', () => {
      const justBefore = new Date(windowStart.getTime() - 1);
      // Un seul match valide a la borne, l'autre exclu => sous le plafond.
      expect(
        shouldCountForElo([counted(justBefore), counted(windowStart)], base),
      ).toBe(true);
    });

    it('un match exactement a newMatchAt est exclu (< newMatchAt)', () => {
      // Le match a base lui-meme ne compte pas; reste 1 valide => autorise.
      expect(
        shouldCountForElo([counted(base), counted(offset(-1000))], base),
      ).toBe(true);
    });

    it('un match 1ms avant newMatchAt compte', () => {
      const oneMsBefore = new Date(base.getTime() - 1);
      expect(
        shouldCountForElo([counted(oneMsBefore), counted(offset(-1000))], base),
      ).toBe(false);
    });

    it('un match juste hors fenetre (plus vieux) ne compte pas', () => {
      const justOutside = new Date(windowStart.getTime() - 1);
      expect(
        shouldCountForElo(
          [counted(justOutside), counted(offset(-1000))],
          base,
        ),
      ).toBe(true);
    });

    it('un match exactement 7 jours + 1ms plus vieux est exclu', () => {
      const tooOld = new Date(base.getTime() - ANTI_FARMING_WINDOW_DAYS * MS_PER_DAY - 1);
      expect(shouldCountForElo([counted(tooOld), counted(tooOld)], base)).toBe(true);
    });
  });

  // --- Matchs dans le futur ---
  describe('matchs dans le futur relatif a newMatchAt', () => {
    it('un match dans le futur est exclu', () => {
      expect(shouldCountForElo([counted(offset(MS_PER_DAY))], base)).toBe(true);
    });

    it('deux matchs dans le futur sont exclus => autorise', () => {
      expect(
        shouldCountForElo(
          [counted(offset(MS_PER_DAY)), counted(offset(2 * MS_PER_DAY))],
          base,
        ),
      ).toBe(true);
    });

    it('futurs + 2 comptes valides => refuse', () => {
      expect(
        shouldCountForElo(
          [
            counted(offset(MS_PER_DAY)),
            counted(offset(-1000)),
            counted(offset(-2000)),
          ],
          base,
        ),
      ).toBe(false);
    });
  });

  // --- Scenarios mixtes ---
  describe('scenarios mixtes', () => {
    it('anciens comptes (hors fenetre) + 1 recent compte => autorise', () => {
      const priors: PriorMatch[] = [
        counted(offset(-30 * MS_PER_DAY)),
        counted(offset(-20 * MS_PER_DAY)),
        counted(offset(-10 * MS_PER_DAY)),
        counted(offset(-1 * MS_PER_DAY)),
      ];
      expect(shouldCountForElo(priors, base)).toBe(true);
    });

    it('anciens comptes (hors fenetre) + 2 recents comptes => refuse', () => {
      const priors: PriorMatch[] = [
        counted(offset(-30 * MS_PER_DAY)),
        counted(offset(-2 * MS_PER_DAY)),
        counted(offset(-1 * MS_PER_DAY)),
      ];
      expect(shouldCountForElo(priors, base)).toBe(false);
    });

    it('melange de comptes/non comptes hors et dans fenetre', () => {
      const priors: PriorMatch[] = [
        counted(offset(-30 * MS_PER_DAY)), // hors fenetre
        uncounted(offset(-1 * MS_PER_DAY)), // dans fenetre mais non compte
        uncounted(offset(-2 * MS_PER_DAY)), // dans fenetre mais non compte
        counted(offset(-3 * MS_PER_DAY)), // dans fenetre, compte (1)
      ];
      expect(shouldCountForElo(priors, base)).toBe(true);
    });

    it('ordre des matchs non significatif', () => {
      const priors: PriorMatch[] = [
        counted(offset(-1000)),
        uncounted(offset(-3000)),
        counted(offset(-2000)),
      ];
      const shuffled: PriorMatch[] = [
        uncounted(offset(-3000)),
        counted(offset(-2000)),
        counted(offset(-1000)),
      ];
      expect(shouldCountForElo(priors, base)).toBe(false);
      expect(shouldCountForElo(shuffled, base)).toBe(false);
    });
  });

  // --- Scenario d'exploit de farming ---
  describe("scenario d'exploit: impossible de farmer le meme adversaire", () => {
    it('apres 2 matchs comptes, le 3eme ne peut pas compter', () => {
      // Propriete de securite centrale: deux victoires comptees dans la fenetre
      // verrouillent toute nouvelle prise en compte ELO contre la meme paire.
      const history: PriorMatch[] = [];
      const t1 = offset(-3 * MS_PER_DAY);
      const t2 = offset(-2 * MS_PER_DAY);
      const t3 = base;

      // 1er match: aucun prior => compte.
      expect(shouldCountForElo(history, t1)).toBe(true);
      history.push(counted(t1));

      // 2eme match: 1 prior compte => compte encore.
      expect(shouldCountForElo(history, t2)).toBe(true);
      history.push(counted(t2));

      // 3eme match: 2 priors comptes dans la fenetre => NE compte pas.
      expect(shouldCountForElo(history, t3)).toBe(false);
    });

    it("rejoue intensif (10 matchs en 1 jour) => seuls 2 peuvent compter", () => {
      const history: PriorMatch[] = [];
      let allowedCount = 0;
      for (let i = 0; i < 10; i++) {
        const at = offset(-10 * MS_PER_DAY + i * (MS_PER_DAY / 24)); // toutes les heures
        const allowed = shouldCountForElo(history, at);
        if (allowed) {
          allowedCount++;
          history.push(counted(at));
        } else {
          history.push(uncounted(at));
        }
      }
      // Au plus 2 dans n'importe quelle fenetre glissante de 7j ici (tous dans ~10h).
      expect(allowedCount).toBe(MAX_COUNTED_PER_PAIR_PER_WINDOW);
    });

    it('le quota se reouvre apres glissement de la fenetre (apres 7 jours)', () => {
      // Deux matchs comptes aux jours 0 et 1; un nouveau match 8 jours plus tard
      // ne voit plus le 1er (hors fenetre) mais voit le 2eme => sous le plafond.
      const d0 = base;
      const d1 = offset(1 * MS_PER_DAY);
      const d8 = offset(8 * MS_PER_DAY);
      const history: PriorMatch[] = [counted(d0), counted(d1)];
      // d0 est a d8 - 8j => hors fenetre; d1 est a d8 - 7j => dans la fenetre (1 seul).
      expect(shouldCountForElo(history, d8)).toBe(true);
    });
  });

  // --- Robustesse / cas limites de donnees ---
  describe('robustesse', () => {
    it('matchs au meme instant exact comptent tous les deux', () => {
      const sameTs = offset(-1000);
      expect(
        shouldCountForElo([counted(sameTs), counted(sameTs)], base),
      ).toBe(false);
    });

    it('un seul match compte au meme instant => autorise', () => {
      const sameTs = offset(-1000);
      expect(shouldCountForElo([counted(sameTs)], base)).toBe(true);
    });

    it('compatibilite avec le constructeur de date local (day())', () => {
      expect(
        shouldCountForElo(
          [counted(day(8)), uncounted(day(9))],
          day(10),
        ),
      ).toBe(true);
    });
  });
});
