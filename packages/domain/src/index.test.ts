import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AgentRunSchema,
  ClaimCaseSchema,
  ReviewDecisionSchema,
  SyntheticCaseManifestSchema,
  createDemoCase,
} from './index.js';

describe('ClaimCaseSchema', () => {
  it('creates a complete evidence-linked synthetic case', () => {
    const claim = ClaimCaseSchema.parse(createDemoCase());

    expect(claim.documents).toHaveLength(2);
    expect(claim.fields).toHaveLength(3);
    expect(claim.status).toBe('NEEDS_REVIEW');
    expect(claim.fields.every((field) => field.evidence.length > 0)).toBe(true);
  });

  it('rejects autonomous claim approval states', () => {
    expect(() => ClaimCaseSchema.parse({ ...createDemoCase(), status: 'APPROVED' })).toThrow();
  });

  it('rejects evidence that refers to an unknown document', () => {
    const claim = createDemoCase();
    claim.fields[0]!.evidence[0]!.documentId = 'missing-document';
    expect(() => ClaimCaseSchema.parse(claim)).toThrow(/unknown document/);
  });

  it('rejects nested records belonging to another case', () => {
    const claim = createDemoCase();
    claim.documents[0]!.caseId = 'another-case';
    expect(() => ClaimCaseSchema.parse(claim)).toThrow(/different case/);
  });
});

describe('review and agent invariants', () => {
  it('requires a corrected value for correction decisions', () => {
    expect(() =>
      ReviewDecisionSchema.parse({
        id: 'review-1',
        caseId: 'case-1',
        reviewerId: 'reviewer-1',
        action: 'CORRECT',
        fieldName: 'incident.date',
        reason: 'Confirmed against clearer evidence.',
        createdAt: new Date().toISOString(),
      }),
    ).toThrow(/corrected value/);
  });

  it('requires an error summary when an agent run fails', () => {
    expect(() =>
      AgentRunSchema.parse({
        id: 'run-1',
        caseId: 'case-1',
        agent: 'EXTRACTION',
        status: 'FAILED',
      }),
    ).toThrow(/error summary/);
  });
});

describe('synthetic fixture manifests', () => {
  const fixtures = ['complete-case.json', 'needs-review-case.json', 'needs-input-case.json'];

  it.each(fixtures)('validates %s and confirms it is synthetic', (filename) => {
    const fixtureUrl = new URL(`../../../sample-data/cases/${filename}`, import.meta.url);
    const fixture = SyntheticCaseManifestSchema.parse(
      JSON.parse(readFileSync(fixtureUrl, 'utf8')) as unknown,
    );

    expect(fixture.synthetic).toBe(true);
  });
});
