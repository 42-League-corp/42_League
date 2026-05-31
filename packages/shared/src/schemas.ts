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

// ─── Multi-jeu (babyfoot | smash) ──────────────────────────────────────────
export const GameSchema = z.enum(['babyfoot', 'smash', 'chess']);
export type Game = z.infer<typeof GameSchema>;
export const SmashBestOfSchema = z.union([z.literal(3), z.literal(5)]);
export const SmashCharSchema = z.string().trim().min(1).max(40);
export const SmashStockSchema = z.number().int().min(1).max(3);

/** Champs communs aux déclarations/confirmations, indépendants du jeu. */
const matchScoreShape = {
  scoreSelf: MatchScoreSchema,
  scoreOpponent: MatchScoreSchema,
  game: GameSchema.default('babyfoot'),
  // Smash uniquement :
  bestOf: SmashBestOfSchema.optional(),
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
    if (m.game === 'smash') {
      if (!m.bestOf) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'bestOf required for smash (3 or 5)' });
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
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'both characters are required for smash' });
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
    imageUrl: z.string().trim().url().max(500).optional(),
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

export const TournamentRecordSchema = z
  .object({
    scoreA: MatchScoreSchema,
    scoreB: MatchScoreSchema,
  })
  .refine((m) => m.scoreA === 10 || m.scoreB === 10, 'one side must reach 10 goals')
  .refine(
    (m) => !(m.scoreA === 10 && m.scoreB === 10),
    'only one side can reach 10 goals',
  );

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
