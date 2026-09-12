import { z } from 'zod';
import { ConfidenceSchema, IdentifierSchema, TimestampSchema } from './common.js';

export const DocumentTypeSchema = z.enum([
  'EMAIL',
  'CLAIM_FORM',
  'DAMAGE_PHOTO',
  'INVOICE',
  'REPORT',
  'OTHER',
]);

export const QualityIssueCodeSchema = z.enum([
  'BLUR',
  'CROPPED',
  'LOW_CONTRAST',
  'ROTATED',
  'GLARE',
  'HANDWRITING',
  'UNREADABLE_REGION',
]);

export const DocumentQualitySchema = z.object({
  score: ConfidenceSchema,
  usable: z.boolean(),
  issues: z.array(QualityIssueCodeSchema),
  notes: z.array(z.string().trim().min(1)).default([]),
});

export const SourceDocumentSchema = z.object({
  id: IdentifierSchema,
  caseId: IdentifierSchema,
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  type: DocumentTypeSchema,
  storageUri: z.string().trim().min(1),
  pageCount: z.number().int().positive().optional(),
  uploadedAt: TimestampSchema,
  quality: DocumentQualitySchema,
});

export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type DocumentQuality = z.infer<typeof DocumentQualitySchema>;
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;
