import { z } from 'zod';
import { CaseStatusSchema, IdentifierSchema } from './common.js';
import { DocumentTypeSchema } from './document.js';
import { ValidationIssueTypeSchema } from './issue.js';

export const SyntheticCaseManifestSchema = z.object({
  fixtureVersion: z.literal(1),
  caseId: IdentifierSchema,
  description: z.string().trim().min(1),
  expectedStatus: CaseStatusSchema,
  expectedDocumentTypes: z.array(DocumentTypeSchema).min(1),
  expectedIssues: z.array(ValidationIssueTypeSchema),
  synthetic: z.literal(true),
});

export type SyntheticCaseManifest = z.infer<typeof SyntheticCaseManifestSchema>;
