import { z } from 'zod';

export const LoginSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9_-]+$/, 'login must match the 42 intra login format');

// Foosball score : le perdant peut descendre sous 0 à cause des gamelles
// (penalty d'auto-but). Borne inférieure -10 = 10 gamelles avant que le
// gagnant n'atteigne 10. Borne supérieure 10 = victoire stricte d'un seul camp.
export const MatchScoreSchema = z.number().int().min(-10).max(10);

// ─── Multi-jeu (babyfoot | smash | chess | streetfighter) ────────────────────
export const GameSchema = z.enum(['babyfoot', 'smash', 'chess', 'streetfighter']);
export type Game = z.infer<typeof GameSchema>;
export const SmashBestOfSchema = z.union([z.literal(3), z.literal(5)]);
export const SmashCharSchema = z.string().trim().min(1).max(40);
export const SmashStockSchema = z.number().int().min(1).max(3);

// Personnages favoris (« mains ») configurables par le joueur, par jeu de combat.
// Liste libre (illimitée côté produit) ; cap de sécurité + dédup faits côté route.
// Seules les clés fournies sont mises à jour (PATCH partiel).
export const FAVORITES_MAX = 200;
export const FavoritesUpdateSchema = z
  .object({
    smash: z.array(SmashCharSchema).max(FAVORITES_MAX).optional(),
    streetfighter: z.array(SmashCharSchema).max(FAVORITES_MAX).optional(),
  })
  .strict();
export type FavoritesUpdate = z.infer<typeof FavoritesUpdateSchema>;

/** Champs communs aux déclarations/confirmations, indépendants du jeu. */
const matchScoreShape = {
  scoreSelf: MatchScoreSchema,
  scoreOpponent: MatchScoreSchema,
  game: GameSchema.default('babyfoot'),
  // Smash uniquement. `.nullish()` + transform : les jeux non-smash (babyfoot,
  // échecs) envoient `bestOf: null` → on l'accepte et on le ramène à `undefined`
  // (sinon Zod rejette `null` contre le union de littéraux → 400 à la confirmation).
  bestOf: SmashBestOfSchema.nullish().transform((v) => v ?? undefined),
  charSelf: SmashCharSchema.optional(),
  charOpponent: SmashCharSchema.optional(),
  // Vies (stocks) restantes du gagnant au game décisif.
  stocks: SmashStockSchema.optional(),
};

interface MatchScores {
  scoreSelf: number;
  scoreOpponent: number;
  game: Game;
  bestOf?: number;
  charSelf?: string;
  charOpponent?: string;
}

/**
 * Validation des scores selon le jeu :
 *  - babyfoot : un seul camp atteint 10 ;
 *  - smash : set Bo3/Bo5, le gagnant atteint exactement la cible (2 ou 3),
 *    le perdant en dessous, et les deux persos sont renseignés.
 */
function makeRefiner(requireChars: boolean) {
  return (m: MatchScores, ctx: z.RefinementCtx): void => {
    if (m.game === 'chess') {
      // Échecs : résultat binaire (1 = vainqueur, 0 = perdant), un seul vainqueur.
      const hi = Math.max(m.scoreSelf, m.scoreOpponent);
      const lo = Math.min(m.scoreSelf, m.scoreOpponent);
      if (hi !== 1 || lo !== 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'chess score must be 1 (win) – 0 (loss)' });
      }
      return;
    }
    if (m.game === 'smash' || m.game === 'streetfighter') {
      // Street Fighter == Smash mécaniquement : set Bo3/Bo5, persos requis.
      if (!m.bestOf) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'bestOf required for set games (3 or 5)' });
        return;
      }
      const target = Math.ceil(m.bestOf / 2);
      const hi = Math.max(m.scoreSelf, m.scoreOpponent);
      const lo = Math.min(m.scoreSelf, m.scoreOpponent);
      if (hi !== target) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `winner must win exactly ${target} games` });
      }
      if (lo < 0 || lo >= target) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'loser games must be between 0 and target-1' });
      }
      if (requireChars && (!m.charSelf || !m.charOpponent)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'both characters are required' });
      }
    } else {
      if (!(m.scoreSelf === 10 || m.scoreOpponent === 10)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'one side must reach 10 goals' });
      }
      if (m.scoreSelf === 10 && m.scoreOpponent === 10) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'only one side can reach 10 goals' });
      }
    }
  };
}

export const DeclareMatchSchema = z
  .object({ opponentLogin: LoginSchema, ...matchScoreShape })
  .superRefine(makeRefiner(true));

export type DeclareMatchInput = z.infer<typeof DeclareMatchSchema>;

// Confirmation : pas besoin de re-fournir les persos (déjà posés par le déclarant).
export const ConfirmMatchSchema = z
  .object(matchScoreShape)
  .superRefine(makeRefiner(false));

export type ConfirmMatchInput = z.infer<typeof ConfirmMatchSchema>;

export const RejectMatchSchema = z.object({
  contestReason: z.enum(['never_played', 'wrong_score']),
  contestMessage: z.string().min(10).max(500),
});

export type RejectMatchInput = z.infer<typeof RejectMatchSchema>;

export const CreateChallengeSchema = z.object({
  opponentLogin: LoginSchema,
  scheduledAt: z
    .string()
    .datetime({ offset: true })
    .refine((s) => new Date(s).getTime() > Date.now() - 60_000, {
      message: 'scheduledAt must be in the future (or within the last minute)',
    }),
  game: GameSchema.default('babyfoot'),
});

export type CreateChallengeInput = z.infer<typeof CreateChallengeSchema>;

export const RecordResultSchema = z
  .object(matchScoreShape)
  .superRefine(makeRefiner(true));

export type RecordResultInput = z.infer<typeof RecordResultSchema>;

export const CreateTournamentSchema = z
  .object({
    name: z.string().min(2).max(60),
    // Nombre de joueurs : libre à partir de 6 (le bracket gère les byes si ce n'est
    // pas une puissance de 2). Les poules s'activent à partir de 12.
    capacity: z.number().int().min(6).max(64),
    kind: z.enum(['friendly', 'official']).default('friendly'),
    // Format : élimination directe, ou phase de poules (puis bracket des qualifiés).
    format: z.enum(['elimination', 'pools']).default('elimination'),
    // Discipline du tournoi (babyfoot | smash).
    game: GameSchema.default('babyfoot'),
    // Privé = visible et rejoignable uniquement sur invitation (pas d'inscription libre).
    private: z.boolean().default(false),
    // Image de couverture optionnelle (URL). Vide → visuel par défaut généré côté front.
    // Sécurité : `.url()` accepte des schémas dangereux (javascript:, data:, file:…)
    // qui permettent une injection. On restreint donc explicitement à http(s).
    imageUrl: z
      .string()
      .trim()
      .url()
      .max(500)
      .refine((u) => {
        try {
          const p = new URL(u).protocol;
          return p === 'http:' || p === 'https:';
        } catch {
          return false;
        }
      }, "l'URL doit commencer par http:// ou https://")
      .optional(),
  })
  .refine((d) => d.format !== 'pools' || d.capacity >= 12, {
    message: 'les poules nécessitent au moins 12 joueurs',
    path: ['format'],
  });

export type CreateTournamentInput = z.infer<typeof CreateTournamentSchema>;

export const SetTitleSchema = z.object({
  title: z.string().trim().max(40).nullable(),
});

export type SetTitleInput = z.infer<typeof SetTitleSchema>;

export const DeclareOpsSchema = z.object({
  targetLogin: LoginSchema,
});

export type DeclareOpsInput = z.infer<typeof DeclareOpsSchema>;

// Forme du score d'un match de tournoi (range). La règle PAR DISCIPLINE
// (babyfoot 10-x, échecs 1-0, smash set) est validée côté serveur via
// `validateTournamentScore(tournament.game, …)` — cf. packages/shared/games.ts.
export const TournamentRecordSchema = z.object({
  scoreA: MatchScoreSchema,
  scoreB: MatchScoreSchema,
});

export type TournamentRecordInput = z.infer<typeof TournamentRecordSchema>;

export const FeatureRequestSchema = z.object({
  text: z.string().min(10, 'description must be at least 10 characters').max(500),
});

export type FeatureRequestInput = z.infer<typeof FeatureRequestSchema>;

export const BugReportSchema = z.object({
  text: z.string().min(10, 'description must be at least 10 characters').max(500),
});

export type BugReportInput = z.infer<typeof BugReportSchema>;

export const SetBugReportStatusSchema = z.object({
  status: z.enum(['open', 'resolved', 'closed']),
});

export type SetBugReportStatusInput = z.infer<typeof SetBugReportStatusSchema>;

// SUPERADMIN only — 'SUPERADMIN' role cannot be granted via API
export const SetRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

export type SetRoleInput = z.infer<typeof SetRoleSchema>;

export const SetFeatureRequestStatusSchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected']),
});

export type SetFeatureRequestStatusInput = z.infer<typeof SetFeatureRequestStatusSchema>;

// ─── Babyfoot 2v2 ─────────────────────────────────────────────────────────────
// Ces schémas sont EXCLUSIFS au Babyfoot (le jeu est implicitement 'babyfoot').
// Les règles de score sont identiques au 1v1 : un camp doit atteindre 10 buts.

const babyfootScoreRefiner = (
  m: { scoreSelf: number; scoreOpponent: number },
  ctx: z.RefinementCtx,
) => {
  if (!(m.scoreSelf === 10 || m.scoreOpponent === 10)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'one side must reach 10 goals' });
  }
  if (m.scoreSelf === 10 && m.scoreOpponent === 10) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'only one side can reach 10 goals' });
  }
};

export const Declare2v2MatchSchema = z
  .object({
    partnerLogin:   LoginSchema, // coéquipier du déclarant (équipe 1)
    opponentLogin:  LoginSchema, // premier joueur de l'équipe adverse
    opponent2Login: LoginSchema, // coéquipier de l'adversaire (équipe 2)
    scoreSelf:      MatchScoreSchema,
    scoreOpponent:  MatchScoreSchema,
  })
  .superRefine((m, ctx) => {
    const logins = [m.partnerLogin, m.opponentLogin, m.opponent2Login];
    if (new Set(logins).size !== logins.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'all four players must be different' });
    }
    babyfootScoreRefiner(m, ctx);
  });

export type Declare2v2MatchInput = z.infer<typeof Declare2v2MatchSchema>;

export const Confirm2v2MatchSchema = z
  .object({
    scoreSelf:     MatchScoreSchema,
    scoreOpponent: MatchScoreSchema,
  })
  .superRefine(babyfootScoreRefiner);

export type Confirm2v2MatchInput = z.infer<typeof Confirm2v2MatchSchema>;

// Défi 2v2 (Babyfoot) : le challenger nomme les 4 joueurs (lui + son coéquipier
// contre 2 adversaires) et programme un créneau. Seuls les 2 adversaires acceptent.
export const CreateChallenge2v2Schema = z
  .object({
    partnerLogin:         LoginSchema, // coéquipier du challenger
    opponentLogin:        LoginSchema, // premier adversaire
    opponentPartnerLogin: LoginSchema, // coéquipier de l'adversaire
    scheduledAt: z
      .string()
      .datetime({ offset: true })
      .refine((s) => new Date(s).getTime() > Date.now() - 60_000, {
        message: 'scheduledAt must be in the future (or within the last minute)',
      }),
  })
  .superRefine((m, ctx) => {
    const logins = [m.partnerLogin, m.opponentLogin, m.opponentPartnerLogin];
    if (new Set(logins).size !== logins.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'all four players must be different' });
    }
  });

export type CreateChallenge2v2Input = z.infer<typeof CreateChallenge2v2Schema>;

// ─── Smash FFA (Free-For-All, 3+ joueurs) ────────────────────────────────────
// EXCLUSIF au Smash. Le déclarant propose le classement final complet (ordre du
// tableau `ranking` : ranking[0] = 1er … dernier élément = dernier). Les positions
// sont DÉRIVÉES de l'ordre côté serveur (position = index + 1) → unicité et
// contiguïté 1..N garanties par construction. Chaque AUTRE participant confirme
// ensuite UNIQUEMENT sa propre position ; une contestation annule tout le FFA.

export const FFA_MIN_PLAYERS = 3;
// Limite d'un lobby Smash Ultimate.
export const FFA_MAX_PLAYERS = 8;

export const DeclareFfaSchema = z
  .object({
    game: z.literal('smash').default('smash'),
    ranking: z.array(LoginSchema).min(FFA_MIN_PLAYERS).max(FFA_MAX_PLAYERS),
  })
  .superRefine((m, ctx) => {
    if (new Set(m.ranking).size !== m.ranking.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'tous les participants doivent être différents', path: ['ranking'] });
    }
  });

export type DeclareFfaInput = z.infer<typeof DeclareFfaSchema>;

// Confirmation de SA propre place : on renvoie la position attendue pour détecter
// une dérive (si le classement a changé entre l'affichage et le clic → mismatch).
export const ConfirmFfaPositionSchema = z.object({
  position: z.number().int().min(1).max(FFA_MAX_PLAYERS),
});

export type ConfirmFfaPositionInput = z.infer<typeof ConfirmFfaPositionSchema>;

// Contestation : le joueur indique sa position RÉELLE revendiquée → annule le FFA.
export const ContestFfaSchema = z.object({
  claimedPosition: z.number().int().min(1).max(FFA_MAX_PLAYERS),
  message: z.string().trim().max(500).optional(),
});

export type ContestFfaInput = z.infer<typeof ContestFfaSchema>;
