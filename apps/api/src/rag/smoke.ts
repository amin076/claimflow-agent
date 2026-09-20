import { readEnvironment } from '@claimflow/config';
import { retrieveEvidence } from './client.js';
import { buildGroundedPrompt, VertexRagGenerator } from './generator.js';

const args = process.argv.slice(2);
const retrievalOnly = args.includes('--retrieval-only');
const question =
  args
    .filter((argument) => argument !== '--retrieval-only')
    .join(' ')
    .trim() || 'Have we handled previous claims where rain entered through a damaged roof?';

const ragServiceUrl = process.env.RAG_SERVICE_URL ?? 'http://127.0.0.1:8090';
const topK = Number.parseInt(process.env.RAG_TOP_K ?? '2', 10);

if (!Number.isInteger(topK) || topK < 1 || topK > 10) {
  throw new Error('RAG_TOP_K must be an integer between 1 and 10.');
}

const controller = new AbortController();
const timeoutMs = Number.parseInt(process.env.RAG_SMOKE_TIMEOUT_MS ?? '45000', 10);
const timer = setTimeout(() => controller.abort(), timeoutMs);

try {
  const retrieval = await retrieveEvidence({
    baseUrl: ragServiceUrl,
    question,
    topK,
    signal: controller.signal,
  });

  if (retrievalOnly) {
    console.log(
      JSON.stringify(
        {
          status: 'PASS',
          mode: 'RETRIEVAL_ONLY',
          ragModel: retrieval.model,
          question,
          matches: retrieval.matches,
          promptPreview: buildGroundedPrompt(question, retrieval.matches),
        },
        null,
        2,
      ),
    );
  } else {
    const environment = readEnvironment();
    const generator = new VertexRagGenerator(environment);
    const answer = await generator.generate(question, retrieval.matches, controller.signal);

    console.log(
      JSON.stringify(
        {
          status: 'PASS',
          mode: 'RAG_WITH_VERTEX',
          ragModel: retrieval.model,
          geminiModel: generator.model,
          question,
          matches: retrieval.matches,
          answer,
        },
        null,
        2,
      ),
    );
  }
} finally {
  clearTimeout(timer);
}
