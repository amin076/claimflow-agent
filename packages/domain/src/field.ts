import { z } from 'zod';
import { ConfidenceSchema, IdentifierSchema } from './common.js';
import { EvidenceReferenceSchema } from './evidence.js';

export const ClaimFieldNameSchema = z.enum([
  'claimant.fullName',
  'claimant.email',
  'claimant.phone',
  'incident.date',
  'incident.address',
  'incident.description',
  'vehicle.registration',
  'vehicle.make',
  'vehicle.model',
  'damage.description',
  'damage.estimatedAmount',
]);

export const ExtractedValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const ExtractedFieldStatusSchema = z.enum(['PROPOSED', 'ACCEPTED', 'CORRECTED', 'REJECTED']);

export const ExtractedFieldSchema = z.object({
  id: IdentifierSchema,
  name: ClaimFieldNameSchema,
  value: ExtractedValueSchema,
  displayValue: z.string().trim().min(1),
  confidence: ConfidenceSchema,
  status: ExtractedFieldStatusSchema,
  evidence: z.array(EvidenceReferenceSchema).min(1),
  uncertaintyReasons: z.array(z.string().trim().min(1)).default([]),
  requiresReview: z.boolean(),
});

export type ClaimFieldName = z.infer<typeof ClaimFieldNameSchema>;
export type ExtractedFieldStatus = z.infer<typeof ExtractedFieldStatusSchema>;
export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;
