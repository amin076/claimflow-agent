import { describe, expect, it, vi } from 'vitest';
import { describeProviderError, reportProviderError } from './providerError.js';

describe('safe Vertex diagnostics', () => {
  it.each([
    [400, 'VERTEX_REQUEST_REJECTED'],
    [403, 'VERTEX_ACCESS_DENIED'],
    [404, 'VERTEX_MODEL_UNAVAILABLE'],
    [429, 'VERTEX_RATE_LIMIT'],
    [503, 'VERTEX_SERVICE_ERROR'],
  ])('classifies HTTP %s', (status, category) => {
    expect(
      describeProviderError(Object.assign(new Error('private source'), { status })),
    ).toMatchObject({ httpStatus: status, category });
  });
  it('logs and returns only safe categories, never raw messages or nested credentials', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const error = Object.assign(new Error('responseJsonSchema invalid: PRIVATE_SOURCE'), {
        status: 400,
        credentials: 'SECRET_TOKEN',
        cause: new Error('PRIVATE_SOURCE'),
      });
      const result = reportProviderError(error);
      expect(result.message).toContain('HTTP 400. RESPONSE_SCHEMA');
      const serialized = JSON.stringify([result, log.mock.calls]);
      expect(serialized).not.toMatch(/PRIVATE_SOURCE|SECRET_TOKEN/);
      expect(JSON.parse(log.mock.calls[0]![0])).toMatchObject({
        severity: 'ERROR',
        httpStatus: 400,
      });
    } finally {
      log.mockRestore();
    }
  });
  it('handles unknown errors and timeouts without leaking their text', () => {
    expect(describeProviderError(null).category).toBe('VERTEX_CLIENT_ERROR');
    expect(describeProviderError(new DOMException('private', 'TimeoutError')).category).toBe(
      'VERTEX_TIMEOUT',
    );
    expect(describeProviderError(new Error('fetch failed private')).hint).toBe('NETWORK');
  });
});
