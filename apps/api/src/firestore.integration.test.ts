import { Firestore } from '@google-cloud/firestore';
import { describe, it, expect } from 'vitest';
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
});
