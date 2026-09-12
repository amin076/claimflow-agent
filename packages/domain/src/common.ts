import { z } from 'zod';

export const IdentifierSchema = z.string().trim().min(1).max(160);
export const TimestampSchema = z.iso.datetime();
export const ConfidenceSchema = z.number().min(0).max(1);

export const CaseStatusSchema = z.enum([
  'DRAFT',
  'PROCESSING',
  'NEEDS_INPUT',
  'NEEDS_REVIEW',
  'READY',
  'FAILED',
]);

export type CaseStatus = z.infer<typeof CaseStatusSchema>;
