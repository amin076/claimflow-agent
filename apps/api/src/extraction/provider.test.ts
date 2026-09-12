import { expect, it, vi } from 'vitest';
import { readEnvironment } from '@claimflow/config';
import { VertexExtractionProvider } from './provider.js';

const generateContent = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

it('converts an SDK rejection to a safe workflow error in one call', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  generateContent.mockRejectedValueOnce(
    Object.assign(new Error('private responseJsonSchema'), { status: 400 }),
  );
  try {
    const provider = new VertexExtractionProvider(
      readEnvironment({ GOOGLE_CLOUD_PROJECT: 'test-project' }),
    );
    await expect(
      provider.generate({ documents: [], signal: new AbortController().signal }),
    ).rejects.toMatchObject({
      code: 'VERTEX_REQUEST_REJECTED',
      message: expect.stringContaining('RESPONSE_SCHEMA'),
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
  } finally {
    log.mockRestore();
  }
});
