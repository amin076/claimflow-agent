import { randomUUID } from 'node:crypto';
import {
  ClaimCaseSchema,
  ReviewDecisionSchema,
  type ClaimCase,
  type ReviewCaseInput,
  type ValidationIssue,
} from '@claimflow/domain';
import { ApiError } from '../errors.js';
import { planCase, validateFields } from './validation.js';

const issueKey = (issue: ValidationIssue) =>
  `${issue.type}:${issue.fieldNames.join(',')}:${issue.message}`;
export function applyHumanReview(claim: ClaimCase, input: ReviewCaseInput): ClaimCase {
  if (claim.status === 'PROCESSING')
    throw new ApiError(409, 'CASE_PROCESSING', 'Wait for processing to finish.');
  if (claim.status === 'DRAFT')
    throw new ApiError(409, 'CASE_NOT_PROCESSED', 'Process the documents before reviewing.');
  const timestamp = new Date().toISOString();
  const field = claim.fields.find((candidate) => candidate.name === input.fieldName);
  const fields = structuredClone(claim.fields);
  if (input.action === 'CORRECT') {
    if (input.correctedValue === null || String(input.correctedValue ?? '').trim() === '')
      throw new ApiError(400, 'VALUE_REQUIRED', 'Supply a non-empty correction.');
    if (!field && !input.evidence)
      throw new ApiError(
        400,
        'EVIDENCE_REQUIRED',
        'A missing field needs a source document, page and supporting excerpt.',
      );
    if (input.evidence) {
      const source = claim.documents.find((doc) => doc.id === input.evidence!.documentId);
      if (!source || input.evidence.page > (source.pageCount ?? 1))
        throw new ApiError(400, 'INVALID_EVIDENCE', 'Evidence must refer to a page in this case.');
    }
    const evidence = input.evidence
      ? [{ ...input.evidence, id: `evidence-${randomUUID()}` }]
      : field!.evidence;
    const corrected = {
      ...(field ?? {
        id: `field-${randomUUID()}`,
        name: input.fieldName!,
        confidence: 0,
        uncertaintyReasons: ['Value supplied by a human; confidence is not model-assessed.'],
      }),
      value: input.correctedValue!,
      displayValue: String(input.correctedValue),
      status: 'CORRECTED' as const,
      requiresReview: false,
      evidence,
    };
    if (field) fields[fields.findIndex((candidate) => candidate.id === field.id)] = corrected;
    else fields.push(corrected);
  } else if (input.action === 'ACCEPT' || input.action === 'REJECT') {
    if (!field) throw new ApiError(409, 'FIELD_NOT_FOUND', 'Review an existing field.');
    const target = fields.find((candidate) => candidate.id === field.id)!;
    target.status = input.action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    target.requiresReview = input.action === 'REJECT';
  }
  const decision = ReviewDecisionSchema.parse({
    id: `review-${randomUUID()}`,
    caseId: claim.id,
    reviewerId: input.reviewerId,
    action: input.action,
    ...(input.fieldName ? { fieldName: input.fieldName } : {}),
    ...(field ? { previousValue: field.value } : {}),
    ...(input.correctedValue !== undefined ? { correctedValue: input.correctedValue } : {}),
    reason: input.reason,
    createdAt: timestamp,
  });
  let updated: ClaimCase = {
    ...claim,
    fields,
    updatedAt: timestamp,
    reviews: [...claim.reviews, decision],
  };
  const recalculated = validateFields(updated);
  const keys = new Set(recalculated.map(issueKey));
  updated.issues = [
    ...claim.issues
      .filter((issue) => issue.type === 'INVALID_MODEL_OUTPUT' || !keys.has(issueKey(issue)))
      .map((issue) =>
        issue.type === 'INVALID_MODEL_OUTPUT' || issue.status !== 'OPEN'
          ? issue
          : { ...issue, status: 'RESOLVED' as const, resolvedAt: timestamp },
      ),
    ...recalculated.map(
      (issue) =>
        claim.issues.find((old) => issueKey(old) === issueKey(issue) && old.status === 'OPEN') ??
        issue,
    ),
  ];
  updated.fields = fields.map((candidate) => ({
    ...candidate,
    requiresReview:
      candidate.status === 'PROPOSED' ||
      candidate.status === 'REJECTED' ||
      updated.issues.some(
        (issue) => issue.status === 'OPEN' && issue.fieldNames.includes(candidate.name),
      ),
  }));
  const route =
    input.action === 'REQUEST_INPUT' || input.action === 'ESCALATE' ? input.action : undefined;
  updated = {
    ...updated,
    ...planCase(updated, route),
    auditEvents: [
      ...claim.auditEvents,
      {
        id: `audit-${randomUUID()}`,
        caseId: claim.id,
        timestamp,
        actorType: 'HUMAN',
        actorId: input.reviewerId,
        action: `REVIEW_${input.action}`,
        outcome: 'SUCCESS',
        inputReferences: input.fieldName ? [input.fieldName] : [],
        outputReferences: [decision.id],
        summary:
          `${input.reason} Deterministic rules recomputed; stale issue results replaced.`.slice(
            0,
            2000,
          ),
      },
    ],
  };
  return ClaimCaseSchema.parse(updated);
}
