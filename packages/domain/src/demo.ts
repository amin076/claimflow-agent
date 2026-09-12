import type { ClaimCase } from './claimCase.js';
import { ClaimCaseSchema } from './claimCase.js';

export const createDemoCase = (): ClaimCase => {
  const timestamp = new Date().toISOString();

  return ClaimCaseSchema.parse({
    id: 'demo-claim-001',
    reference: 'CF-2026-001',
    title: 'Synthetic water-damage claim',
    status: 'NEEDS_REVIEW',
    createdAt: timestamp,
    updatedAt: timestamp,
    documents: [
      {
        id: 'doc-intake-email',
        caseId: 'demo-claim-001',
        filename: 'intake-email.txt',
        mimeType: 'text/plain',
        type: 'EMAIL',
        storageUri: 'local://sample-data/intake-email.txt',
        uploadedAt: timestamp,
        quality: { score: 1, usable: true, issues: [], notes: [] },
      },
      {
        id: 'doc-claim-form',
        caseId: 'demo-claim-001',
        filename: 'claim-form-photo.jpg',
        mimeType: 'image/jpeg',
        type: 'CLAIM_FORM',
        storageUri: 'local://sample-data/claim-form-photo.jpg',
        uploadedAt: timestamp,
        quality: {
          score: 0.58,
          usable: true,
          issues: ['BLUR', 'HANDWRITING'],
          notes: ['Incident-date handwriting is ambiguous.'],
        },
      },
    ],
    fields: [
      {
        id: 'field-claimant-name',
        name: 'claimant.fullName',
        value: 'Jordan Lee',
        displayValue: 'Jordan Lee',
        confidence: 0.98,
        status: 'PROPOSED',
        evidence: [
          {
            id: 'evidence-claimant-name',
            documentId: 'doc-intake-email',
            excerpt: 'From: Jordan Lee',
          },
        ],
        uncertaintyReasons: [],
        requiresReview: false,
      },
      {
        id: 'field-incident-date',
        name: 'incident.date',
        value: '2026-09-08',
        displayValue: '8 September 2026',
        confidence: 0.62,
        status: 'PROPOSED',
        evidence: [
          {
            id: 'evidence-incident-date',
            documentId: 'doc-claim-form',
            page: 1,
            excerpt: '08/09/26',
          },
        ],
        uncertaintyReasons: ['Blurred handwriting could be read as 06/09/26.'],
        requiresReview: true,
      },
      {
        id: 'field-damage-description',
        name: 'damage.description',
        value: 'Water staining and ceiling damage in the living room',
        displayValue: 'Water staining and ceiling damage in the living room',
        confidence: 0.91,
        status: 'PROPOSED',
        evidence: [
          {
            id: 'evidence-damage-description',
            documentId: 'doc-intake-email',
            excerpt: 'Water staining has spread across the living-room ceiling.',
          },
        ],
        uncertaintyReasons: [],
        requiresReview: false,
      },
    ],
    issues: [
      {
        id: 'issue-low-confidence-date',
        caseId: 'demo-claim-001',
        type: 'LOW_CONFIDENCE',
        severity: 'WARNING',
        status: 'OPEN',
        message: 'Incident date requires review because the handwriting is ambiguous.',
        fieldNames: ['incident.date'],
        documentIds: ['doc-claim-form'],
        createdAt: timestamp,
      },
      {
        id: 'issue-missing-address',
        caseId: 'demo-claim-001',
        type: 'MISSING_REQUIRED_FIELD',
        severity: 'BLOCKING',
        status: 'OPEN',
        message: 'Incident address is missing from the supplied documents.',
        fieldNames: ['incident.address'],
        documentIds: [],
        createdAt: timestamp,
      },
    ],
    agentRuns: [],
    reviews: [],
    auditEvents: [
      {
        id: 'audit-case-created',
        caseId: 'demo-claim-001',
        timestamp,
        actorType: 'SYSTEM',
        actorId: 'claimflow-api',
        action: 'CASE_CREATED',
        outcome: 'SUCCESS',
        inputReferences: [],
        outputReferences: ['demo-claim-001'],
        summary: 'Created a synthetic demonstration case.',
      },
    ],
  });
};
