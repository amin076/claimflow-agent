import { z } from 'zod';
import { IdentifierSchema, TimestampSchema } from './common.js';

export const AuditEventSchema = z.object({
  id: IdentifierSchema,
  caseId: IdentifierSchema,
  timestamp: TimestampSchema,
  actorType: z.enum(['HUMAN', 'AGENT', 'RULE', 'SYSTEM']),
  actorId: IdentifierSchema,
  action: z.string().trim().min(1).max(160),
  outcome: z.enum(['SUCCESS', 'FAILURE']),
  inputReferences: z.array(IdentifierSchema).default([]),
  outputReferences: z.array(IdentifierSchema).default([]),
  summary: z.string().trim().min(1).max(2_000),
  errorSummary: z.string().trim().min(1).max(2_000).optional(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
