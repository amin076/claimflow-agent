import { Firestore } from '@google-cloud/firestore';
import { describe, it, expect } from 'vitest';
import { ExtractionService } from './extraction/service.js';
import { MockExtractionProvider } from './extraction/mockProvider.js';
import { documentKey } from './documentStorage.js';
import { FirestoreCaseRepository } from './persistence.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Firestore emulator integration', () => {
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
