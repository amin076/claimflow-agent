import { readEnvironment } from '@claimflow/config';
import { ClarificationService } from './clarification/service.js';
import { receiveWebhook } from './clarification/webhook.js';
import { createHmac } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { describe, it, expect } from 'vitest';
import { ExtractionService } from './extraction/service.js';
import { MockExtractionProvider } from './extraction/mockProvider.js';
import { documentKey } from './documentStorage.js';
import { FirestoreCaseRepository } from './persistence.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Firestore emulator integration', () => {
  it('persists voice mapping and transcript across instances with an atomic single-call reservation', async () => {
    const first = new Firestore({ projectId: 'claimflow-test' });
    const second = new Firestore({ projectId: 'claimflow-test' });
    const a = new FirestoreCaseRepository(first);
    const b = new FirestoreCaseRepository(second);
    const claim = await a.create({ title: 'Synthetic voice integration' });
    const env = readEnvironment({
      ELEVENLABS_API_KEY: 'test',
      ELEVENLABS_AGENT_ID: 'test-agent',
      ELEVENLABS_PHONE_NUMBER_ID: 'test-phone',
      ELEVENLABS_WEBHOOK_SECRET: 'test-secret',
      CLARIFICATION_TEST_PHONE: '+61400000000',
    });
    let calls = 0;
    const provider = {
      call: async () => {
        calls++;
        return { conversationId: `conv-${claim.id}`, callId: 'test-call' };
      },
    };
    try {
      await a.addDocument(claim.id, {
        filename: 'synthetic.pdf',
        mimeType: 'application/pdf',
        type: 'CLAIM_FORM',
      });
      await a.process(claim.id);
      const issue = (await a.get(claim.id))!.issues.find(
        (issue) => issue.type === 'MISSING_REQUIRED_FIELD',
      )!;
      const service = new ClarificationService(a, provider, env);
      const created = await service.create(claim.id, {
        issueId: issue.id,
        fieldName: 'incident.address',
      });
      const id = created.clarifications![0]!.id;
      await service.approve(claim.id, id, { question: 'Please confirm the address.' });
      const results = await Promise.allSettled([
        service.call(claim.id, id),
        new ClarificationService(b, provider, env).call(claim.id, id),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(calls).toBe(1);
      expect((await b.findConversation(`conv-${claim.id}`))!.id).toBe(claim.id);
      const raw = JSON.stringify({
        type: 'post_call_transcription',
        data: {
          agent_id: 'test-agent',
          conversation_id: `conv-${claim.id}`,
          status: 'done',
          transcript: [{ role: 'user', message: '12 Synthetic Street' }],
        },
      });
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = `t=${timestamp},v0=${createHmac('sha256', 'test-secret').update(`${timestamp}.${raw}`).digest('hex')}`;
      await Promise.all([
        receiveWebhook(raw, signature, env, a),
        receiveWebhook(raw, signature, env, b),
      ]);
      const saved = (await a.get(claim.id))!;
      expect(saved.clarifications![0]!.response!.transcript[0]!.message).toBe(
        '12 Synthetic Street',
      );
      expect(
        saved.auditEvents.filter((event) => event.action === 'CLARIFICATION_RESPONSE_RECEIVED'),
      ).toHaveLength(1);
      expect(saved.fields.some((field) => field.name === 'incident.address')).toBe(false);
    } finally {
      await first.collection('cases').doc(claim.id).delete();
      await Promise.all([first.terminate(), second.terminate()]);
    }
  }, 30000);
  it('persists across clients and commits concurrent audit events without lost updates', async () => {
    const projectId = 'claimflow-test';
    const first = new Firestore({ projectId });
    const second = new Firestore({ projectId });
    const a = new FirestoreCaseRepository(first);
    const b = new FirestoreCaseRepository(second);
    let id: string | undefined;
    try {
      const claim = await a.create({ title: 'Emulator persistence test' });
      id = claim.id;
      expect(await b.get(id)).toEqual(claim);
      await Promise.all(
        [a, b].map((repo, index) =>
          repo.addDocument(claim.id, {
            filename: `synthetic-${index}.pdf`,
            mimeType: 'application/pdf',
            type: 'CLAIM_FORM',
          }),
        ),
      );
      const stored = await a.get(id);
      expect(stored?.documents).toHaveLength(2);
      expect(stored?.auditEvents).toHaveLength(3);
      await b.process(id);
      await a.review(id, { reviewerId: 'tester', action: 'ESCALATE', reason: 'Emulator review' });
      expect((await b.get(id))?.auditEvents).toHaveLength(5);
      expect(await b.list()).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
    } finally {
      if (id) await first.collection('cases').doc(id).delete();
      await Promise.all([first.terminate(), second.terminate()]);
    }
  }, 30_000);
  it('claims a workflow atomically across two backend instances and persists all six steps', async () => {
    const first = new Firestore({ projectId: 'claimflow-test' });
    const second = new Firestore({ projectId: 'claimflow-test' });
    const a = new FirestoreCaseRepository(first);
    const b = new FirestoreCaseRepository(second);
    const claim = await a.create({ title: 'Cross-instance workflow' });
    try {
      const input = {
        filename: 'synthetic.pdf',
        mimeType: 'application/pdf',
        type: 'CLAIM_FORM' as const,
      };
      await a.addDocument(claim.id, input, {
        ...input,
        id: 'doc-concurrent',
        caseId: claim.id,
        storageUri: `local://${documentKey(claim.id, 'doc-concurrent')}`,
        uploadedAt: new Date().toISOString(),
        quality: { score: 0, usable: false, issues: [], notes: [] },
      });
      let calls = 0;
      const mock = new MockExtractionProvider();
      const provider = {
        model: mock.model,
        generate: async (request: Parameters<typeof mock.generate>[0]) => {
          calls++;
          return mock.generate(request);
        },
      };
      const storage = {
        put: async () => '',
        read: async () => Buffer.from('%PDF-1.4 synthetic mock'),
      };
      const outcomes = await Promise.allSettled(
        [a, b].map((repo) =>
          new ExtractionService(repo, storage, provider, 40000, true).process(claim.id),
        ),
      );
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(calls).toBe(1);
      const saved = await b.get(claim.id);
      expect(saved?.agentRuns).toHaveLength(6);
      expect(saved?.agentRuns.every((run) => run.status === 'SUCCEEDED')).toBe(true);
      expect(saved?.fields).toHaveLength(3);
    } finally {
      await first.collection('cases').doc(claim.id).delete();
      await Promise.all([first.terminate(), second.terminate()]);
    }
  }, 30_000);
});
