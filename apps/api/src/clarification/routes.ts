import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { IdentifierSchema } from '@claimflow/domain';
import type { Runtime } from '../runtime.js';
import { ApiError } from '../errors.js';
import { ClarificationService } from './service.js';
import { ElevenLabsVoiceProvider } from './provider.js';
import { receiveWebhook } from './webhook.js';

export function authorizeVoice(request: FastifyRequest, runtime: Runtime) {
  const expected = runtime.environment.CLARIFICATION_REVIEW_TOKEN;
  const actual = request.headers['x-clarification-token'];
  if (!expected)
    throw new ApiError(
      503,
      'CLARIFICATION_DISABLED',
      'Configure the reviewer key before using voice clarification.',
    );
  if (
    typeof actual !== 'string' ||
    Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    throw new ApiError(401, 'REVIEWER_KEY_REQUIRED', 'Enter the voice reviewer key.');
}
export async function clarificationRoutes(app: FastifyInstance, runtime: Runtime) {
  const service = new ClarificationService(
    runtime.cases,
    runtime.voiceProvider ?? new ElevenLabsVoiceProvider(runtime.environment),
    runtime.environment,
  );
  type Params = { id: string; clarificationId: string };
  const idSchema = IdentifierSchema.regex(/^[a-zA-Z0-9_-]+$/);
  app.post<{ Params: { id: string } }>('/api/cases/:id/clarifications', async (request) => {
    authorizeVoice(request, runtime);
    return service.create(idSchema.parse(request.params.id), request.body);
  });
  for (const action of ['approve', 'call', 'cancel'] as const)
    app.post<{ Params: Params }>(
      `/api/cases/:id/clarifications/:clarificationId/${action}`,
      async (request) => {
        authorizeVoice(request, runtime);
        const id = idSchema.parse(request.params.id);
        const clarificationId = idSchema.parse(request.params.clarificationId);
        return action === 'approve'
          ? service.approve(id, clarificationId, request.body)
          : service[action](id, clarificationId);
      },
    );
  await app.register(async (scope) => {
    scope.removeContentTypeParser('application/json');
    scope.addContentTypeParser(
      'application/json',
      { parseAs: 'string', bodyLimit: 1_000_000 },
      (_request, body, done) => done(null, body),
    );
    scope.post('/api/webhooks/elevenlabs', async (request) =>
      receiveWebhook(
        request.body as string,
        request.headers['elevenlabs-signature'],
        runtime.environment,
        runtime.cases,
      ),
    );
  });
}
