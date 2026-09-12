import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { InMemoryCaseRepository } from '../caseRepository.js';
import type { DocumentStorage } from '../documentStorage.js';
import { documentKey } from '../documentStorage.js';
import { ExtractionService } from './service.js';
import type { ExtractionProvider, ExtractionRequest } from './provider.js';
import { parseExtraction } from './schema.js';
import { applyHumanReview } from './review.js';
import { materialize, validateFields } from './validation.js';
import { type ClaimCase, type ClaimFieldName, type SourceDocument } from '@claimflow/domain';

const input = {
  filename: 'synthetic.pdf',
  mimeType: 'application/pdf',
  type: 'CLAIM_FORM' as const,
};
const source = (id: string, caseId: string): SourceDocument => ({
  ...input,
  id,
  caseId,
  storageUri: `local://${documentKey(caseId, id)}`,
  uploadedAt: new Date().toISOString(),
  quality: { score: 0, usable: false, issues: [], notes: [] },
});
function output(id: string) {
  return {
    fields: [
      ['claimant.fullName', 'Maya Rivera'],
      ['incident.date', '2026-09-10'],
      ['incident.address', '12 Synthetic Street'],
      ['damage.description', 'Rear bumper dent'],
    ].map(([name, value]) => ({
      name,
      value,
      confidence: 0.97,
      evidence: [{ documentId: id, page: 1, excerpt: value }],
      uncertaintyReasons: [],
    })),
    missingFields: [],
    quality: { usable: true, notes: [] },
  };
}
async function setup(response?: string, finishReason = 'STOP') {
  const repo = new InMemoryCaseRepository([]);
  const claim = repo.create({ title: 'Pipeline test' });
  repo.addDocument(claim.id, input, source('doc-a', claim.id));
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = Buffer.from(await pdf.save());
  const storage: DocumentStorage = { put: async () => '', read: async () => bytes };
  const generate = vi.fn(async (_request: ExtractionRequest) => ({
    text: response ?? JSON.stringify(output('doc-a')),
    finishReason,
    modelVersion: 'test-version',
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
  }));
  const provider: ExtractionProvider = { model: 'gemini-test', generate };
  return {
    repo,
    claim,
    storage,
    generate,
    provider,
    service: new ExtractionService(repo, storage, provider),
  };
}
describe('ADK extraction workflow', () => {
  it('runs all six real ADK steps, persists trace/usage and requires human verification', async () => {
    const { service, claim, repo, generate } = await setup();
    const result = (await service.process(claim.id))!;
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.fields[0]?.value).toBe('Maya Rivera');
    expect(result.fields.every((field) => field.requiresReview)).toBe(true);
    expect(result.agentRuns.map((run) => run.agent)).toEqual([
      'INTAKE',
      'QUALITY',
      'EXTRACTION',
      'VALIDATION',
      'CASE_PLANNER',
      'REVIEW_ROUTER',
    ]);
    expect(result.agentRuns.every((run) => run.status === 'SUCCEEDED')).toBe(true);
    expect(result.agentRuns[2]).toMatchObject({
      model: 'gemini-test',
      modelVersion: 'test-version',
      totalTokens: 30,
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]![0].documents[0]!.bytes.length).toBeGreaterThan(0);
    expect(result.auditEvents.at(-1)?.action).toBe('CASE_PROCESSED');
    await expect(service.process(claim.id)).rejects.toMatchObject({ code: 'CASE_NOT_DRAFT' });
    expect(generate).toHaveBeenCalledTimes(1);
    for (const field of result.fields)
      repo.review(claim.id, {
        reviewerId: 'reviewer',
        action: 'ACCEPT',
        fieldName: field.name,
        reason: 'Checked source',
      });
    expect(repo.get(claim.id)?.status).toBe('READY');
  });
  it.each([
    'not JSON',
    JSON.stringify({ ...output('foreign-document') }),
    JSON.stringify({ ...output('doc-a'), approval: true }),
  ])('fails closed for invalid output: %s', async (text) => {
    const { service, claim, generate } = await setup(text);
    const result = (await service.process(claim.id))!;
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.fields).toEqual([]);
    expect(result.agentRuns[2]?.status).toBe('FAILED');
    expect(result.agentRuns[3]?.status).toBe('SKIPPED');
    expect(result.issues[0]?.type).toBe('INVALID_MODEL_OUTPUT');
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it.each(['MAX_TOKENS', 'SAFETY'])('rejects %s completion', async (reason) => {
    const { service, claim } = await setup(undefined, reason);
    expect((await service.process(claim.id))?.fields).toEqual([]);
  });
  it('prevents concurrent billing and review during extraction', async () => {
    const { repo, claim, storage, provider } = await setup();
    let release!: () => void;
    let entered!: () => void;
    const called = new Promise<void>((resolve) => {
      entered = resolve;
    });
    provider.generate = async () => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { text: JSON.stringify(output('doc-a')), finishReason: 'STOP' };
    };
    const service = new ExtractionService(repo, storage, provider);
    const first = service.process(claim.id);
    await called;
    await expect(service.process(claim.id)).rejects.toMatchObject({ code: 'CASE_NOT_DRAFT' });
    expect(() =>
      repo.review(claim.id, { reviewerId: 'x', action: 'ESCALATE', reason: 'test' }),
    ).toThrow();
    release();
    await first;
  });
  it('times out once, records failure and aborts the provider signal', async () => {
    const { repo, claim, storage, provider } = await setup();
    let signal: AbortSignal | undefined;
    provider.generate = async (request) => {
      signal = request.signal;
      return new Promise(() => {});
    };
    const result = await new ExtractionService(repo, storage, provider, 10).process(claim.id);
    expect(signal?.aborted).toBe(true);
    expect(result?.issues[0]?.message).toContain('MODEL_TIMEOUT');
  });
  it('recovers expired runs without another model call and rejects late writes', async () => {
    const { repo, claim, service, generate } = await setup();
    repo.update(claim.id, (current) => ({
      ...current,
      status: 'PROCESSING',
      processingId: 'old-run',
      processingStartedAt: new Date(Date.now() - 121_000).toISOString(),
    }));
    expect((await service.recover(claim.id))?.status).toBe('NEEDS_REVIEW');
    expect(generate).not.toHaveBeenCalled();
  });
  it('replacing a source invalidates fields while retaining review history and old source metadata', async () => {
    const { service, claim, repo } = await setup();
    await service.process(claim.id);
    repo.review(claim.id, {
      reviewerId: 'tester',
      action: 'ACCEPT',
      fieldName: 'claimant.fullName',
      reason: 'Checked original',
    });
    const replaced = repo.addDocument(
      claim.id,
      input,
      source('doc-replacement', claim.id),
      'doc-a',
    )!;
    expect(replaced.status).toBe('DRAFT');
    expect(replaced.fields).toEqual([]);
    expect(replaced.issues).toEqual([]);
    expect(replaced.reviews).toHaveLength(1);
    expect(replaced.supersededDocuments?.[0]?.id).toBe('doc-a');
    expect(replaced.documents.map((doc) => doc.id)).toEqual(['doc-replacement']);
    expect(replaced.auditEvents.at(-1)?.action).toBe('DOCUMENT_REPLACED_OUTPUT_INVALIDATED');
  });
  it('rejects a late result after an interrupted run is recovered', async () => {
    const { repo, claim, storage, provider } = await setup();
    let release!: () => void;
    let entered!: () => void;
    const enteredPromise = new Promise<void>((resolve) => {
      entered = resolve;
    });
    provider.generate = async () => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { text: JSON.stringify(output('doc-a')), finishReason: 'STOP' };
    };
    const service = new ExtractionService(repo, storage, provider);
    const work = service.process(claim.id);
    await enteredPromise;
    repo.update(claim.id, (current) => ({
      ...current,
      processingStartedAt: new Date(Date.now() - 121000).toISOString(),
    }));
    await service.recover(claim.id);
    release();
    await expect(work).rejects.toMatchObject({ code: 'STALE_PROCESSING' });
    expect(repo.get(claim.id)?.fields).toEqual([]);
  });
  it('rejects PDF page budgets before calling the model', async () => {
    const { repo, claim, storage, provider, generate } = await setup();
    const pdf = await PDFDocument.create();
    for (let index = 0; index < 6; index++) pdf.addPage();
    const bytes = Buffer.from(await pdf.save());
    storage.read = async () => bytes;
    const result = await new ExtractionService(repo, storage, provider).process(claim.id);
    expect(result?.issues[0]?.message).toContain('PAGE_BUDGET');
    expect(generate).not.toHaveBeenCalled();
  });
  it('routes unreadable documents to input without inventing fields', async () => {
    const { service, claim } = await setup(
      JSON.stringify({
        fields: [],
        missingFields: ['incident.date'],
        quality: { usable: false, notes: ['Unreadable'] },
      }),
    );
    const result = (await service.process(claim.id))!;
    expect(result.status).toBe('NEEDS_INPUT');
    expect(result.fields).toHaveLength(0);
    expect(result.issues.some((issue) => issue.type === 'DOCUMENT_QUALITY')).toBe(true);
  });
});
describe('deterministic rules and human corrections', () => {
  async function extracted(): Promise<ClaimCase> {
    const { service, claim } = await setup();
    return (await service.process(claim.id))!;
  }
  it('detects invalid/future dates after correction; acceptance cannot bypass rules', async () => {
    let claim = await extracted();
    for (const date of ['2026-02-30', '2999-01-01']) {
      claim = applyHumanReview(claim, {
        reviewerId: 'tester',
        action: 'CORRECT',
        fieldName: 'incident.date',
        correctedValue: date,
        reason: 'Test correction',
      });
      expect(
        claim.issues.some(
          (issue) => issue.status === 'OPEN' && issue.fieldNames.includes('incident.date'),
        ),
      ).toBe(true);
      expect(claim.status).not.toBe('READY');
    }
    claim = applyHumanReview(claim, {
      reviewerId: 'tester',
      action: 'CORRECT',
      fieldName: 'incident.date',
      correctedValue: '2026-09-10',
      reason: 'Checked date',
    });
    expect(
      claim.issues.filter(
        (issue) => issue.status === 'OPEN' && issue.fieldNames.includes('incident.date'),
      ),
    ).toEqual([]);
    expect(claim.reviews.at(-1)?.previousValue).toBe('2999-01-01');
  });
  it('detects cross-document contradictions and requires correction rather than acceptance', async () => {
    let claim = await extracted();
    claim.documents.push(source('doc-b', claim.id));
    claim.documents[1]!.quality.usable = true;
    const result = output('doc-a');
    result.fields.push({
      name: 'vehicle.registration',
      value: 'ABC-123',
      confidence: 0.99,
      evidence: [{ documentId: 'doc-a', page: 1, excerpt: 'ABC-123' }],
      uncertaintyReasons: [],
    });
    result.fields.push({
      name: 'vehicle.registration',
      value: 'XYZ-789',
      confidence: 0.99,
      evidence: [{ documentId: 'doc-b', page: 1, excerpt: 'XYZ-789' }],
      uncertaintyReasons: [],
    });
    claim.fields = materialize(
      parseExtraction(
        JSON.stringify(result),
        new Map([
          ['doc-a', 1],
          ['doc-b', 1],
        ]),
      ),
    );
    claim.issues = validateFields(claim);
    expect(claim.issues.some((issue) => issue.type === 'CONTRADICTION')).toBe(true);
    claim = applyHumanReview(claim, {
      reviewerId: 'tester',
      action: 'ACCEPT',
      fieldName: 'vehicle.registration',
      reason: 'Accepted',
    });
    expect(
      claim.issues.some((issue) => issue.type === 'CONTRADICTION' && issue.status === 'OPEN'),
    ).toBe(true);
    claim = applyHumanReview(claim, {
      reviewerId: 'tester',
      action: 'CORRECT',
      fieldName: 'vehicle.registration',
      correctedValue: 'ABC-123',
      reason: 'Verified the registration photo; other form has a typo',
    });
    expect(
      claim.issues.some((issue) => issue.type === 'CONTRADICTION' && issue.status === 'OPEN'),
    ).toBe(false);
  });
  it('allows a missing field only with evidence in this case, and never treats rejection as READY', async () => {
    let claim = await extracted();
    claim.fields = claim.fields.filter((field) => field.name !== 'incident.address');
    const correction = {
      reviewerId: 'tester',
      action: 'CORRECT' as const,
      fieldName: 'incident.address' as ClaimFieldName,
      correctedValue: '12 Synthetic Street',
      reason: 'Read from source',
    };
    expect(() => applyHumanReview(claim, correction)).toThrow();
    expect(() =>
      applyHumanReview(claim, {
        ...correction,
        evidence: { documentId: 'foreign', page: 1, excerpt: 'Address' },
      }),
    ).toThrow();
    claim = applyHumanReview(claim, {
      ...correction,
      evidence: { documentId: 'doc-a', page: 1, excerpt: '12 Synthetic Street' },
    });
    expect(claim.fields.find((field) => field.name === 'incident.address')?.status).toBe(
      'CORRECTED',
    );
    claim = applyHumanReview(claim, {
      reviewerId: 'tester',
      action: 'REJECT',
      fieldName: 'incident.date',
      reason: 'Not supported',
    });
    expect(claim.status).toBe('NEEDS_INPUT');
  });
});
