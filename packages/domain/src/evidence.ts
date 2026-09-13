import { z } from 'zod';
import { IdentifierSchema } from './common.js';

export const NormalizedRegionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
});

export const EvidenceReferenceSchema = z
  .object({
    id: IdentifierSchema,
    documentId: IdentifierSchema.optional(),
    clarificationResponseId: IdentifierSchema.optional(),
    page: z.number().int().positive().optional(),
    excerpt: z.string().trim().min(1).max(2_000).optional(),
    region: NormalizedRegionSchema.optional(),
  })
  .refine(
    (value) => Boolean(value.documentId) !== Boolean(value.clarificationResponseId),
    'Evidence must reference exactly one document or clarification response.',
  );

export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;
