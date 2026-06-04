import { z } from 'zod';

// ── Individual problem schema ──────────────────────────────────────────────

export const ProblemSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  conceptId: z.string().optional(),
  hints: z.array(z.string()).optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;

// ── Discriminated payload union ─────────────────────────────────────────────
// Covers all 3 shapes the backend emits (matched to PracticePayload in
// backend/app/domain/artifact.py: ProblemsPayload, SummaryPayload, placeholder).

export const ProblemsPayloadSchema = z.object({
  kind: z.literal('problems'),
  problems: z.array(ProblemSchema),
});
export type ProblemsPayload = z.infer<typeof ProblemsPayloadSchema>;

export const SummaryPayloadSchema = z.object({
  kind: z.literal('summary'),
  content: z.string(),
  title: z.string().optional(),
});
export type SummaryPayload = z.infer<typeof SummaryPayloadSchema>;

export const PlaceholderPayloadSchema = z.object({
  kind: z.literal('placeholder'),
});
export type PlaceholderPayload = z.infer<typeof PlaceholderPayloadSchema>;

export const ArtifactPayloadSchema = z.discriminatedUnion('kind', [
  ProblemsPayloadSchema,
  SummaryPayloadSchema,
  PlaceholderPayloadSchema,
]);
export type ArtifactPayload = z.infer<typeof ArtifactPayloadSchema>;

/** Safely parses an unknown payload value; returns null if it doesn't match any arm. */
export function parseArtifactPayload(raw: unknown): ArtifactPayload | null {
  const result = ArtifactPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}
