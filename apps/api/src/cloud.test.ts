import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readEnvironment } from '@claimflow/config';
import { createDemoCase } from '@claimflow/domain';
import { buildApp } from './app.js';
import { createRuntime } from './runtime.js';
import { LocalDocumentStorage } from './documentStorage.js';
import { encodeCase } from './persistence.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const pdf = Buffer.from('%PDF-1.4\nSynthetic test document\n%%EOF');
const multipartBody = (bytes: Buffer, filename = 'synthetic.pdf', mime = 'application/pdf') =>
  Buffer.concat([
    Buffer.from(
      `--test-boundary\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    bytes,
    Buffer.from('\r\n--test-boundary--\r\n'),
  ]);
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'claimflow-'));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const runtime = createRuntime(readEnvironment({ UPLOAD_DIR: root }));
  const app = await buildApp(runtime);
  cleanup.push(() => app.close());
  const claim = (
    await app.inject({ method: 'POST', url: '/api/cases', payload: { title: 'Upload test' } })
  ).json();
  return { app, claim, root, runtime };
}
describe('durable file workflow', () => {
  it('round-trips original bytes through upload, storage, download, processing and review', async () => {
    const { app, claim, root } = await setup();
    const upload = await app.inject({
      method: 'POST',
      url: `/api/cases/${claim.id}/uploads?type=CLAIM_FORM`,
      headers: { 'content-type': 'multipart/form-data; boundary=test-boundary' },
      payload: multipartBody(pdf),
    });
    expect(upload.statusCode).toBe(201);
    const document = upload.json().documents[0];
    const key = `cases/${claim.id}/documents/${document.id}/original`;
    expect(await new LocalDocumentStorage(root).read(key)).toEqual(pdf);
    const download = await app.inject(`/api/cases/${claim.id}/documents/${document.id}/content`);
    expect(download.rawPayload).toEqual(pdf);
    expect(download.headers['cache-control']).toBe('private, no-store');
    expect(
      (await app.inject(`/api/cases/missing/documents/${document.id}/content`)).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'POST', url: `/api/cases/${claim.id}/process` })).json().status,
    ).toBe('NEEDS_REVIEW');
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/cases/${claim.id}/review`,
          payload: { reviewerId: 'tester', action: 'ESCALATE', reason: 'Check synthetic source' },
        })
      ).statusCode,
    ).toBe(200);
    expect((await app.inject(`/api/cases/${claim.id}/audit-events`)).json()).toHaveLength(4);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/cases/${claim.id}/uploads?type=CLAIM_FORM`,
          headers: { 'content-type': 'multipart/form-data; boundary=test-boundary' },
          payload: multipartBody(pdf),
        })
      ).statusCode,
    ).toBe(409);
  });
  it('rejects unsupported content, oversized files and invalid identifiers', async () => {
    const { app, claim } = await setup();
    for (const [bytes, code] of [
      [Buffer.from('<script>bad</script>'), 415],
      [Buffer.alloc(5 * 1024 * 1024 + 1), 413],
    ] as const) {
      const result = await app.inject({
        method: 'POST',
        url: `/api/cases/${claim.id}/uploads?type=CLAIM_FORM`,
        headers: { 'content-type': 'multipart/form-data; boundary=test-boundary' },
        payload: multipartBody(bytes),
      });
      expect(result.statusCode).toBe(code);
    }
    expect((await app.inject('/api/cases/a%2Fb')).statusCode).toBe(400);
    expect((await app.inject(`/api/cases/${claim.id}`)).json().documents).toHaveLength(0);
  });
  it('reports dependency failure and prevents fake cloud metadata registration', async () => {
    const { app, runtime, claim } = await setup();
    runtime.ready = async () => {
      throw new Error('private dependency information');
    };
    const ready = await app.inject('/ready');
    expect(ready.statusCode).toBe(503);
    expect(ready.body).not.toContain('private dependency');
    runtime.environment.STORAGE_MODE = 'gcs';
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/cases/${claim.id}/documents`,
          payload: { filename: 'fake.pdf', mimeType: 'application/pdf', type: 'CLAIM_FORM' },
        })
      ).statusCode,
    ).toBe(409);
  });
  it('does not report upload success when persistence fails', async () => {
    const { app, runtime, claim } = await setup();
    runtime.cases.addDocument = async () => {
      throw new Error('firestore unavailable');
    };
    const result = await app.inject({
      method: 'POST',
      url: `/api/cases/${claim.id}/uploads?type=CLAIM_FORM`,
      headers: { 'content-type': 'multipart/form-data; boundary=test-boundary' },
      payload: multipartBody(pdf),
    });
    expect(result.statusCode).toBe(500);
    expect((await app.inject(`/api/cases/${claim.id}`)).json().documents).toHaveLength(0);
  });
});
describe('cloud configuration and limits', () => {
  it('fails closed for incomplete cloud settings and unimplemented AI mode', () => {
    expect(() => readEnvironment({ DATABASE_MODE: 'firestore' })).toThrow();
    expect(() => readEnvironment({ STORAGE_MODE: 'gcs', GOOGLE_CLOUD_PROJECT: 'test' })).toThrow();
    expect(() => readEnvironment({ NODE_ENV: 'production' })).toThrow();
    expect(() => readEnvironment({ AI_MODE: 'vertex' })).toThrow();
    expect(readEnvironment({})).toMatchObject({
      DATABASE_MODE: 'memory',
      STORAGE_MODE: 'local',
      AI_MODE: 'mock',
    });
  });
  it('bounds Firestore payload size before a write', () => {
    const claim = createDemoCase();
    claim.auditEvents[0]!.summary = 'x'.repeat(710_000);
    expect(() => encodeCase(claim)).toThrow();
  });
});
