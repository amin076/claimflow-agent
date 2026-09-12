import { z } from 'zod';
import { IdentifierSchema, TimestampSchema } from './common.js';

export const AgentNameSchema = z.enum([
  'INTAKE',
  'QUALITY',
  'EXTRACTION',
  'VALIDATION',
  'CASE_PLANNER',
  'REVIEW_ROUTER',
]);

export const AgentRunSchema = z
  .object({
    id: IdentifierSchema,
    caseId: IdentifierSchema,
    agent: AgentNameSchema,
    status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED']),
    startedAt: TimestampSchema.optional(),
    completedAt: TimestampSchema.optional(),
    model: z.string().trim().min(1).optional(),
    inputReferences: z.array(IdentifierSchema).default([]),
    outputReferences: z.array(IdentifierSchema).default([]),
    errorSummary: z.string().trim().min(1).max(2_000).optional(),
  })
  .superRefine((run, context) => {
    if (run.status === 'FAILED' && !run.errorSummary) {
      context.addIssue({
        code: 'custom',
        path: ['errorSummary'],
        message: 'A failed agent run must include an error summary.',
      });
    }
  });

export type AgentName = z.infer<typeof AgentNameSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
