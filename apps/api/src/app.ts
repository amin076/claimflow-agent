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
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { SourceDocumentSchema, DocumentTypeSchema } from '@claimflow/domain';
import { ApiError } from './persistence.js';
import { createRuntime, type Runtime } from './runtime.js';
import { documentKey, MAX_UPLOAD_BYTES, validateDocument } from './documentStorage.js';

export const buildApp = async (runtime: Runtime = createRuntime()) => {
  const app = Fastify({ logger: true });
  const { cases, documents, environment } = runtime;

  await app.register(cors, { origin: environment.WEB_ORIGIN });
  await app.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0, parts: 1 },
  });
  app.addHook('onClose', () => runtime.close());

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'The request body is invalid.',
        issues: error.issues,
      });
    }
    if (error instanceof ApiError)
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply
        .status(statusCode)
        .send({ error: 'INVALID_REQUEST', message: 'Invalid or oversized request.' });
    }
    app.log.error(error);
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Unexpected server error.' });
  });

  app.get('/health', async () => ({ status: 'ok', service: 'claimflow-api' }));
  app.get('/api/cases/demo', async () => createDemoCase());

  app.post('/api/cases', async (request, reply) => {
    const input = CreateCaseInputSchema.parse(request.body);
    return reply.status(201).send(await cases.create(input));
  });

  app.get('/api/cases', async () => cases.list());

  app.get<{ Params: { id: string } }>('/api/cases/:id', async (request, reply) => {
    const id = IdentifierSchema.regex(/^[a-zA-Z0-9_-]+$/).parse(request.params.id);
    const claim = await cases.get(id);
    return claim ?? reply.status(404).send({ error: 'CASE_NOT_FOUND' });
  });

  app.post<{ Params: { id: string } }>('/api/cases/:id/documents', async (request, reply) => {
    const id = IdentifierSchema.regex(/^[a-zA-Z0-9_-]+$/).parse(request.params.id);
    if (environment.STORAGE_MODE === 'gcs')
      throw new ApiError(409, 'UPLOAD_REQUIRED', 'Upload the actual synthetic file in cloud mode.');
    const input = AddDocumentInputSchema.parse(request.body);
    const claim = await cases.addDocument(id, input);
    return claim
      ? reply.status(201).send(claim)
      : reply.status(404).send({ error: 'CASE_NOT_FOUND' });
  });

  app.post<{ Params: { id: string } }>('/api/cases/:id/process', async (request, reply) => {
    const id = IdentifierSchema.regex(/^[a-zA-Z0-9_-]+$/).parse(request.params.id);
    const result = await cases.process(id);
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
    const id = IdentifierSchema.regex(/^[a-zA-Z0-9_-]+$/).parse(request.params.id);
    const input = ReviewCaseInputSchema.parse(request.body);
    const claim = await cases.review(id, input);
    return claim ?? reply.status(404).send({ error: 'CASE_NOT_FOUND' });
  });

  app.get<{ Params: { id: string } }>('/api/cases/:id/audit-events', async (request, reply) => {
    const id = IdentifierSchema.regex(/^[a-zA-Z0-9_-]+$/).parse(request.params.id);
    const claim = await cases.get(id);
    return claim?.auditEvents ?? reply.status(404).send({ error: 'CASE_NOT_FOUND' });
  });

  app.get('/ready', async (_request, reply) => {
    try {
      await runtime.ready();
      return { status: 'ready' };
    } catch (error) {
      app.log.error(error);
      return reply.status(503).send({ status: 'unavailable' });
    }
  });
  app.post<{ Params: { id: string }; Querystring: { type?: string } }>(
    '/api/cases/:id/uploads',
    async (request, reply) => {
      const id = IdentifierSchema.regex(/^[a-zA-Z0-9_-]+$/).parse(request.params.id);
      const type = DocumentTypeSchema.parse(request.query.type);
      const claim = await cases.get(id);
      if (!claim) return reply.status(404).send({ error: 'CASE_NOT_FOUND' });
      if (claim.status !== 'DRAFT')
        throw new ApiError(409, 'CASE_NOT_DRAFT', 'Create a draft case for a new upload.');
      const file = await request.file();
      if (!file) throw new ApiError(400, 'FILE_REQUIRED', 'Select one synthetic file.');
      const bytes = await file.toBuffer();
      validateDocument(bytes, file.mimetype);
      const filename = z
        .string()
        .min(1)
        .max(255)
        .refine(
          (name) =>
            ![...name].some((char) => char.charCodeAt(0) < 32 || char === '/' || char === '\\'),
        )
        .parse(file.filename);
      const docId = `doc-${randomUUID()}`;
      const key = documentKey(id, docId);
      const storageUri = await documents.put(key, bytes, file.mimetype);
      const document = SourceDocumentSchema.parse({
        id: docId,
        caseId: id,
        filename,
        mimeType: file.mimetype,
        type,
        storageUri,
        uploadedAt: new Date().toISOString(),
        quality: {
          score: 0,
          usable: false,
          issues: [],
          notes: ['Not yet assessed; mock processing does not inspect file content.'],
        },
      });
      try {
        const result = await cases.addDocument(
          id,
          { filename, mimeType: file.mimetype, type },
          document,
        );
        if (!result) throw new ApiError(404, 'CASE_NOT_FOUND', 'Case no longer exists.');
        return reply.status(201).send(result);
      } catch (error) {
        // Do not delete on an ambiguous Firestore failure: the transaction may have committed.
        app.log.error({ key }, 'Upload requires reconciliation after metadata failure');
        throw error;
      }
    },
  );
  app.get<{ Params: { id: string; documentId: string } }>(
    '/api/cases/:id/documents/:documentId/content',
    async (request, reply) => {
      const id = IdentifierSchema.regex(/^[a-zA-Z0-9_-]+$/).parse(request.params.id);
      const documentId = IdentifierSchema.regex(/^[a-zA-Z0-9_-]+$/).parse(
        request.params.documentId,
      );
      const claim = await cases.get(id);
      const document = claim?.documents.find((candidate) => candidate.id === documentId);
      const key = documentKey(id, documentId);
      if (!document || !document.storageUri.endsWith(key))
        return reply.status(404).send({ error: 'FILE_NOT_FOUND' });
      try {
        const bytes = await documents.read(key);
        return reply
          .header('Cache-Control', 'private, no-store')
          .header('X-Content-Type-Options', 'nosniff')
          .header('Content-Disposition', `attachment; filename="synthetic-document"`)
          .type(document.mimeType)
          .send(bytes);
      } catch (error) {
        if (
          (error as { code?: unknown }).code === 404 ||
          (error as { code?: unknown }).code === 'ENOENT'
        )
          return reply.status(404).send({ error: 'FILE_NOT_FOUND' });
        throw error;
      }
    },
  );
  if (environment.SERVE_WEB === 'true') {
    await app.register(fastifyStatic, {
      root: fileURLToPath(new URL('../../web/dist/', import.meta.url)),
    });
    app.setNotFoundHandler((request, reply) => {
      if (
        request.method !== 'GET' ||
        request.url.startsWith('/api/') ||
        request.url.startsWith('/assets/')
      )
        return reply.status(404).send({ error: 'NOT_FOUND' });
      return reply.sendFile('index.html');
    });
  }
  return app;
};
