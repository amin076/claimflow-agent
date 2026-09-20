import type { FastifyInstance, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Runtime } from '../runtime.js';
import { retrieveEvidence } from './client.js';
import { VertexRagGenerator } from './generator.js';

const RagQuerySchema = z.object({
  question: z.string().trim().min(1).max(5000),
  topK: z.number().int().min(1).max(10).default(2),
});

function secureEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function authorize(request: FastifyRequest, token: string): void {
  const expected = 'Bearer ' + token;
  if (!request.headers.authorization || !secureEqual(request.headers.authorization, expected)) {
    const error = new Error('Unauthorized RAG lab request.') as Error & { statusCode: number };
    error.statusCode = 401;
    throw error;
  }
}

export async function ragLabRoutes(app: FastifyInstance, runtime: Runtime): Promise<void> {
  const environment = runtime.environment;

  app.post('/api/lab/rag/query', async (request, reply) => {
    if (!environment.RAG_SERVICE_URL || !environment.RAG_INTERNAL_TOKEN) {
      return reply.status(503).send({
        error: 'RAG_LAB_UNAVAILABLE',
        message: 'The RAG lab service is not configured.',
      });
    }

    authorize(request, environment.RAG_INTERNAL_TOKEN);
    const input = RagQuerySchema.parse(request.body);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), environment.AI_TIMEOUT_MS);

    try {
      const retrieval = await retrieveEvidence({
        baseUrl: environment.RAG_SERVICE_URL,
        token: environment.RAG_INTERNAL_TOKEN,
        question: input.question,
        topK: input.topK,
        signal: controller.signal,
      });
      const generator = new VertexRagGenerator(environment);
      const answer = await generator.generate(input.question, retrieval.matches, controller.signal);

      return {
        status: 'ok',
        question: input.question,
        ragModel: retrieval.model,
        geminiModel: generator.model,
        matches: retrieval.matches,
        answer,
      };
    } finally {
      clearTimeout(timer);
    }
  });
}
