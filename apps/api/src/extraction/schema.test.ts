import { describe, expect, it } from 'vitest';
import {
  ModelExtractionSchema,
  ModelOutputValidationError,
  parseExtraction,
  responseJsonSchema,
} from './schema.js';

describe('Vertex response JSON schema', () => {
  it('uses a deliberately minimal shape-only generation schema', () => {
    expect(responseJsonSchema).toEqual({
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' },
              confidence: { type: 'number' },
              evidence: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    documentId: { type: 'string' },
                    page: { type: 'integer' },
                    excerpt: { type: 'string' },
                  },
                  required: ['documentId', 'page', 'excerpt'],
                },
              },
              uncertaintyReasons: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['name', 'value', 'confidence', 'evidence', 'uncertaintyReasons'],
          },
        },
        missingFields: {
          type: 'array',
          items: { type: 'string' },
        },
        quality: {
          type: 'object',
          properties: {
            usable: { type: 'boolean' },
            notes: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['usable', 'notes'],
        },
      },
      required: ['fields', 'missingFields', 'quality'],
    });
  });

  it('does not send domain constraints that contributed to Vertex schema complexity', () => {
    const serialized = JSON.stringify(responseJsonSchema);
    expect(serialized).not.toMatch(
      /"enum"|"minLength"|"maxLength"|"minItems"|"maxItems"|"minimum"|"maximum"|"pattern"/,
    );
  });

  it('still enforces full string constraints during server-side Zod validation', () => {
    const result = ModelExtractionSchema.safeParse({
      fields: [
        {
          name: 'claimant.fullName',
          value: 'x'.repeat(2001),
          confidence: 0.9,
          evidence: [
            {
              documentId: 'doc-1',
              page: 1,
              excerpt: 'Synthetic claimant name',
            },
          ],
          uncertaintyReasons: [],
        },
      ],
      missingFields: [],
      quality: {
        usable: true,
        notes: [],
      },
    });

    expect(result.success).toBe(false);
  });

  it('still rejects field names outside the ClaimFlow domain', () => {
    const result = ModelExtractionSchema.safeParse({
      fields: [
        {
          name: 'claim.approvalDecision',
          value: 'APPROVE',
          confidence: 1,
          evidence: [
            {
              documentId: 'doc-1',
              page: 1,
              excerpt: 'Synthetic text',
            },
          ],
          uncertaintyReasons: [],
        },
      ],
      missingFields: [],
      quality: {
        usable: true,
        notes: [],
      },
    });

    expect(result.success).toBe(false);
  });
});

describe('safe model output diagnostics', () => {
  const pages = new Map([['doc-1', 5]]);
  const field = (overrides: Record<string, unknown> = {}) => ({
    name: 'claimant.fullName',
    value: 'Maya Rivera',
    confidence: 0.9,
    evidence: [{ documentId: 'doc-1', page: 1, excerpt: 'Claimant: Maya Rivera' }],
    uncertaintyReasons: [],
    ...overrides,
  });
  const output = (fields: unknown[]) => ({
    fields,
    missingFields: [],
    quality: { usable: true, notes: [] },
  });

  function diagnostic(text: string): ModelOutputValidationError {
    try {
      parseExtraction(text, pages);
    } catch (error) {
      expect(error).toBeInstanceOf(ModelOutputValidationError);
      return error as ModelOutputValidationError;
    }
    throw new Error('Expected parseExtraction to reject the model output');
  }

  it('distinguishes invalid JSON without exposing raw model text', () => {
    const error = diagnostic('not-json-secret-payload');
    expect(error.diagnosticCode).toBe('MODEL_JSON_INVALID');
    expect(error.message).not.toContain('secret-payload');
  });

  it('identifies unsupported field names', () => {
    const error = diagnostic(
      JSON.stringify(output([field({ name: 'vehicle.vin', value: 'TESTVIN0000000482' })])),
    );
    expect(error.diagnosticCode).toBe('INVALID_FIELD_NAME');
    expect(error.message).not.toContain('TESTVIN0000000482');
  });

  it('identifies duplicate fields from the same source document', () => {
    const error = diagnostic(
      JSON.stringify(
        output([
          field({ name: 'incident.date', value: '2026-09-10' }),
          field({ name: 'incident.date', value: '2026-09-11' }),
        ]),
      ),
    );
    expect(error.diagnosticCode).toBe('DUPLICATE_FIELD_SAME_DOCUMENT');
    expect(error.message).not.toContain('2026-09-10');
    expect(error.message).not.toContain('2026-09-11');
  });

  it('identifies evidence references outside the supplied documents', () => {
    const error = diagnostic(
      JSON.stringify(
        output([
          field({
            evidence: [{ documentId: 'unknown-doc', page: 1, excerpt: 'Claimant: Maya Rivera' }],
          }),
        ]),
      ),
    );
    expect(error.diagnosticCode).toBe('INVALID_EVIDENCE_PAGE');
  });

  it('accepts one field record that preserves an intra-document conflict in evidence', () => {
    const parsed = parseExtraction(
      JSON.stringify(
        output([
          field({
            name: 'incident.date',
            value: '10 September 2026 / 11 September 2026',
            confidence: 0.5,
            evidence: [
              { documentId: 'doc-1', page: 1, excerpt: 'Incident date: 10 September 2026' },
              { documentId: 'doc-1', page: 4, excerpt: '11 September 2026' },
            ],
            uncertaintyReasons: ['Conflicting dates appear in the same source document.'],
          }),
        ]),
      ),
      pages,
    );
    expect(parsed.fields[0]?.evidence).toHaveLength(2);
  });
});
