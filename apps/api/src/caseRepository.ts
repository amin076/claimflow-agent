import { applyHumanReview } from './extraction/review.js';
import { ApiError } from './errors.js';
import { randomUUID } from 'node:crypto';
import {
  ClaimCaseSchema,
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

  update(id: string, change: (claim: ClaimCase) => ClaimCase): ClaimCase | undefined {
    const current = this.#cases.get(id);
    if (!current) return undefined;
    const next = cloneCase(change(cloneCase(current)));
    if (next.id !== id) throw new Error('Case identity cannot change');
    this.#cases.set(id, next);
    return cloneCase(next);
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
    replaceId?: string,
  ): ClaimCase | undefined {
    const claim = this.#cases.get(caseId);
    if (!claim) return undefined;

    if (claim.status === 'PROCESSING' || (claim.status !== 'DRAFT' && !replaceId))
      throw new ApiError(409, 'CASE_NOT_DRAFT', 'Create a draft or explicitly replace a source.');
    const replaced = replaceId ? claim.documents.find((doc) => doc.id === replaceId) : undefined;
    if (replaceId && (!replaced || !stored))
      throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Choose a current source to replace.');
    if (!replaceId && claim.documents.length >= 3)
      throw new ApiError(409, 'DOCUMENT_LIMIT', 'Use at most three source documents.');
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
      status: 'DRAFT',
      ...(replaceId
        ? {
            fields: [],
            issues: [],
            summary: 'Source changed. Previous derived fields and validation are invalidated.',
            suggestedNextAction: 'Run processing explicitly for the new source set.',
            supersededDocuments: [...(claim.supersededDocuments ?? []), replaced!],
          }
        : {}),
      documents: [...claim.documents.filter((doc) => doc.id !== replaceId), document],
      auditEvents: [
        ...claim.auditEvents,
        {
          id: `audit-${randomUUID()}`,
          caseId,
          timestamp,
          actorType: 'HUMAN',
          actorId: 'local-user',
          action: replaceId ? 'DOCUMENT_REPLACED_OUTPUT_INVALIDATED' : 'DOCUMENT_ADDED',
          outcome: 'SUCCESS',
          inputReferences: replaced ? [replaced.id] : [],
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
    return this.update(caseId, (claim) => applyHumanReview(claim, input));
  }
}
