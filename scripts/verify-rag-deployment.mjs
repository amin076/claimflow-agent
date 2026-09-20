const serviceUrl = process.env.SERVICE_URL;
const token = process.env.RAG_INTERNAL_TOKEN;

if (!serviceUrl || !token) {
  throw new Error('SERVICE_URL and RAG_INTERNAL_TOKEN are required.');
}

async function query(question, topK = 2) {
  const response = await fetch(serviceUrl.replace(/\/$/, '') + '/api/lab/rag/query', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + token,
    },
    body: JSON.stringify({ question, topK }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error('RAG_DEPLOYMENT_REQUEST_FAILED: HTTP ' + response.status + ' ' + text);
  }
  return JSON.parse(text);
}

const grounded = await query(
  'Have we handled previous claims where rain entered through a damaged roof?',
);

if (grounded.matches?.[0]?.claim_id !== '1004' || grounded.matches?.[1]?.claim_id !== '1001') {
  throw new Error('RAG_DEPLOYMENT_RANKING_FAILED');
}

if (!grounded.answer?.text?.trim()) {
  throw new Error('RAG_DEPLOYMENT_GEMINI_EMPTY');
}

const insufficient = await query('What was the total repair cost?');
const expected = 'There is not enough evidence to answer the question.';

if (insufficient.answer?.text?.trim() !== expected) {
  throw new Error(
    'RAG_DEPLOYMENT_GROUNDING_FAILED: ' + JSON.stringify(insufficient.answer?.text ?? null),
  );
}

console.log(
  JSON.stringify(
    {
      status: 'PASS',
      mode: 'DEPLOYED_RAG_WITH_VERTEX',
      ragModel: grounded.ragModel,
      geminiModel: grounded.geminiModel,
      grounded: {
        matches: grounded.matches.map((match) => ({
          claimId: match.claim_id,
          score: match.score,
        })),
        answer: grounded.answer,
      },
      insufficientEvidence: insufficient.answer,
    },
    null,
    2,
  ),
);
