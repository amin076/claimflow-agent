import { describe, expect, it } from 'vitest';
import { ModelExtractionSchema, responseJsonSchema } from './schema.js';

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
