import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoCase } from '@claimflow/domain';
import { readEnvironment } from '@claimflow/config';
import { InMemoryCaseRepository } from '../caseRepository.js';
import { ClarificationService } from './service.js';
import { buildApp } from '../app.js';
import { createRuntime } from '../runtime.js';
import { encodeCase } from '../persistence.js';

const { generate, construct } = vi.hoisted(() => ({ generate: vi.fn(), construct: vi.fn() }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor(options: unknown) {
      construct(options);
    }
    models = { generateContent: generate };
  },
}));
const env = readEnvironment({
  AI_MODE: 'vertex',
  GOOGLE_CLOUD_PROJECT: 'synthetic-project',
  AI_TIMEOUT_MS: '40000',
  CLARIFICATION_REVIEW_TOKEN: 'synthetic-reviewer-capability-key-32-characters',
  ELEVENLABS_API_KEY: 'fake',
  ELEVENLABS_AGENT_ID: 'fake',
  ELEVENLABS_PHONE_NUMBER_ID: 'fake',
  ELEVENLABS_WEBHOOK_SECRET: 'fake',
  CLARIFICATION_TEST_PHONE: '+61400000000',
});
const response = (text: unknown, finishReason = 'STOP') => ({
  text,
  candidates: [{ finishReason }],
});
function setup() {
  const claim = createDemoCase();
  claim.status = 'NEEDS_REVIEW';
  claim.fields.find((field) => field.name === 'incident.date')!.uncertaintyReasons = [
    'Conflicting source values: 2026-09-10 / 2026-09-11',
  ];
  claim.issues = [
    {
      id: 'synthetic-conflict',
      caseId: claim.id,
      type: 'CONTRADICTION',
      severity: 'BLOCKING',
      status: 'OPEN',
      message: 'Two incident dates require review.',
      fieldNames: ['incident.date'],
      documentIds: [],
      createdAt: claim.createdAt,
    },
  ];
  const cases = new InMemoryCaseRepository([claim]);
  const voice = { call: vi.fn() };
  const service = new ClarificationService(cases, voice, env);
  const body = { issueId: 'synthetic-conflict', fieldName: 'incident.date' };
  return { claim, cases, voice, service, body };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});
describe('production clarification draft regression', () => {
  it.each([
    [
      'timeout',
      () =>
        generate.mockRejectedValue(new DOMException('private provider message', 'TimeoutError')),
      'TIMEOUT',
    ],
    [
      'provider error',
      () => generate.mockRejectedValue(new Error('private provider message')),
      'PROVIDER_ERROR',
    ],
    [
      'permission',
      () =>
        generate.mockRejectedValue(
          Object.assign(new Error('private provider message'), { status: 403 }),
        ),
      'ACCESS_DENIED',
    ],
    [
      'quota',
      () =>
        generate.mockRejectedValue(
          Object.assign(new Error('private provider message'), { status: 429 }),
        ),
      'RATE_LIMIT',
    ],
    ['empty', () => generate.mockResolvedValue(response('')), 'INVALID_TEXT'],
    ['whitespace', () => generate.mockResolvedValue(response('  \n  ')), 'INVALID_TEXT'],
    ['oversized', () => generate.mockResolvedValue(response('x'.repeat(2001))), 'INVALID_TEXT'],
    [
      'incomplete',
      () => generate.mockResolvedValue(response('Partial question', 'MAX_TOKENS')),
      'INCOMPLETE_OUTPUT',
    ],
    [
      'unknown finish',
      () => generate.mockResolvedValue(response('Question?', 'private provider message')),
      'INCOMPLETE_OUTPUT',
    ],
    [
      'lost candidate',
      () => generate.mockResolvedValue(response('Was it 2026-09-10?')),
      'CANDIDATES_CHANGED',
    ],
  ] as const)(
    'persists an editable safe DRAFT for %s without a call or secret diagnostics',
    async (_name, arrange, failureClass) => {
      arrange();
      const f = setup();
      const result = await f.service.create(f.claim.id, f.body);
      const item = result.clarifications![0]!;
      expect(item.status).toBe('DRAFT');
      expect(item.approvedAt).toBeUndefined();
      expect(item.question).toContain('2026-09-10 or 2026-09-11');
      expect(item.drafting).toMatchObject({ source: 'TEMPLATE', failureClass });
      expect(item.drafting!.durationMs).toBeGreaterThanOrEqual(0);
      expect(JSON.parse(encodeCase(result).payload).clarifications[0].drafting).toEqual(
        item.drafting,
      );
      expect(
        result.auditEvents.some((event) => event.action === 'CLARIFICATION_DRAFT_FALLBACK'),
      ).toBe(true);
      expect(result.fields).toEqual(f.claim.fields);
      expect(result.issues).toEqual(f.claim.issues);
      expect(f.voice.call).not.toHaveBeenCalled();
      await expect(f.service.call(f.claim.id, item.id)).rejects.toMatchObject({
        code: 'APPROVAL_REQUIRED',
      });
      expect(generate).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result)).not.toContain('private provider message');
      const log = JSON.stringify(vi.mocked(console.info).mock.calls);
      expect(log).toContain('CLARIFICATION_DRAFT_RESULT');
      expect(log).not.toContain('private provider message');
      expect(log).not.toContain('2026-09-10');
      expect(log).not.toContain(env.CLARIFICATION_REVIEW_TOKEN!);
    },
  );
  it('uses valid Gemini wording and aligns the bounded SDK request with extraction', async () => {
    const question = 'Could you confirm whether the incident was on 2026-09-10 or 2026-09-11?';
    generate.mockResolvedValue(response('  ' + question + '  '));
    const f = setup();
    const result = await f.service.create(f.claim.id, f.body);
    const item = result.clarifications![0]!;
    expect(item.question).toBe(question);
    expect(item.drafting).toMatchObject({ source: 'GEMINI', finishReason: 'STOP' });
    expect(item.drafting!.failureClass).toBeUndefined();
    expect(f.voice.call).not.toHaveBeenCalled();
    expect(construct).toHaveBeenCalledWith({
      vertexai: true,
      project: env.GOOGLE_CLOUD_PROJECT,
      location: env.VERTEX_LOCATION,
      httpOptions: { timeout: 40000, retryOptions: { attempts: 1 } },
    });
    expect(generate.mock.calls[0]![0]).toMatchObject({
      model: env.GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: expect.any(String) }] }],
      config: { maxOutputTokens: 512, candidateCount: 1, abortSignal: expect.any(AbortSignal) },
    });
  });
  it('returns HTTP success on model timeout but still rejects requests without the reviewer key', async () => {
    generate.mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    const f = setup();
    const runtime = createRuntime(env);
    runtime.cases = f.cases;
    runtime.voiceProvider = f.voice;
    const app = await buildApp(runtime);
    try {
      const url = `/api/cases/${f.claim.id}/clarifications`;
      expect((await app.inject({ method: 'POST', url, payload: f.body })).statusCode).toBe(401);
      expect(generate).not.toHaveBeenCalled();
      const result = await app.inject({
        method: 'POST',
        url,
        payload: f.body,
        headers: { 'x-clarification-token': env.CLARIFICATION_REVIEW_TOKEN! },
      });
      expect(result.statusCode).toBe(200);
      expect(result.json().clarifications[0].status).toBe('DRAFT');
      expect(f.voice.call).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
