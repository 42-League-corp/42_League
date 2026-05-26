import { z } from 'zod';

export const LoginSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9_-]+$/, 'login must match the 42 intra login format');

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
  capacity: z.union([z.literal(4), z.literal(8)]),
  kind: z.enum(['friendly', 'official']).default('friendly'),
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
