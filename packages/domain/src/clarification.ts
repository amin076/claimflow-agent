import { z } from 'zod';
import { IdentifierSchema, TimestampSchema } from './common.js';
import { ClaimFieldNameSchema } from './field.js';

export const ClarificationResponseSchema = z.object({
  id: IdentifierSchema,
  caseId: IdentifierSchema,
  clarificationId: IdentifierSchema,
  channel: z.enum(['VOICE', 'EMAIL', 'SMS']),
  receivedAt: TimestampSchema,
  externalConversationId: IdentifierSchema,
  transcript: z
    .array(z.object({ role: z.enum(['agent', 'user']), message: z.string().max(4000) }))
    .max(100),
  transcriptTruncated: z.boolean(),
  verification: z.literal('ELEVENLABS_HMAC'),
});
export const ClarificationRequestSchema = z.object({
  id: IdentifierSchema,
  caseId: IdentifierSchema,
  fieldName: ClaimFieldNameSchema,
  issueIds: z.array(IdentifierSchema).min(1),
  sourceDocumentIds: z.array(IdentifierSchema),
  channel: z.enum(['VOICE', 'EMAIL', 'SMS']),
  status: z.enum(['DRAFT', 'APPROVED', 'CALLING', 'COMPLETED', 'FAILED', 'CANCELLED', 'RESOLVED']),
  question: z.string().trim().min(1).max(2000),
  drafting: z
    .object({
      source: z.enum(['GEMINI', 'TEMPLATE']),
      durationMs: z.number().int().nonnegative(),
      failureClass: z
        .enum([
          'TIMEOUT',
          'ACCESS_DENIED',
          'RATE_LIMIT',
          'PROVIDER_ERROR',
          'INCOMPLETE_OUTPUT',
          'INVALID_TEXT',
          'CANDIDATES_CHANGED',
        ])
        .optional(),
      finishReason: z
        .enum([
          'STOP',
          'MAX_TOKENS',
          'SAFETY',
          'RECITATION',
          'BLOCKLIST',
          'PROHIBITED_CONTENT',
          'OTHER',
          'UNKNOWN',
        ])
        .optional(),
    })
    .optional(),
  candidateValues: z.array(z.string().max(2000)).max(20),
  context: z.string().max(2000),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  approvedBy: IdentifierSchema.optional(),
  approvedAt: TimestampSchema.optional(),
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  externalConversationId: IdentifierSchema.optional(),
  externalCallId: IdentifierSchema.optional(),
  errorSummary: z.string().max(200).optional(),
  resolvedByReviewId: IdentifierSchema.optional(),
  response: ClarificationResponseSchema.optional(),
});
export const CreateClarificationInputSchema = z.object({
  issueId: IdentifierSchema,
  fieldName: ClaimFieldNameSchema,
});
export const ApproveClarificationInputSchema = z.object({
  question: z.string().trim().min(1).max(2000),
});
export type ClarificationRequest = z.infer<typeof ClarificationRequestSchema>;
export type ClarificationResponse = z.infer<typeof ClarificationResponseSchema>;
