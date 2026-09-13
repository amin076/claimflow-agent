import { describe, expect, it } from 'vitest';
import type { ClaimCase } from '@claimflow/domain';
import type { ModelExtraction } from './schema.js';
import { materialize, validateFields } from './validation.js';

const baseClaim = (fields: ClaimCase['fields']): ClaimCase => ({
  id: 'case-conflict-test',
  reference: 'CF-CONFLICT-TEST',
  status: 'NEEDS_REVIEW',
  title: 'Conflict test',
  createdAt: '2026-09-13T00:00:00.000Z',
  updatedAt: '2026-09-13T00:00:00.000Z',
  documents: [],
  fields,
  issues: [],
  agentRuns: [],
  reviews: [],
  auditEvents: [],
});

describe('same-document scalar conflicts', () => {
  it('marks competing incident dates as a contradiction instead of an invalid format', () => {
    const extraction: ModelExtraction = {
      fields: [
        {
          name: 'incident.date',
          value: '2026-09-10 or 2026-09-11',
          confidence: 0.8,
          evidence: [
            { documentId: 'doc-1', page: 1, excerpt: '10 September 2026' },
            { documentId: 'doc-1', page: 4, excerpt: '11 September 2026' },
          ],
          uncertaintyReasons: ['The form and later email disagree about the incident date.'],
        },
      ],
      missingFields: [],
      quality: { usable: true, notes: [] },
    };

    const fields = materialize(extraction);
    expect(fields[0]!.uncertaintyReasons).toContain(
      'Conflicting source values: 2026-09-10 / 2026-09-11',
    );

    const issues = validateFields(baseClaim(fields), new Date('2026-09-13T00:00:00.000Z'));
    expect(
      issues.some(
        (issue) => issue.type === 'CONTRADICTION' && issue.fieldNames.includes('incident.date'),
      ),
    ).toBe(true);
    expect(
      issues.some(
        (issue) => issue.type === 'INVALID_FORMAT' && issue.fieldNames.includes('incident.date'),
      ),
    ).toBe(false);
  });

  it('marks competing damage amounts as a contradiction and requires canonical correction', () => {
    const extraction: ModelExtraction = {
      fields: [
        {
          name: 'damage.estimatedAmount',
          value: 'AUD 4,860.00 (verbal) or AUD 4,142.00 (written)',
          confidence: 0.9,
          evidence: [
            { documentId: 'doc-1', page: 1, excerpt: 'Initial estimated amount AUD 4,860.00' },
            { documentId: 'doc-1', page: 3, excerpt: 'Total estimate 4,142.00' },
          ],
          uncertaintyReasons: ['The verbal and written estimates differ.'],
        },
      ],
      missingFields: [],
      quality: { usable: true, notes: [] },
    };

    const fields = materialize(extraction);
    expect(fields[0]!.uncertaintyReasons).toContain('Conflicting source values: 4860.00 / 4142.00');

    const issues = validateFields(baseClaim(fields));
    expect(
      issues.some(
        (issue) =>
          issue.type === 'CONTRADICTION' && issue.fieldNames.includes('damage.estimatedAmount'),
      ),
    ).toBe(true);
    expect(
      issues.some(
        (issue) =>
          issue.type === 'INVALID_FORMAT' && issue.fieldNames.includes('damage.estimatedAmount'),
      ),
    ).toBe(false);
  });

  it('validates the canonical value after a human correction resolves the conflict', () => {
    const extraction: ModelExtraction = {
      fields: [
        {
          name: 'incident.date',
          value: '2026-09-10 or 2026-09-11',
          confidence: 0.8,
          evidence: [
            { documentId: 'doc-1', page: 1, excerpt: '10 September 2026' },
            { documentId: 'doc-1', page: 4, excerpt: '11 September 2026' },
          ],
          uncertaintyReasons: ['Conflicting source values: 2026-09-10 / 2026-09-11'],
        },
      ],
      missingFields: [],
      quality: { usable: true, notes: [] },
    };

    const [field] = materialize(extraction);
    const corrected = {
      ...field!,
      value: '2026-09-10',
      displayValue: '2026-09-10',
      status: 'CORRECTED' as const,
      requiresReview: false,
    };
    const issues = validateFields(baseClaim([corrected]), new Date('2026-09-13T00:00:00.000Z'));

    expect(
      issues.some(
        (issue) =>
          issue.fieldNames.includes('incident.date') &&
          (issue.type === 'CONTRADICTION' || issue.type === 'INVALID_FORMAT'),
      ),
    ).toBe(false);
  });
});
