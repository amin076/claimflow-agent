import { readEnvironment } from '@claimflow/config';
import { retrieveEvidence } from './client.js';
import { VertexRagGenerator } from './generator.js';

const ragServiceUrl = process.env.RAG_SERVICE_URL ?? 'http://127.0.0.1:8090';
const environment = readEnvironment();
const generator = new VertexRagGenerator(environment);

async function runCase(question: string) {
  const retrieval = await retrieveEvidence({
    baseUrl: ragServiceUrl,
    question,
    topK: 2,
  });
  const answer = await generator.generate(question, retrieval.matches);
  return { retrieval, answer };
}

const groundedQuestion =
  'Have we handled previous claims where rain entered through a damaged roof?';
const grounded = await runCase(groundedQuestion);

if (
  grounded.retrieval.matches[0]?.claim_id !== '1004' ||
  grounded.retrieval.matches[1]?.claim_id !== '1001'
) {
  throw new Error('RAG_LIVE_ACCEPTANCE_FAILED: unexpected retrieval ranking.');
}

if (!grounded.answer.text.trim()) {
  throw new Error('RAG_LIVE_ACCEPTANCE_FAILED: Gemini returned an empty grounded answer.');
}

const insufficientQuestion = 'What was the total repair cost?';
const insufficient = await runCase(insufficientQuestion);
const expectedInsufficient = 'There is not enough evidence to answer the question.';

if (insufficient.answer.text.trim() !== expectedInsufficient) {
  throw new Error(
    `RAG_LIVE_ACCEPTANCE_FAILED: expected insufficient-evidence response, received: ${JSON.stringify(insufficient.answer.text.trim())}`,
  );
}

console.log(
  JSON.stringify(
    {
      status: 'PASS',
      mode: 'RAG_WITH_LIVE_VERTEX',
      ragModel: grounded.retrieval.model,
      geminiModel: generator.model,
      grounded: {
        question: groundedQuestion,
        matches: grounded.retrieval.matches.map((match) => ({
          claimId: match.claim_id,
          score: match.score,
        })),
        answer: grounded.answer,
      },
      insufficientEvidence: {
        question: insufficientQuestion,
        answer: insufficient.answer,
      },
    },
    null,
    2,
  ),
);
