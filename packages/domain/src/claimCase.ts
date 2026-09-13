import { z } from 'zod';
import { ClarificationRequestSchema } from './clarification.js';
import { AgentRunSchema } from './agent.js';
import { AuditEventSchema } from './audit.js';
import { CaseStatusSchema, IdentifierSchema, TimestampSchema } from './common.js';
import { SourceDocumentSchema } from './document.js';
import { ExtractedFieldSchema } from './field.js';
import { ValidationIssueSchema } from './issue.js';
import { ReviewDecisionSchema } from './review.js';

export const ClaimCaseSchema = z
  .object({
    id: IdentifierSchema,
    reference: z.string().trim().min(1).max(80),
    status: CaseStatusSchema,
    title: z.string().trim().min(1).max(200),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    processingId: IdentifierSchema.optional(),
    processingStartedAt: TimestampSchema.optional(),
    summary: z.string().max(2000).optional(),
    suggestedNextAction: z.string().max(1000).optional(),
    documents: z.array(SourceDocumentSchema),
    supersededDocuments: z.array(SourceDocumentSchema).optional(),
    fields: z.array(ExtractedFieldSchema),
    issues: z.array(ValidationIssueSchema),
    agentRuns: z.array(AgentRunSchema),
    reviews: z.array(ReviewDecisionSchema),
    auditEvents: z.array(AuditEventSchema),
    clarifications: z.array(ClarificationRequestSchema).max(10).optional(),
  })
  .superRefine((claim, context) => {
    const records = [
      ...claim.documents,
      ...(claim.supersededDocuments ?? []),
      ...claim.issues,
      ...claim.agentRuns,
      ...claim.reviews,
      ...claim.auditEvents,
      ...(claim.clarifications ?? []),
    ];

    for (const record of records) {
      if (record.caseId !== claim.id) {
        context.addIssue({
          code: 'custom',
          path: ['id'],
          message: `Record ${record.id} belongs to a different case.`,
        });
      }
    }

    for (const request of claim.clarifications ?? []) {
      if (
        request.response &&
        (request.response.caseId !== claim.id ||
          request.response.clarificationId !== request.id ||
          request.response.externalConversationId !== request.externalConversationId)
      ) {
        context.addIssue({ code: 'custom', message: 'Clarification response identity mismatch.' });
      }
    }
    const responseIds = new Set(
      (claim.clarifications ?? []).flatMap((request) =>
        request.response ? [request.response.id] : [],
      ),
    );
    for (const field of claim.fields)
      for (const evidence of field.evidence) {
        if (evidence.clarificationResponseId && !responseIds.has(evidence.clarificationResponseId))
          context.addIssue({ code: 'custom', message: 'Unknown clarification evidence.' });
      }
    const documentIds = new Set(claim.documents.map((document) => document.id));
    for (const [fieldIndex, field] of claim.fields.entries()) {
      for (const [evidenceIndex, evidence] of field.evidence.entries()) {
        if (evidence.documentId && !documentIds.has(evidence.documentId)) {
          context.addIssue({
            code: 'custom',
            path: ['fields', fieldIndex, 'evidence', evidenceIndex, 'documentId'],
            message: `Evidence references unknown document ${evidence.documentId}.`,
          });
        }
      }
    }
  });

export type ClaimCase = z.infer<typeof ClaimCaseSchema>;
