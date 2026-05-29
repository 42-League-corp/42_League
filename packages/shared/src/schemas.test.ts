import { describe, it, expect } from 'vitest';
import {
  LoginSchema,
  MatchScoreSchema,
  DeclareMatchSchema,
  ConfirmMatchSchema,
  RejectMatchSchema,
  CreateChallengeSchema,
  RecordResultSchema,
  CreateTournamentSchema,
  SetTitleSchema,
  DeclareOpsSchema,
  TournamentRecordSchema,
  FeatureRequestSchema,
  SetRoleSchema,
  SetFeatureRequestStatusSchema,
} from './schemas.js';

// Helpers pour construire des dates stables relatives à maintenant.
const futureISO = (msAhead = 3_600_000) =>
  new Date(Date.now() + msAhead).toISOString();
const pastISO = (msBehind = 3_600_000) =>
  new Date(Date.now() - msBehind).toISOString();

describe('LoginSchema', () => {
  describe('cas valides (happy path)', () => {
    it('accepte un login minuscule simple', () => {
      expect(LoginSchema.safeParse('thomas').success).toBe(true);
    });
    it('accepte des chiffres', () => {
      expect(LoginSchema.safeParse('user42').success).toBe(true);
    });
    it('accepte uniquement des chiffres', () => {
      expect(LoginSchema.safeParse('123456').success).toBe(true);
    });
    it('accepte le tiret', () => {
      expect(LoginSchema.safeParse('jean-luc').success).toBe(true);
    });
    it('accepte le underscore', () => {
      expect(LoginSchema.safeParse('jean_luc').success).toBe(true);
    });
    it('accepte un mélange de tirets et underscores', () => {
      expect(LoginSchema.safeParse('a_b-c_1').success).toBe(true);
    });
    it('accepte un seul caractère (min 1)', () => {
      expect(LoginSchema.safeParse('a').success).toBe(true);
    });
  });

  describe('bornes de longueur', () => {
    it('accepte exactement 32 caractères', () => {
      expect(LoginSchema.safeParse('a'.repeat(32)).success).toBe(true);
    });
    it('rejette 33 caractères', () => {
      expect(LoginSchema.safeParse('a'.repeat(33)).success).toBe(false);
    });
    it('rejette la chaîne vide (min 1)', () => {
      expect(LoginSchema.safeParse('').success).toBe(false);
    });
  });

  describe('sécurité : caractères interdits', () => {
    // Le format intra 42 est strictement [a-z0-9_-]. Tout le reste est une
    // surface d'attaque potentielle (injection, homoglyphes, etc.).
    it('rejette les majuscules (anti-bypass de casse)', () => {
      expect(LoginSchema.safeParse('Thomas').success).toBe(false);
    });
    it('rejette une chaîne entièrement en majuscules', () => {
      expect(LoginSchema.safeParse('ADMIN').success).toBe(false);
    });
    it('rejette le point', () => {
      expect(LoginSchema.safeParse('jean.luc').success).toBe(false);
    });
    it('rejette les espaces', () => {
      expect(LoginSchema.safeParse('jean luc').success).toBe(false);
    });
    it('rejette un espace en tête/queue', () => {
      expect(LoginSchema.safeParse(' jean').success).toBe(false);
      expect(LoginSchema.safeParse('jean ').success).toBe(false);
    });
    it('rejette le caractère @', () => {
      expect(LoginSchema.safeParse('jean@42').success).toBe(false);
    });
    it('rejette les caractères accentués / unicode', () => {
      expect(LoginSchema.safeParse('jérôme').success).toBe(false);
    });
    it('rejette les émojis', () => {
      expect(LoginSchema.safeParse('user😀').success).toBe(false);
    });
    it("rejette une charge XSS", () => {
      expect(LoginSchema.safeParse('<script>alert(1)</script>').success).toBe(
        false,
      );
    });
    it('rejette une charge SQL-injection', () => {
      expect(LoginSchema.safeParse("admin'--").success).toBe(false);
      expect(LoginSchema.safeParse("' OR '1'='1").success).toBe(false);
    });
    it('rejette le slash et les traversées de chemin', () => {
      expect(LoginSchema.safeParse('../../etc/passwd').success).toBe(false);
    });
    it('rejette les retours à la ligne (anti CRLF injection)', () => {
      expect(LoginSchema.safeParse('jean\nluc').success).toBe(false);
      expect(LoginSchema.safeParse('jean\r\nluc').success).toBe(false);
    });
    it('rejette le null byte', () => {
      expect(LoginSchema.safeParse('jean' + String.fromCharCode(0) + 'luc').success).toBe(false);
    });
    it('rejette une très longue chaîne (DoS / overflow)', () => {
      expect(LoginSchema.safeParse('a'.repeat(10_000)).success).toBe(false);
    });
  });

  describe('violations de type', () => {
    it('rejette un nombre', () => {
      expect(LoginSchema.safeParse(42).success).toBe(false);
    });
    it('rejette null', () => {
      expect(LoginSchema.safeParse(null).success).toBe(false);
    });
    it('rejette undefined', () => {
      expect(LoginSchema.safeParse(undefined).success).toBe(false);
    });
    it('rejette un objet', () => {
      expect(LoginSchema.safeParse({}).success).toBe(false);
    });
    it('rejette un tableau', () => {
      expect(LoginSchema.safeParse(['a']).success).toBe(false);
    });
    it('rejette un booléen', () => {
      expect(LoginSchema.safeParse(true).success).toBe(false);
    });
  });
});

describe('MatchScoreSchema', () => {
  describe('cas valides', () => {
    it('accepte 0', () => {
      expect(MatchScoreSchema.safeParse(0).success).toBe(true);
    });
    it('accepte 5', () => {
      expect(MatchScoreSchema.safeParse(5).success).toBe(true);
    });
    it('accepte 10 (borne haute)', () => {
      expect(MatchScoreSchema.safeParse(10).success).toBe(true);
    });
    it('accepte -10 (borne basse, gamelles)', () => {
      expect(MatchScoreSchema.safeParse(-10).success).toBe(true);
    });
    it('accepte un score négatif intermédiaire', () => {
      expect(MatchScoreSchema.safeParse(-3).success).toBe(true);
    });
  });

  describe('bornes', () => {
    it('rejette 11 (au-dessus du max)', () => {
      expect(MatchScoreSchema.safeParse(11).success).toBe(false);
    });
    it('rejette -11 (sous le min)', () => {
      expect(MatchScoreSchema.safeParse(-11).success).toBe(false);
    });
    it('rejette un grand nombre positif', () => {
      expect(MatchScoreSchema.safeParse(1000).success).toBe(false);
    });
    it('rejette un grand nombre négatif', () => {
      expect(MatchScoreSchema.safeParse(-1000).success).toBe(false);
    });
  });

  describe('entiers uniquement', () => {
    it('rejette un float', () => {
      expect(MatchScoreSchema.safeParse(5.5).success).toBe(false);
    });
    it('rejette un float proche d’un entier', () => {
      expect(MatchScoreSchema.safeParse(9.999999).success).toBe(false);
    });
    it('rejette NaN', () => {
      expect(MatchScoreSchema.safeParse(NaN).success).toBe(false);
    });
    it('rejette Infinity', () => {
      expect(MatchScoreSchema.safeParse(Infinity).success).toBe(false);
    });
    it('rejette -Infinity', () => {
      expect(MatchScoreSchema.safeParse(-Infinity).success).toBe(false);
    });
  });

  describe('violations de type', () => {
    it('rejette une chaîne numérique (pas de coercion)', () => {
      expect(MatchScoreSchema.safeParse('5').success).toBe(false);
    });
    it('rejette null', () => {
      expect(MatchScoreSchema.safeParse(null).success).toBe(false);
    });
    it('rejette undefined', () => {
      expect(MatchScoreSchema.safeParse(undefined).success).toBe(false);
    });
    it('rejette un booléen', () => {
      expect(MatchScoreSchema.safeParse(true).success).toBe(false);
    });
    it('rejette un objet', () => {
      expect(MatchScoreSchema.safeParse({}).success).toBe(false);
    });
  });
});

// Les schémas de match partagent deux règles refine :
// (1) exactement un camp doit atteindre 10, (2) pas les deux à 10.
describe('DeclareMatchSchema', () => {
  describe('cas valides', () => {
    it('accepte 10-5', () => {
      expect(
        DeclareMatchSchema.safeParse({
          opponentLogin: 'bob',
          scoreSelf: 10,
          scoreOpponent: 5,
        }).success,
      ).toBe(true);
    });
    it('accepte 5-10', () => {
      expect(
        DeclareMatchSchema.safeParse({
          opponentLogin: 'bob',
          scoreSelf: 5,
          scoreOpponent: 10,
        }).success,
      ).toBe(true);
    });
    it('accepte 10-(-3) (gamelles côté perdant)', () => {
      expect(
        DeclareMatchSchema.safeParse({
          opponentLogin: 'bob',
          scoreSelf: 10,
          scoreOpponent: -3,
        }).success,
      ).toBe(true);
    });
    it('accepte 10-0', () => {
      expect(
        DeclareMatchSchema.safeParse({
          opponentLogin: 'bob',
          scoreSelf: 10,
          scoreOpponent: 0,
        }).success,
      ).toBe(true);
    });
    it('accepte 10-9 (match serré)', () => {
      expect(
        DeclareMatchSchema.safeParse({
          opponentLogin: 'bob',
          scoreSelf: 10,
          scoreOpponent: 9,
        }).success,
      ).toBe(true);
    });
  });

  describe('règles refine', () => {
    it('rejette 10-10 (les deux ne peuvent pas atteindre 10)', () => {
      expect(
        DeclareMatchSchema.safeParse({
          opponentLogin: 'bob',
          scoreSelf: 10,
          scoreOpponent: 10,
        }).success,
      ).toBe(false);
    });
    it('rejette 9-5 (aucun camp à 10)', () => {
      expect(
        DeclareMatchSchema.safeParse({
          opponentLogin: 'bob',
          scoreSelf: 9,
          scoreOpponent: 5,
        }).success,
      ).toBe(false);
    });
    it('rejette 0-0', () => {
      expect(
        DeclareMatchSchema.safeParse({
          opponentLogin: 'bob',
          scoreSelf: 0,
          scoreOpponent: 0,
        }).success,
      ).toBe(false);
    });
    it('rejette 9-9 (aucun à 10)', () => {
      expect(
        DeclareMatchSchema.safeParse({
          opponentLogin: 'bob',
          scoreSelf: 9,
          scoreOpponent: 9,
        }).success,
      ).toBe(false);
    });
  });

  describe('validation des champs imbriqués', () => {
    it('rejette un opponentLogin invalide (majuscules)', () => {
      expect(
        DeclareMatchSchema.safeParse({
          opponentLogin: 'BOB',
          scoreSelf: 10,
          scoreOpponent: 5,
        }).success,
      ).toBe(false);
    });
    it('rejette un score hors borne (11)', () => {
      expect(
        DeclareMatchSchema.safeParse({
          opponentLogin: 'bob',
          scoreSelf: 11,
          scoreOpponent: 5,
        }).success,
      ).toBe(false);
    });
    it('rejette un opponentLogin manquant', () => {
      expect(
        DeclareMatchSchema.safeParse({
          scoreSelf: 10,
          scoreOpponent: 5,
        }).success,
      ).toBe(false);
    });
    it('rejette scoreSelf manquant', () => {
      expect(
        DeclareMatchSchema.safeParse({
          opponentLogin: 'bob',
          scoreOpponent: 5,
        }).success,
      ).toBe(false);
    });
    it('rejette un score sous forme de chaîne', () => {
      expect(
        DeclareMatchSchema.safeParse({
          opponentLogin: 'bob',
          scoreSelf: '10',
          scoreOpponent: 5,
        }).success,
      ).toBe(false);
    });
    it('ignore les champs supplémentaires (strip par défaut)', () => {
      const r = DeclareMatchSchema.safeParse({
        opponentLogin: 'bob',
        scoreSelf: 10,
        scoreOpponent: 5,
        isAdmin: true,
      });
      expect(r.success).toBe(true);
      if (r.success) {
        // Le champ injecté ne doit pas être conservé.
        expect('isAdmin' in r.data).toBe(false);
      }
    });
    it('rejette null', () => {
      expect(DeclareMatchSchema.safeParse(null).success).toBe(false);
    });
    it('rejette undefined', () => {
      expect(DeclareMatchSchema.safeParse(undefined).success).toBe(false);
    });
    it('rejette un objet vide', () => {
      expect(DeclareMatchSchema.safeParse({}).success).toBe(false);
    });
  });
});

describe('ConfirmMatchSchema', () => {
  it('accepte 10-5', () => {
    expect(
      ConfirmMatchSchema.safeParse({ scoreSelf: 10, scoreOpponent: 5 }).success,
    ).toBe(true);
  });
  it('accepte 5-10', () => {
    expect(
      ConfirmMatchSchema.safeParse({ scoreSelf: 5, scoreOpponent: 10 }).success,
    ).toBe(true);
  });
  it('accepte 10-(-10)', () => {
    expect(
      ConfirmMatchSchema.safeParse({ scoreSelf: 10, scoreOpponent: -10 })
        .success,
    ).toBe(true);
  });
  it('rejette 10-10', () => {
    expect(
      ConfirmMatchSchema.safeParse({ scoreSelf: 10, scoreOpponent: 10 }).success,
    ).toBe(false);
  });
  it('rejette 9-5 (aucun à 10)', () => {
    expect(
      ConfirmMatchSchema.safeParse({ scoreSelf: 9, scoreOpponent: 5 }).success,
    ).toBe(false);
  });
  it('rejette un score float', () => {
    expect(
      ConfirmMatchSchema.safeParse({ scoreSelf: 10, scoreOpponent: 5.5 })
        .success,
    ).toBe(false);
  });
  it('rejette un champ manquant', () => {
    expect(ConfirmMatchSchema.safeParse({ scoreSelf: 10 }).success).toBe(false);
  });
  it('rejette null', () => {
    expect(ConfirmMatchSchema.safeParse(null).success).toBe(false);
  });
});

describe('RejectMatchSchema', () => {
  describe('cas valides', () => {
    it('accepte never_played avec un message valide', () => {
      expect(
        RejectMatchSchema.safeParse({
          contestReason: 'never_played',
          contestMessage: 'On a jamais joué ce match ensemble.',
        }).success,
      ).toBe(true);
    });
    it('accepte wrong_score avec un message valide', () => {
      expect(
        RejectMatchSchema.safeParse({
          contestReason: 'wrong_score',
          contestMessage: 'Le score était 10-7 et non 10-2.',
        }).success,
      ).toBe(true);
    });
    it('accepte un message d’exactement 10 caractères', () => {
      expect(
        RejectMatchSchema.safeParse({
          contestReason: 'wrong_score',
          contestMessage: 'a'.repeat(10),
        }).success,
      ).toBe(true);
    });
    it('accepte un message d’exactement 500 caractères', () => {
      expect(
        RejectMatchSchema.safeParse({
          contestReason: 'wrong_score',
          contestMessage: 'a'.repeat(500),
        }).success,
      ).toBe(true);
    });
  });

  describe('bornes du message', () => {
    it('rejette un message de 9 caractères (sous min)', () => {
      expect(
        RejectMatchSchema.safeParse({
          contestReason: 'wrong_score',
          contestMessage: 'a'.repeat(9),
        }).success,
      ).toBe(false);
    });
    it('rejette un message de 501 caractères (au-dessus max)', () => {
      expect(
        RejectMatchSchema.safeParse({
          contestReason: 'wrong_score',
          contestMessage: 'a'.repeat(501),
        }).success,
      ).toBe(false);
    });
    it('rejette un message vide', () => {
      expect(
        RejectMatchSchema.safeParse({
          contestReason: 'wrong_score',
          contestMessage: '',
        }).success,
      ).toBe(false);
    });
  });

  describe('enum contestReason', () => {
    it('rejette une raison hors enum', () => {
      expect(
        RejectMatchSchema.safeParse({
          contestReason: 'parce_que',
          contestMessage: 'a'.repeat(20),
        }).success,
      ).toBe(false);
    });
    it('rejette une raison vide', () => {
      expect(
        RejectMatchSchema.safeParse({
          contestReason: '',
          contestMessage: 'a'.repeat(20),
        }).success,
      ).toBe(false);
    });
    it('est sensible à la casse de l’enum', () => {
      expect(
        RejectMatchSchema.safeParse({
          contestReason: 'WRONG_SCORE',
          contestMessage: 'a'.repeat(20),
        }).success,
      ).toBe(false);
    });
  });

  describe('sécurité', () => {
    it('accepte un message contenant une charge XSS (le contenu est traité ailleurs)', () => {
      // Le schéma valide la longueur, pas l'échappement ; on documente le comportement.
      expect(
        RejectMatchSchema.safeParse({
          contestReason: 'wrong_score',
          contestMessage: '<script>alert(1)</script> ce score est faux',
        }).success,
      ).toBe(true);
    });
    it('rejette un champ manquant', () => {
      expect(
        RejectMatchSchema.safeParse({ contestReason: 'wrong_score' }).success,
      ).toBe(false);
    });
    it('rejette null', () => {
      expect(RejectMatchSchema.safeParse(null).success).toBe(false);
    });
  });
});

describe('CreateChallengeSchema', () => {
  describe('cas valides', () => {
    it('accepte un opponentLogin valide + date future', () => {
      expect(
        CreateChallengeSchema.safeParse({
          opponentLogin: 'bob',
          scheduledAt: futureISO(),
        }).success,
      ).toBe(true);
    });
    it('accepte une date dans la dernière minute de tolérance', () => {
      // -30s est dans la fenêtre de tolérance de 60s.
      expect(
        CreateChallengeSchema.safeParse({
          opponentLogin: 'bob',
          scheduledAt: pastISO(30_000),
        }).success,
      ).toBe(true);
    });
  });

  describe('contrainte temporelle', () => {
    it('rejette une date passée (2020)', () => {
      expect(
        CreateChallengeSchema.safeParse({
          opponentLogin: 'bob',
          scheduledAt: '2020-01-01T00:00:00.000Z',
        }).success,
      ).toBe(false);
    });
    it('rejette une date passée de plus d’une minute', () => {
      expect(
        CreateChallengeSchema.safeParse({
          opponentLogin: 'bob',
          scheduledAt: pastISO(120_000),
        }).success,
      ).toBe(false);
    });
  });

  describe('format de la date', () => {
    it('rejette une chaîne non-ISO', () => {
      expect(
        CreateChallengeSchema.safeParse({
          opponentLogin: 'bob',
          scheduledAt: 'demain',
        }).success,
      ).toBe(false);
    });
    it('rejette une date sans heure', () => {
      expect(
        CreateChallengeSchema.safeParse({
          opponentLogin: 'bob',
          scheduledAt: '2099-01-01',
        }).success,
      ).toBe(false);
    });
    it('rejette un timestamp numérique', () => {
      expect(
        CreateChallengeSchema.safeParse({
          opponentLogin: 'bob',
          scheduledAt: Date.now() + 3_600_000,
        }).success,
      ).toBe(false);
    });
  });

  describe('validation des champs', () => {
    it('rejette un opponentLogin invalide', () => {
      expect(
        CreateChallengeSchema.safeParse({
          opponentLogin: 'BOB',
          scheduledAt: futureISO(),
        }).success,
      ).toBe(false);
    });
    it('rejette scheduledAt manquant', () => {
      expect(
        CreateChallengeSchema.safeParse({ opponentLogin: 'bob' }).success,
      ).toBe(false);
    });
    it('rejette opponentLogin manquant', () => {
      expect(
        CreateChallengeSchema.safeParse({ scheduledAt: futureISO() }).success,
      ).toBe(false);
    });
    it('rejette null', () => {
      expect(CreateChallengeSchema.safeParse(null).success).toBe(false);
    });
  });
});

describe('RecordResultSchema', () => {
  it('accepte 10-5', () => {
    expect(
      RecordResultSchema.safeParse({ scoreSelf: 10, scoreOpponent: 5 }).success,
    ).toBe(true);
  });
  it('accepte 5-10', () => {
    expect(
      RecordResultSchema.safeParse({ scoreSelf: 5, scoreOpponent: 10 }).success,
    ).toBe(true);
  });
  it('rejette 10-10', () => {
    expect(
      RecordResultSchema.safeParse({ scoreSelf: 10, scoreOpponent: 10 })
        .success,
    ).toBe(false);
  });
  it('rejette 8-3 (aucun à 10)', () => {
    expect(
      RecordResultSchema.safeParse({ scoreSelf: 8, scoreOpponent: 3 }).success,
    ).toBe(false);
  });
  it('rejette un score hors borne', () => {
    expect(
      RecordResultSchema.safeParse({ scoreSelf: 10, scoreOpponent: -11 })
        .success,
    ).toBe(false);
  });
  it('rejette un champ manquant', () => {
    expect(RecordResultSchema.safeParse({ scoreSelf: 10 }).success).toBe(false);
  });
});

describe('CreateTournamentSchema', () => {
  describe('cas valides', () => {
    it('accepte un tournoi de capacité 2', () => {
      expect(
        CreateTournamentSchema.safeParse({ name: 'Cup', capacity: 2 }).success,
      ).toBe(true);
    });
    it('accepte un tournoi de capacité 4', () => {
      expect(
        CreateTournamentSchema.safeParse({ name: 'Cup', capacity: 4 }).success,
      ).toBe(true);
    });
    it('applique kind=friendly par défaut', () => {
      const r = CreateTournamentSchema.safeParse({ name: 'Cup', capacity: 2 });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.kind).toBe('friendly');
    });
    it('accepte kind=official explicite', () => {
      const r = CreateTournamentSchema.safeParse({
        name: 'Cup',
        capacity: 4,
        kind: 'official',
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.kind).toBe('official');
    });
    it('accepte un nom de 2 caractères (min)', () => {
      expect(
        CreateTournamentSchema.safeParse({ name: 'ab', capacity: 2 }).success,
      ).toBe(true);
    });
    it('accepte un nom de 60 caractères (max)', () => {
      expect(
        CreateTournamentSchema.safeParse({ name: 'a'.repeat(60), capacity: 2 })
          .success,
      ).toBe(true);
    });
  });

  describe('bornes et enums', () => {
    it('rejette un nom de 1 caractère', () => {
      expect(
        CreateTournamentSchema.safeParse({ name: 'a', capacity: 2 }).success,
      ).toBe(false);
    });
    it('rejette un nom de 61 caractères', () => {
      expect(
        CreateTournamentSchema.safeParse({ name: 'a'.repeat(61), capacity: 2 })
          .success,
      ).toBe(false);
    });
    it('rejette une capacité de 3 (hors literals)', () => {
      expect(
        CreateTournamentSchema.safeParse({ name: 'Cup', capacity: 3 }).success,
      ).toBe(false);
    });
    it('rejette une capacité de 8', () => {
      expect(
        CreateTournamentSchema.safeParse({ name: 'Cup', capacity: 8 }).success,
      ).toBe(false);
    });
    it('rejette une capacité sous forme de chaîne', () => {
      expect(
        CreateTournamentSchema.safeParse({ name: 'Cup', capacity: '2' }).success,
      ).toBe(false);
    });
    it('rejette un kind hors enum', () => {
      expect(
        CreateTournamentSchema.safeParse({
          name: 'Cup',
          capacity: 2,
          kind: 'ranked',
        }).success,
      ).toBe(false);
    });
  });

  describe('champs manquants / types', () => {
    it('rejette un nom manquant', () => {
      expect(CreateTournamentSchema.safeParse({ capacity: 2 }).success).toBe(
        false,
      );
    });
    it('rejette une capacité manquante', () => {
      expect(CreateTournamentSchema.safeParse({ name: 'Cup' }).success).toBe(
        false,
      );
    });
    it('rejette null', () => {
      expect(CreateTournamentSchema.safeParse(null).success).toBe(false);
    });
  });
});

describe('SetTitleSchema', () => {
  describe('cas valides', () => {
    it('accepte null (titre effacé)', () => {
      expect(SetTitleSchema.safeParse({ title: null }).success).toBe(true);
    });
    it('accepte un titre normal', () => {
      expect(SetTitleSchema.safeParse({ title: 'Champion' }).success).toBe(true);
    });
    it('accepte une chaîne de 40 caractères (max)', () => {
      expect(SetTitleSchema.safeParse({ title: 'a'.repeat(40) }).success).toBe(
        true,
      );
    });
    it('accepte une chaîne vide (max seulement, pas de min)', () => {
      expect(SetTitleSchema.safeParse({ title: '' }).success).toBe(true);
    });
  });

  describe('trim et bornes', () => {
    it('rejette 41 caractères', () => {
      expect(SetTitleSchema.safeParse({ title: 'a'.repeat(41) }).success).toBe(
        false,
      );
    });
    it('applique le trim au résultat', () => {
      const r = SetTitleSchema.safeParse({ title: '  Champion  ' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.title).toBe('Champion');
    });
    it('trim AVANT validation du max : 40 chars + espaces autour passe', () => {
      // Le trim s'applique avant le max ; 40 chars utiles entourés d'espaces => valide.
      const r = SetTitleSchema.safeParse({ title: '  ' + 'a'.repeat(40) + '  ' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.title).toBe('a'.repeat(40));
    });
  });

  describe('violations de type', () => {
    it('rejette un nombre', () => {
      expect(SetTitleSchema.safeParse({ title: 42 }).success).toBe(false);
    });
    it('rejette undefined (champ requis même si nullable)', () => {
      expect(SetTitleSchema.safeParse({}).success).toBe(false);
    });
    it('rejette null à la racine', () => {
      expect(SetTitleSchema.safeParse(null).success).toBe(false);
    });
  });
});

describe('DeclareOpsSchema', () => {
  it('accepte un targetLogin valide', () => {
    expect(DeclareOpsSchema.safeParse({ targetLogin: 'bob' }).success).toBe(
      true,
    );
  });
  it('rejette un targetLogin en majuscules', () => {
    expect(DeclareOpsSchema.safeParse({ targetLogin: 'BOB' }).success).toBe(
      false,
    );
  });
  it('rejette une injection dans targetLogin', () => {
    expect(
      DeclareOpsSchema.safeParse({ targetLogin: "'; DROP TABLE users;--" })
        .success,
    ).toBe(false);
  });
  it('rejette targetLogin manquant', () => {
    expect(DeclareOpsSchema.safeParse({}).success).toBe(false);
  });
  it('rejette null', () => {
    expect(DeclareOpsSchema.safeParse(null).success).toBe(false);
  });
});

describe('TournamentRecordSchema', () => {
  it('accepte 10-5 (scoreA / scoreB)', () => {
    expect(
      TournamentRecordSchema.safeParse({ scoreA: 10, scoreB: 5 }).success,
    ).toBe(true);
  });
  it('accepte 4-10', () => {
    expect(
      TournamentRecordSchema.safeParse({ scoreA: 4, scoreB: 10 }).success,
    ).toBe(true);
  });
  it('rejette 10-10', () => {
    expect(
      TournamentRecordSchema.safeParse({ scoreA: 10, scoreB: 10 }).success,
    ).toBe(false);
  });
  it('rejette 7-3 (aucun à 10)', () => {
    expect(
      TournamentRecordSchema.safeParse({ scoreA: 7, scoreB: 3 }).success,
    ).toBe(false);
  });
  it('rejette un score hors borne', () => {
    expect(
      TournamentRecordSchema.safeParse({ scoreA: 10, scoreB: 11 }).success,
    ).toBe(false);
  });
  it('rejette un champ manquant', () => {
    expect(TournamentRecordSchema.safeParse({ scoreA: 10 }).success).toBe(false);
  });
  it('rejette null', () => {
    expect(TournamentRecordSchema.safeParse(null).success).toBe(false);
  });
});

describe('FeatureRequestSchema', () => {
  it('accepte un texte valide', () => {
    expect(
      FeatureRequestSchema.safeParse({
        text: 'Ajouter un mode tournoi en double.',
      }).success,
    ).toBe(true);
  });
  it('accepte exactement 10 caractères (min)', () => {
    expect(FeatureRequestSchema.safeParse({ text: 'a'.repeat(10) }).success).toBe(
      true,
    );
  });
  it('accepte exactement 500 caractères (max)', () => {
    expect(
      FeatureRequestSchema.safeParse({ text: 'a'.repeat(500) }).success,
    ).toBe(true);
  });
  it('rejette 9 caractères (sous min)', () => {
    expect(FeatureRequestSchema.safeParse({ text: 'a'.repeat(9) }).success).toBe(
      false,
    );
  });
  it('rejette 501 caractères (au-dessus max)', () => {
    expect(
      FeatureRequestSchema.safeParse({ text: 'a'.repeat(501) }).success,
    ).toBe(false);
  });
  it('rejette un texte vide', () => {
    expect(FeatureRequestSchema.safeParse({ text: '' }).success).toBe(false);
  });
  it('rejette text manquant', () => {
    expect(FeatureRequestSchema.safeParse({}).success).toBe(false);
  });
  it('rejette un text non-string', () => {
    expect(FeatureRequestSchema.safeParse({ text: 12345 }).success).toBe(false);
  });
  it('rejette null', () => {
    expect(FeatureRequestSchema.safeParse(null).success).toBe(false);
  });
});

describe('SetRoleSchema', () => {
  it('accepte USER', () => {
    expect(SetRoleSchema.safeParse({ role: 'USER' }).success).toBe(true);
  });
  it('accepte ADMIN', () => {
    expect(SetRoleSchema.safeParse({ role: 'ADMIN' }).success).toBe(true);
  });

  // GARDE-FOU CRITIQUE contre l'escalade de privilèges : le rôle SUPERADMIN
  // ne doit JAMAIS pouvoir être accordé via l'API.
  it('SÉCURITÉ : rejette SUPERADMIN (anti escalade de privilèges)', () => {
    expect(SetRoleSchema.safeParse({ role: 'SUPERADMIN' }).success).toBe(false);
  });
  it('SÉCURITÉ : rejette un rôle arbitraire (root)', () => {
    expect(SetRoleSchema.safeParse({ role: 'root' }).success).toBe(false);
  });
  it('SÉCURITÉ : est sensible à la casse (user minuscule rejeté)', () => {
    expect(SetRoleSchema.safeParse({ role: 'user' }).success).toBe(false);
    expect(SetRoleSchema.safeParse({ role: 'admin' }).success).toBe(false);
  });
  it('rejette un rôle vide', () => {
    expect(SetRoleSchema.safeParse({ role: '' }).success).toBe(false);
  });
  it('rejette role manquant', () => {
    expect(SetRoleSchema.safeParse({}).success).toBe(false);
  });
  it('rejette null', () => {
    expect(SetRoleSchema.safeParse(null).success).toBe(false);
  });
});

describe('SetFeatureRequestStatusSchema', () => {
  it('accepte pending', () => {
    expect(
      SetFeatureRequestStatusSchema.safeParse({ status: 'pending' }).success,
    ).toBe(true);
  });
  it('accepte accepted', () => {
    expect(
      SetFeatureRequestStatusSchema.safeParse({ status: 'accepted' }).success,
    ).toBe(true);
  });
  it('accepte rejected', () => {
    expect(
      SetFeatureRequestStatusSchema.safeParse({ status: 'rejected' }).success,
    ).toBe(true);
  });
  it('rejette un statut hors enum', () => {
    expect(
      SetFeatureRequestStatusSchema.safeParse({ status: 'deleted' }).success,
    ).toBe(false);
  });
  it('est sensible à la casse', () => {
    expect(
      SetFeatureRequestStatusSchema.safeParse({ status: 'PENDING' }).success,
    ).toBe(false);
  });
  it('rejette un statut vide', () => {
    expect(
      SetFeatureRequestStatusSchema.safeParse({ status: '' }).success,
    ).toBe(false);
  });
  it('rejette status manquant', () => {
    expect(SetFeatureRequestStatusSchema.safeParse({}).success).toBe(false);
  });
  it('rejette null', () => {
    expect(SetFeatureRequestStatusSchema.safeParse(null).success).toBe(false);
  });
});
