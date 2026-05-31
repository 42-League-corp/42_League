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

export const DeclareMatchSchema = z
  .object({
    opponentLogin: LoginSchema,
    scoreSelf: MatchScoreSchema,
    scoreOpponent: MatchScoreSchema,
  })
  .refine(
    (m) => m.scoreSelf === 10 || m.scoreOpponent === 10,
    'one side must reach 10 goals',
  )
  .refine(
    (m) => !(m.scoreSelf === 10 && m.scoreOpponent === 10),
    'only one side can reach 10 goals',
  );

export type DeclareMatchInput = z.infer<typeof DeclareMatchSchema>;

export const ConfirmMatchSchema = z
  .object({
    scoreSelf: MatchScoreSchema,
    scoreOpponent: MatchScoreSchema,
  })
  .refine(
    (m) => m.scoreSelf === 10 || m.scoreOpponent === 10,
    'one side must reach 10 goals',
  )
  .refine(
    (m) => !(m.scoreSelf === 10 && m.scoreOpponent === 10),
    'only one side can reach 10 goals',
  );

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
});

export type CreateChallengeInput = z.infer<typeof CreateChallengeSchema>;

export const RecordResultSchema = z
  .object({
    scoreSelf: MatchScoreSchema,
    scoreOpponent: MatchScoreSchema,
  })
  .refine(
    (m) => m.scoreSelf === 10 || m.scoreOpponent === 10,
    'one side must reach 10 goals',
  )
  .refine(
    (m) => !(m.scoreSelf === 10 && m.scoreOpponent === 10),
    'only one side can reach 10 goals',
  );

export type RecordResultInput = z.infer<typeof RecordResultSchema>;

export const CreateTournamentSchema = z.object({
  name: z.string().min(2).max(60),
  // Minimum 8 joueurs (même en amical). Bracket à élimination directe → puissance de 2.
  capacity: z.union([z.literal(8), z.literal(16)]),
  kind: z.enum(['friendly', 'official']).default('friendly'),
  // Privé = visible et rejoignable uniquement sur invitation (pas d'inscription libre).
  private: z.boolean().default(false),
  // Image de couverture optionnelle (URL). Vide → visuel par défaut généré côté front.
  imageUrl: z.string().trim().url().max(500).optional(),
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

// SUPERADMIN only — 'SUPERADMIN' role cannot be granted via API
export const SetRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

export type SetRoleInput = z.infer<typeof SetRoleSchema>;

export const SetFeatureRequestStatusSchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected']),
});

export type SetFeatureRequestStatusInput = z.infer<typeof SetFeatureRequestStatusSchema>;
