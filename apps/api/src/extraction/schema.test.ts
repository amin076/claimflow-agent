import { describe, expect, it } from 'vitest';
import { ModelExtractionSchema, responseJsonSchema, sanitizeVertexJsonSchema } from './schema.js';

describe('Vertex response JSON schema', () => {
  it('removes unsupported JSON Schema keywords recursively', () => {
    expect(
      sanitizeVertexJsonSchema({
        type: 'object',
        properties: {
          value: {
            type: 'string',
            minLength: 1,
            maxLength: 20,
            pattern: '^safe$',
          },
        },
        required: ['value'],
        additionalProperties: false,
      }),
    ).toEqual({
      type: 'object',
      properties: {
        value: {
          type: 'string',
        },
      },
      required: ['value'],
      additionalProperties: false,
    });
  });

  it('keeps supported constraints while omitting Zod string-length constraints', () => {
    const serialized = JSON.stringify(responseJsonSchema);
    expect(serialized).not.toMatch(/"minLength"|"maxLength"|"pattern"/);
    expect(serialized).toContain('"minItems"');
    expect(serialized).toContain('"maxItems"');
    expect(serialized).toContain('"minimum"');
    expect(serialized).toContain('"maximum"');
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
});
