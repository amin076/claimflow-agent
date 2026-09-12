import { z } from 'zod';
import { IdentifierSchema, TimestampSchema } from './common.js';
import { ClaimFieldNameSchema } from './field.js';

export const ValidationIssueTypeSchema = z.enum([
  'MISSING_REQUIRED_FIELD',
  'LOW_CONFIDENCE',
  'CONTRADICTION',
  'INVALID_FORMAT',
  'DOCUMENT_QUALITY',
  'INVALID_MODEL_OUTPUT',
  'BUSINESS_RULE',
]);

export const ValidationIssueSchema = z.object({
  id: IdentifierSchema,
  caseId: IdentifierSchema,
  type: ValidationIssueTypeSchema,
  severity: z.enum(['INFO', 'WARNING', 'BLOCKING']),
  status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']),
  message: z.string().trim().min(1).max(2_000),
  fieldNames: z.array(ClaimFieldNameSchema).default([]),
  documentIds: z.array(IdentifierSchema).default([]),
  createdAt: TimestampSchema,
  resolvedAt: TimestampSchema.optional(),
});

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
