import { z } from 'zod';
import { IdentifierSchema } from './common.js';
import { DocumentTypeSchema } from './document.js';
import { ClaimFieldNameSchema, ExtractedValueSchema } from './field.js';

export const CreateCaseInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  reference: z.string().trim().min(1).max(80).optional(),
});

export const AddDocumentInputSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  type: DocumentTypeSchema,
});

export const ReviewCaseInputSchema = z
  .object({
    reviewerId: IdentifierSchema,
    action: z.enum(['ACCEPT', 'CORRECT', 'REJECT', 'ESCALATE', 'REQUEST_INPUT']),
    fieldName: ClaimFieldNameSchema.optional(),
    correctedValue: ExtractedValueSchema.optional(),
    evidence: z
      .object({
        documentId: IdentifierSchema,
        page: z.number().int().positive().max(5),
        excerpt: z.string().trim().min(1).max(1000),
      })
      .optional(),
    reason: z.string().trim().min(1).max(2_000),
  })
  .superRefine((decision, context) => {
    if (['ACCEPT', 'CORRECT', 'REJECT'].includes(decision.action) && !decision.fieldName) {
      context.addIssue({
        code: 'custom',
        path: ['fieldName'],
        message: `${decision.action} requires a field name.`,
      });
    }

    if (decision.action === 'CORRECT' && decision.correctedValue === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['correctedValue'],
        message: 'A correction must include the corrected value.',
      });
    }
  });

export type CreateCaseInput = z.infer<typeof CreateCaseInputSchema>;
export type AddDocumentInput = z.infer<typeof AddDocumentInputSchema>;
export type ReviewCaseInput = z.infer<typeof ReviewCaseInputSchema>;
