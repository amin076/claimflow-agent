import { z } from 'zod';
import { IdentifierSchema, TimestampSchema } from './common.js';
import { ClaimFieldNameSchema, ExtractedValueSchema } from './field.js';

export const ReviewDecisionSchema = z
  .object({
    id: IdentifierSchema,
    caseId: IdentifierSchema,
    reviewerId: IdentifierSchema,
    action: z.enum(['ACCEPT', 'CORRECT', 'REJECT', 'ESCALATE', 'REQUEST_INPUT']),
    fieldName: ClaimFieldNameSchema.optional(),
    clarificationResponseId: IdentifierSchema.optional(),
    previousValue: ExtractedValueSchema.optional(),
    correctedValue: ExtractedValueSchema.optional(),
    reason: z.string().trim().min(1).max(2_000),
    createdAt: TimestampSchema,
  })
  .superRefine((decision, context) => {
    if (decision.action === 'CORRECT' && decision.correctedValue === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['correctedValue'],
        message: 'A correction must include the corrected value.',
      });
    }
  });

export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
