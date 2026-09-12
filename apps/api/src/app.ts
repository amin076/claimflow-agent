import cors from '@fastify/cors';
import { createDemoCase } from '@claimflow/domain';
import Fastify from 'fastify';

export const buildApp = async () => {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok', service: 'claimflow-api' }));
  app.get('/api/cases/demo', async () => createDemoCase());

  return app;
};
