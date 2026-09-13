import { createHmac } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { createDemoCase, ClaimCaseSchema } from '@claimflow/domain';
import { readEnvironment } from '@claimflow/config';
import { InMemoryCaseRepository } from '../caseRepository.js';
import { ClarificationService } from './service.js';
import { ElevenLabsVoiceProvider } from './provider.js';
import { receiveWebhook } from './webhook.js';
import { encodeCase } from '../persistence.js';
import { buildApp } from '../app.js';
import { createRuntime } from '../runtime.js';

const env = readEnvironment({
  AI_MODE: 'mock',
  ELEVENLABS_API_KEY: 'synthetic-key',
  ELEVENLABS_AGENT_ID: 'test-agent',
  ELEVENLABS_PHONE_NUMBER_ID: 'test-phone',
  ELEVENLABS_WEBHOOK_SECRET: 'synthetic-webhook-secret',
  CLARIFICATION_REVIEW_TOKEN: 'synthetic-review-token-with-32-characters',
  CLARIFICATION_TEST_PHONE: '+61400000000',
});
const sign = (body: string, timestamp = Math.floor(Date.now() / 1000)) =>
  `t=${timestamp},v0=${createHmac('sha256', env.ELEVENLABS_WEBHOOK_SECRET!).update(`${timestamp}.${body}`).digest('hex')}`;
function setup() {
  const claim = createDemoCase();
  claim.status = 'NEEDS_INPUT';
  claim.fields = claim.fields.filter((field) => field.name !== 'incident.address');
  claim.issues = [
    {
      id: 'missing-address',
      caseId: claim.id,
      type: 'MISSING_REQUIRED_FIELD',
      status: 'OPEN',
      severity: 'BLOCKING',
      message: 'Address missing',
      fieldNames: ['incident.address'],
      documentIds: [],
      createdAt: new Date().toISOString(),
    },
  ];
  const cases = new InMemoryCaseRepository([claim]);
  const provider = {
    call: vi.fn().mockResolvedValue({ conversationId: 'conversation-test', callId: 'call-test' }),
  };
  const service = new ClarificationService(cases, provider, env);
  const create = async () =>
    (await service.create(claim.id, { issueId: 'missing-address', fieldName: 'incident.address' }))
      .clarifications![0]!;
  const start = async () => {
    const item = await create();
    await service.approve(claim.id, item.id, { question: 'Please confirm the incident address.' });
    await service.call(claim.id, item.id);
    return item;
  };
  const raw = JSON.stringify({
    type: 'post_call_transcription',
    data: {
      agent_id: 'test-agent',
      conversation_id: 'conversation-test',
      status: 'done',
      transcript: [
        { role: 'agent', message: 'Please confirm the address.' },
        { role: 'user', message: '12 Synthetic Street' },
      ],
      conversation_initiation_client_data: { dynamic_variables: { case_id: 'a-different-case' } },
    },
  });
  return { claim, cases, provider, service, create, start, raw };
}
describe('voice clarification lifecycle', () => {
  it('requires approval and starts exactly one call under concurrent requests', async () => {
    const f = setup();
    const item = await f.create();
    await expect(f.service.call(f.claim.id, item.id)).rejects.toMatchObject({
      code: 'APPROVAL_REQUIRED',
    });
    expect(f.provider.call).not.toHaveBeenCalled();
    await f.service.approve(f.claim.id, item.id, { question: 'Approved exact wording?' });
    await expect(
      f.service.approve(f.claim.id, item.id, { question: 'Changed?' }),
    ).rejects.toMatchObject({ code: 'INVALID_CLARIFICATION_STATE' });
    const results = await Promise.allSettled([
      f.service.call(f.claim.id, item.id),
      f.service.call(f.claim.id, item.id),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(f.provider.call).toHaveBeenCalledTimes(1);
    expect(f.provider.call.mock.calls[0]![0].question).toBe('Approved exact wording?');
  });
  it('persists transcript, ignores spoofed case context, deduplicates, and requires human canonical correction', async () => {
    const f = setup();
    const item = await f.start();
    const before = f.cases.get(f.claim.id)!;
    await receiveWebhook(f.raw, sign(f.raw), env, f.cases);
    const completed = f.cases.get(f.claim.id)!;
    expect(completed.fields).toEqual(before.fields);
    expect(completed.issues).toEqual(before.issues);
    expect(completed.status).toBe(before.status);
    expect(completed.clarifications![0]!.status).toBe('COMPLETED');
    await receiveWebhook(f.raw, sign(f.raw), env, f.cases);
    expect(f.cases.get(f.claim.id)).toEqual(completed);
    const persisted = ClaimCaseSchema.parse(JSON.parse(encodeCase(completed).payload));
    expect(persisted.clarifications![0]!.response!.transcript[1]!.message).toBe(
      '12 Synthetic Street',
    );
    expect(encodeCase(completed).conversationIds).toEqual(['conversation-test']);
    const updated = f.cases.review(f.claim.id, {
      reviewerId: 'voice-reviewer',
      action: 'CORRECT',
      fieldName: 'incident.address',
      correctedValue: '12 Synthetic Street',
      reason: 'Confirmed against the caller response',
      clarificationResponseId: `response-${item.id}`,
    })!;
    expect(
      updated.fields.find((field) => field.name === 'incident.address')!.evidence[0]!
        .clarificationResponseId,
    ).toBe(`response-${item.id}`);
    expect(updated.clarifications![0]!.status).toBe('RESOLVED');
    expect(updated.auditEvents.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        'CLARIFICATION_CREATED',
        'CLARIFICATION_APPROVED',
        'VOICE_CALL_STARTED',
        'VOICE_CALL_COMPLETED',
        'CLARIFICATION_RESPONSE_RECEIVED',
        'CLARIFICATION_RESOLVED',
      ]),
    );
  });
  it.each(['missing', 'tampered', 'expired', 'future'])(
    'rejects %s signatures without mutations',
    async (mode) => {
      const f = setup();
      await f.start();
      const before = f.cases.get(f.claim.id);
      const signature =
        mode === 'missing'
          ? undefined
          : mode === 'tampered'
            ? sign(f.raw + ' ')
            : sign(f.raw, Math.floor(Date.now() / 1000) + (mode === 'future' ? 120 : -1900));
      await expect(receiveWebhook(f.raw, signature, env, f.cases)).rejects.toMatchObject({
        code: 'INVALID_WEBHOOK_SIGNATURE',
      });
      expect(f.cases.get(f.claim.id)).toEqual(before);
    },
  );
  it('rejects unknown conversation and wrong agent', async () => {
    const f = setup();
    await f.start();
    for (const [from, to, code] of [
      ['conversation-test', 'unknown', 'CONVERSATION_NOT_MAPPED'],
      ['test-agent', 'wrong', 'UNKNOWN_VOICE_AGENT'],
    ]) {
      const raw = f.raw.replace(from!, to!);
      await expect(receiveWebhook(raw, sign(raw), env, f.cases)).rejects.toMatchObject({ code });
    }
  });
  it('records sanitized call failure without retry', async () => {
    const f = setup();
    f.provider.call.mockRejectedValue(new Error('secret raw provider details'));
    const item = await f.start();
    const result = f.cases.get(f.claim.id)!;
    expect(result.clarifications![0]!.errorSummary).toBe('VOICE_START_UNCONFIRMED');
    expect(JSON.stringify(result)).not.toContain('secret raw');
    await expect(f.service.call(f.claim.id, item.id)).rejects.toMatchObject({
      code: 'APPROVAL_REQUIRED',
    });
    expect(f.provider.call).toHaveBeenCalledTimes(1);
  });
  it('handles call initiation failure idempotently', async () => {
    const f = setup();
    await f.start();
    const raw = JSON.stringify({
      type: 'call_initiation_failure',
      data: {
        agent_id: 'test-agent',
        conversation_id: 'conversation-test',
        failure_reason: 'no-answer',
      },
    });
    await receiveWebhook(raw, sign(raw), env, f.cases);
    const failed = f.cases.get(f.claim.id)!;
    expect(failed.clarifications![0]!.status).toBe('FAILED');
    await receiveWebhook(raw, sign(raw), env, f.cases);
    expect(f.cases.get(f.claim.id)).toEqual(failed);
  });
  it('rejects stale source, cancelled requests, foreign evidence and no-answer corrections', async () => {
    const f = setup();
    const item = await f.create();
    await f.service.cancel(f.claim.id, item.id);
    await expect(
      f.service.approve(f.claim.id, item.id, { question: 'Question?' }),
    ).rejects.toMatchObject({ code: 'INVALID_CLARIFICATION_STATE' });
    expect(() =>
      f.cases.review(f.claim.id, {
        reviewerId: 'reviewer',
        action: 'CORRECT',
        fieldName: 'incident.address',
        correctedValue: 'x',
        reason: 'test',
        clarificationResponseId: 'foreign',
      }),
    ).toThrow();
    const next = await f.create();
    f.cases.update(f.claim.id, (claim) => ({ ...claim, documents: [], fields: [] }));
    await expect(
      f.service.approve(f.claim.id, next.id, { question: 'Question?' }),
    ).rejects.toMatchObject({ code: 'CLARIFICATION_STALE' });
  });
  it('bounds transcript persistence and discloses truncation', async () => {
    const f = setup();
    await f.start();
    const payload = JSON.parse(f.raw);
    payload.data.transcript = Array.from({ length: 110 }, () => ({
      role: 'user',
      message: 'a'.repeat(5000),
    }));
    const raw = JSON.stringify(payload);
    await receiveWebhook(raw, sign(raw), env, f.cases);
    const response = f.cases.get(f.claim.id)!.clarifications![0]!.response!;
    expect(response.transcriptTruncated).toBe(true);
    expect(response.transcript.reduce((sum, turn) => sum + turn.message.length, 0)).toBe(20000);
  });
  it('builds the official outbound request with dynamic context and fixed test destination', async () => {
    const f = setup();
    const item = await f.create();
    const send = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, conversation_id: 'conv', callSid: 'sid' })),
      );
    await new ElevenLabsVoiceProvider(env, send).call(item, 'Synthetic Person');
    expect(send.mock.calls[0]![0]).toBe('https://api.elevenlabs.io/v1/convai/twilio/outbound-call');
    const body = JSON.parse(send.mock.calls[0]![1].body);
    expect(body).toMatchObject({
      agent_id: 'test-agent',
      agent_phone_number_id: 'test-phone',
      to_number: '+61400000000',
      conversation_initiation_client_data: {
        dynamic_variables: {
          case_id: f.claim.id,
          clarification_id: item.id,
          clarification_question: item.question,
        },
      },
    });
    send.mockResolvedValue(new Response('secret', { status: 500 }));
    await expect(
      new ElevenLabsVoiceProvider(env, send).call(item, 'Synthetic'),
    ).rejects.toMatchObject({ code: 'VOICE_START_UNCONFIRMED' });
  });
  it('resolves a contradiction only after a valid human correction, retaining original evidence', async () => {
    const f = setup();
    f.cases.update(f.claim.id, (claim) => {
      const field = claim.fields.find((field) => field.name === 'incident.date')!;
      field.uncertaintyReasons = ['Conflicting source values: 2026-09-10 / 2026-09-11'];
      claim.issues = [
        {
          ...claim.issues[0]!,
          id: 'date-conflict',
          type: 'CONTRADICTION',
          fieldNames: ['incident.date'],
        },
      ];
      return claim;
    });
    const created = await f.service.create(f.claim.id, {
      issueId: 'date-conflict',
      fieldName: 'incident.date',
    });
    const item = created.clarifications![0]!;
    expect(item.candidateValues).toEqual(['2026-09-10', '2026-09-11']);
    await f.service.approve(f.claim.id, item.id, { question: 'Which incident date is correct?' });
    await f.service.call(f.claim.id, item.id);
    const raw = f.raw.replace('12 Synthetic Street', 'September eleventh, 2026');
    await receiveWebhook(raw, sign(raw), env, f.cases);
    const correction = {
      reviewerId: 'voice-reviewer',
      action: 'CORRECT' as const,
      fieldName: 'incident.date' as const,
      correctedValue: 'not-a-date',
      reason: 'Heard caller answer',
      clarificationResponseId: `response-${item.id}`,
    };
    const invalid = f.cases.review(f.claim.id, correction)!;
    expect(invalid.clarifications![0]!.status).toBe('COMPLETED');
    expect(
      invalid.issues.some((issue) => issue.type === 'INVALID_FORMAT' && issue.status === 'OPEN'),
    ).toBe(true);
    const valid = f.cases.review(f.claim.id, { ...correction, correctedValue: '2026-09-11' })!;
    expect(valid.clarifications![0]!.status).toBe('RESOLVED');
    expect(
      valid.fields
        .find((field) => field.name === 'incident.date')!
        .evidence.some((evidence) => evidence.documentId),
    ).toBe(true);
  });
  it('does not permit agent-only transcripts or a response for another field as correction evidence', async () => {
    const f = setup();
    const item = await f.start();
    const raw = f.raw.replace('"role":"user"', '"role":"agent"');
    await receiveWebhook(raw, sign(raw), env, f.cases);
    for (const fieldName of ['incident.address', 'incident.date'] as const)
      expect(() =>
        f.cases.review(f.claim.id, {
          reviewerId: 'reviewer',
          action: 'CORRECT',
          fieldName,
          correctedValue: 'value',
          reason: 'test',
          clarificationResponseId: `response-${item.id}`,
        }),
      ).toThrow();
  });
  it('protects HTTP actions and verifies the exact raw webhook body', async () => {
    const f = setup();
    await f.start();
    const runtime = createRuntime(env);
    runtime.cases = f.cases;
    runtime.voiceProvider = f.provider;
    const app = await buildApp(runtime);
    try {
      const noKey = await app.inject({
        method: 'POST',
        url: `/api/cases/${f.claim.id}/clarifications`,
        payload: {},
      });
      expect(noKey.statusCode).toBe(401);
      const result = await app.inject({
        method: 'POST',
        url: '/api/webhooks/elevenlabs',
        headers: { 'content-type': 'application/json', 'elevenlabs-signature': sign(f.raw) },
        payload: f.raw,
      });
      expect(result.statusCode).toBe(200);
      const replay = await app.inject({
        method: 'POST',
        url: '/api/webhooks/elevenlabs',
        headers: { 'content-type': 'application/json', 'elevenlabs-signature': sign(f.raw) },
        payload: f.raw + ' ',
      });
      expect(replay.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
