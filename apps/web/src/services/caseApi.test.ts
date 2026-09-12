import { createDemoCase } from '@claimflow/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { caseApi } from './caseApi.js';

afterEach(() => vi.unstubAllGlobals());

describe('caseApi', () => {
  it('validates the case list returned by the Backend', async () => {
    const claim = createDemoCase();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([claim]), { status: 200 })),
    );

    await expect(caseApi.list()).resolves.toEqual([claim]);
  });

  it('rejects a successful response that violates the shared schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([{ id: 'invalid' }]), { status: 200 })),
    );

    await expect(caseApi.list()).rejects.toThrow();
  });

  it('surfaces the safe API error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: 'CASE_HAS_NO_DOCUMENTS', message: 'Add a document.' }),
            {
              status: 409,
            },
          ),
      ),
    );

    await expect(caseApi.process('case-1')).rejects.toThrow('Add a document.');
  });
});
