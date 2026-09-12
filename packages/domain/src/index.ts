import { z } from 'zod';

export const CaseStatusSchema = z.enum(['DRAFT', 'PROCESSING', 'NEEDS_REVIEW', 'READY', 'FAILED']);

export const ClaimCaseSchema = z.object({
  id: z.string().min(1),
  reference: z.string().min(1),
  status: CaseStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type CaseStatus = z.infer<typeof CaseStatusSchema>;
export type ClaimCase = z.infer<typeof ClaimCaseSchema>;

export const createDemoCase = (): ClaimCase => {
  const now = new Date().toISOString();
  return ClaimCaseSchema.parse({
    id: 'demo-claim-001',
    reference: 'CF-2026-001',
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
  });
};
