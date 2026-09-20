import { z } from 'zod';

const RagMatchSchema = z.object({
  document_id: z.string().min(1),
  claim_id: z.string().min(1),
  score: z.number(),
  text: z.string().min(1),
});

const RagRetrieveResponseSchema = z.object({
  question: z.string(),
  model: z.string().min(1),
  matches: z.array(RagMatchSchema),
});

export type RagMatch = z.infer<typeof RagMatchSchema>;
export type RagRetrieveResponse = z.infer<typeof RagRetrieveResponseSchema>;

export async function retrieveEvidence(input: {
  baseUrl: string;
  question: string;
  topK: number;
  token?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<RagRetrieveResponse> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = input.baseUrl.endsWith('/')
    ? input.baseUrl.slice(0, -1)
    : input.baseUrl;
  const response = await fetchImpl(baseUrl + '/retrieve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(input.token ? { Authorization: 'Bearer ' + input.token } : {}),
    },
    body: JSON.stringify({ question: input.question, top_k: input.topK }),
    ...(input.signal ? { signal: input.signal } : {}),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      'RAG_RETRIEVAL_FAILED: HTTP ' + response.status + (detail ? ' ' + detail : ''),
    );
  }

  return RagRetrieveResponseSchema.parse(await response.json());
}
