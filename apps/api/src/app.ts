import cors from '@fastify/cors';
import {
  AddDocumentInputSchema,
  CreateCaseInputSchema,
  IdentifierSchema,
  ReviewCaseInputSchema,
  createDemoCase,
} from '@claimflow/domain';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { InMemoryCaseRepository } from './caseRepository.js';

export const buildApp = async () => {
  const app = Fastify({ logger: true });
  const cases = new InMemoryCaseRepository();

  await app.register(cors, { origin: true });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'The request body is invalid.',
        issues: error.issues,
      });
    }
    app.log.error(error);
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Unexpected server error.' });
  });

  app.get('/health', async () => ({ status: 'ok', service: 'claimflow-api' }));
  app.get('/api/cases/demo', async () => createDemoCase());

  app.post('/api/cases', async (request, reply) => {
    const input = CreateCaseInputSchema.parse(request.body);
    return reply.status(201).send(cases.create(input));
  });

  app.get('/api/cases', async () => cases.list());

  app.get<{ Params: { id: string } }>('/api/cases/:id', async (request, reply) => {
    const id = IdentifierSchema.parse(request.params.id);
    const claim = cases.get(id);
    return claim ?? reply.status(404).send({ error: 'CASE_NOT_FOUND' });
  });

  app.post<{ Params: { id: string } }>('/api/cases/:id/documents', async (request, reply) => {
    const id = IdentifierSchema.parse(request.params.id);
    const input = AddDocumentInputSchema.parse(request.body);
    const claim = cases.addDocument(id, input);
    return claim
      ? reply.status(201).send(claim)
      : reply.status(404).send({ error: 'CASE_NOT_FOUND' });
  });

  app.post<{ Params: { id: string } }>('/api/cases/:id/process', async (request, reply) => {
    const id = IdentifierSchema.parse(request.params.id);
    const result = cases.process(id);
    if (!result) return reply.status(404).send({ error: 'CASE_NOT_FOUND' });
    if (result === 'NO_DOCUMENTS') {
      return reply.status(409).send({
        error: 'CASE_HAS_NO_DOCUMENTS',
        message: 'Add a synthetic document before processing the case.',
      });
    }
    return result;
  });

  app.patch<{ Params: { id: string } }>('/api/cases/:id/review', async (request, reply) => {
    const id = IdentifierSchema.parse(request.params.id);
    const input = ReviewCaseInputSchema.parse(request.body);
    const claim = cases.review(id, input);
    return claim ?? reply.status(404).send({ error: 'CASE_NOT_FOUND' });
  });

  app.get<{ Params: { id: string } }>('/api/cases/:id/audit-events', async (request, reply) => {
    const id = IdentifierSchema.parse(request.params.id);
    const claim = cases.get(id);
    return claim?.auditEvents ?? reply.status(404).send({ error: 'CASE_NOT_FOUND' });
  });

  return app;
};
