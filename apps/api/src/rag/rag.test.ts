import { describe, expect, it } from 'vitest';
import { retrieveEvidence, type RagMatch } from './client.js';
import { buildGroundedPrompt } from './generator.js';

describe('RAG lab', () => {
  it('validates the Python retrieval contract', async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          question: 'roof damage',
          model: 'test-encoder',
          matches: [
            {
              document_id: 'claim-1004',
              claim_id: '1004',
              score: 0.73,
              text: 'Heavy rain entered through damaged roof flashing.',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

    const result = await retrieveEvidence({
      baseUrl: 'http://rag.test',
      question: 'roof damage',
      topK: 1,
      fetchImpl: fakeFetch,
    });

    expect(result.matches[0]?.claim_id).toBe('1004');
  });

  it('builds a grounded prompt with an explicit insufficient-evidence rule', () => {
    const matches: RagMatch[] = [
      {
        document_id: 'claim-1004',
        claim_id: '1004',
        score: 0.73,
        text: 'Heavy rain entered through damaged roof flashing.',
      },
    ];

    const prompt = buildGroundedPrompt('What was the repair cost?', matches);

    expect(prompt).toContain('claimId=1004');
    expect(prompt).toContain(
      'Do not invent claim facts, costs, dates, decisions, or policy wording.',
    );
    expect(prompt).toContain('There is not enough evidence to answer the question.');
  });
});
