import { describe, expect, it } from 'vitest';
import { ClaimCaseSchema, createDemoCase } from './index.js';

describe('ClaimCaseSchema', () => {
  it('creates a valid synthetic demo case', () => {
    expect(ClaimCaseSchema.parse(createDemoCase()).reference).toBe('CF-2026-001');
  });

  it('rejects an unsupported status', () => {
    expect(() => ClaimCaseSchema.parse({ ...createDemoCase(), status: 'APPROVED' })).toThrow();
  });
});
