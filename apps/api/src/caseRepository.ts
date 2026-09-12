import { ApiError } from './errors.js';
import { randomUUID } from 'node:crypto';
import {
  ClaimCaseSchema,
  ReviewDecisionSchema,
  SourceDocumentSchema,
  type AddDocumentInput,
  type ClaimCase,
  type CreateCaseInput,
  type ReviewCaseInput,
  type SourceDocument,
  createDemoCase,
} from '@claimflow/domain';

const cloneCase = (claim: ClaimCase): ClaimCase => ClaimCaseSchema.parse(structuredClone(claim));

export class InMemoryCaseRepository {
  readonly #cases = new Map<string, ClaimCase>();

  constructor(initial: ClaimCase[] = [createDemoCase()]) {
    for (const claim of initial) this.#cases.set(claim.id, cloneCase(claim));
  }

  list(): ClaimCase[] {
    return [...this.#cases.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(cloneCase);
  }

  get(id: string): ClaimCase | undefined {
    const claim = this.#cases.get(id);
    return claim ? cloneCase(claim) : undefined;
  }

  create(input: CreateCaseInput): ClaimCase {
    const timestamp = new Date().toISOString();
    const id = `case-${randomUUID()}`;
    const reference = input.reference ?? `CF-${new Date().getUTCFullYear()}-${randomUUID()}`;
    const claim = ClaimCaseSchema.parse({
      id,
      reference,
      title: input.title,
      status: 'DRAFT',
      createdAt: timestamp,
      updatedAt: timestamp,
      documents: [],
      fields: [],
      issues: [],
      agentRuns: [],
      reviews: [],
      auditEvents: [
        {
          id: `audit-${randomUUID()}`,
          caseId: id,
          timestamp,
          actorType: 'SYSTEM',
          actorId: 'claimflow-api',
          action: 'CASE_CREATED',
          outcome: 'SUCCESS',
          inputReferences: [],
          outputReferences: [id],
          summary: 'Created a synthetic case.',
        },
      ],
    });

    this.#cases.set(id, claim);
    return cloneCase(claim);
  }

  addDocument(
    caseId: string,
    input: AddDocumentInput,
    stored?: SourceDocument,
  ): ClaimCase | undefined {
    const claim = this.#cases.get(caseId);
    if (!claim) return undefined;

    if (claim.status !== 'DRAFT')
      throw new ApiError(409, 'CASE_NOT_DRAFT', 'Create a draft case for a new upload.');
    const timestamp = new Date().toISOString();
    const document =
      stored ??
      SourceDocumentSchema.parse({
        id: `doc-${randomUUID()}`,
        caseId,
        filename: input.filename,
        mimeType: input.mimeType,
        type: input.type,
        storageUri: `local://uploads/${caseId}/${input.filename}`,
        uploadedAt: timestamp,
        quality: { score: 1, usable: true, issues: [], notes: [] },
      });

    const updated = ClaimCaseSchema.parse({
      ...claim,
      updatedAt: timestamp,
      documents: [...claim.documents, document],
      auditEvents: [
        ...claim.auditEvents,
        {
          id: `audit-${randomUUID()}`,
          caseId,
          timestamp,
          actorType: 'HUMAN',
          actorId: 'local-user',
          action: 'DOCUMENT_ADDED',
          outcome: 'SUCCESS',
          inputReferences: [],
          outputReferences: [document.id],
          summary: `Added synthetic document ${document.filename}.`,
        },
      ],
    });

    this.#cases.set(caseId, updated);
    return cloneCase(updated);
  }

  process(caseId: string): ClaimCase | 'NO_DOCUMENTS' | undefined {
    const claim = this.#cases.get(caseId);
    if (!claim) return undefined;
    const document = claim.documents[0];
    if (!document) return 'NO_DOCUMENTS';

    const timestamp = new Date().toISOString();
    const extractionRunId = `run-${randomUUID()}`;
    const validationRunId = `run-${randomUUID()}`;
    const fields = [
      {
        id: `field-${randomUUID()}`,
        name: 'claimant.fullName',
        value: 'Jordan Lee',
        displayValue: 'Jordan Lee',
        confidence: 0.98,
        status: 'PROPOSED',
        evidence: [
          {
            id: `evidence-${randomUUID()}`,
            documentId: document.id,
            excerpt: 'From: Jordan Lee',
          },
        ],
        uncertaintyReasons: [],
        requiresReview: false,
      },
      {
        id: `field-${randomUUID()}`,
        name: 'incident.date',
        value: '2026-09-08',
        displayValue: '8 September 2026',
        confidence: 0.62,
        status: 'PROPOSED',
        evidence: [
          {
            id: `evidence-${randomUUID()}`,
            documentId: document.id,
            page: 1,
            excerpt: '08/09/26',
          },
        ],
        uncertaintyReasons: ['Synthetic handwriting is intentionally ambiguous.'],
        requiresReview: true,
      },
      {
        id: `field-${randomUUID()}`,
        name: 'damage.description',
        value: 'Water staining and ceiling damage in the living room',
        displayValue: 'Water staining and ceiling damage in the living room',
        confidence: 0.91,
        status: 'PROPOSED',
        evidence: [
          {
            id: `evidence-${randomUUID()}`,
            documentId: document.id,
            excerpt: 'Water staining has spread across the living-room ceiling.',
          },
        ],
        uncertaintyReasons: [],
        requiresReview: false,
      },
    ];

    const updated = ClaimCaseSchema.parse({
      ...claim,
      status: 'NEEDS_REVIEW',
      updatedAt: timestamp,
      fields,
      issues: [
        {
          id: `issue-${randomUUID()}`,
          caseId,
          type: 'LOW_CONFIDENCE',
          severity: 'WARNING',
          status: 'OPEN',
          message: 'Incident date requires human review.',
          fieldNames: ['incident.date'],
          documentIds: [document.id],
          createdAt: timestamp,
        },
        {
          id: `issue-${randomUUID()}`,
          caseId,
          type: 'MISSING_REQUIRED_FIELD',
          severity: 'BLOCKING',
          status: 'OPEN',
          message: 'Incident address is missing from the supplied document.',
          fieldNames: ['incident.address'],
          documentIds: [document.id],
          createdAt: timestamp,
        },
      ],
      agentRuns: [
        ...claim.agentRuns,
        {
          id: extractionRunId,
          caseId,
          agent: 'EXTRACTION',
          status: 'SUCCEEDED',
          startedAt: timestamp,
          completedAt: timestamp,
          model: 'deterministic-local-mock',
          inputReferences: [document.id],
          outputReferences: fields.map((field) => field.id),
        },
        {
          id: validationRunId,
          caseId,
          agent: 'VALIDATION',
          status: 'SUCCEEDED',
          startedAt: timestamp,
          completedAt: timestamp,
          inputReferences: fields.map((field) => field.id),
          outputReferences: [],
        },
      ],
      auditEvents: [
        ...claim.auditEvents,
        {
          id: `audit-${randomUUID()}`,
          caseId,
          timestamp,
          actorType: 'AGENT',
          actorId: 'deterministic-local-mock',
          action: 'CASE_PROCESSED',
          outcome: 'SUCCESS',
          inputReferences: [document.id],
          outputReferences: [extractionRunId, validationRunId],
          summary: 'Completed deterministic local extraction and validation.',
        },
      ],
    });

    this.#cases.set(caseId, updated);
    return cloneCase(updated);
  }

  review(caseId: string, input: ReviewCaseInput): ClaimCase | undefined {
    const claim = this.#cases.get(caseId);
    if (!claim) return undefined;

    const timestamp = new Date().toISOString();
    const field = input.fieldName
      ? claim.fields.find((candidate) => candidate.name === input.fieldName)
      : undefined;
    const decision = ReviewDecisionSchema.parse({
      id: `review-${randomUUID()}`,
      caseId,
      reviewerId: input.reviewerId,
      action: input.action,
      ...(input.fieldName ? { fieldName: input.fieldName } : {}),
      ...(field ? { previousValue: field.value } : {}),
      ...(input.correctedValue !== undefined ? { correctedValue: input.correctedValue } : {}),
      reason: input.reason,
      createdAt: timestamp,
    });

    const fields = claim.fields.map((candidate) => {
      if (!input.fieldName || candidate.name !== input.fieldName) return candidate;
      if (input.action === 'ACCEPT') {
        return { ...candidate, status: 'ACCEPTED' as const, requiresReview: false };
      }
      if (input.action === 'CORRECT') {
        return {
          ...candidate,
          value: input.correctedValue ?? null,
          displayValue: String(input.correctedValue ?? '') || 'Not provided',
          status: 'CORRECTED' as const,
          requiresReview: false,
        };
      }
      if (input.action === 'REJECT') {
        return { ...candidate, status: 'REJECTED' as const, requiresReview: false };
      }
      return candidate;
    });
    const issues = claim.issues.map((issue) =>
      input.fieldName &&
      issue.fieldNames.includes(input.fieldName) &&
      ['ACCEPT', 'CORRECT', 'REJECT'].includes(input.action)
        ? { ...issue, status: 'RESOLVED' as const, resolvedAt: timestamp }
        : issue,
    );
    const openIssues = issues.filter((issue) => issue.status === 'OPEN');
    const status =
      input.action === 'REQUEST_INPUT'
        ? 'NEEDS_INPUT'
        : input.action === 'ESCALATE' || openIssues.length > 0
          ? 'NEEDS_REVIEW'
          : 'READY';

    const updated = ClaimCaseSchema.parse({
      ...claim,
      status,
      updatedAt: timestamp,
      fields,
      issues,
      reviews: [...claim.reviews, decision],
      auditEvents: [
        ...claim.auditEvents,
        {
          id: `audit-${randomUUID()}`,
          caseId,
          timestamp,
          actorType: 'HUMAN',
          actorId: input.reviewerId,
          action: `REVIEW_${input.action}`,
          outcome: 'SUCCESS',
          inputReferences: input.fieldName ? [input.fieldName] : [],
          outputReferences: [decision.id],
          summary: input.reason,
        },
      ],
    });

    this.#cases.set(caseId, updated);
    return cloneCase(updated);
  }
}
