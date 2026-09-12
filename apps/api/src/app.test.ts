import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('API', () => {
  it('reports health', async () => {
    const app = await buildApp();
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'claimflow-api' });
  });

  it('returns a typed synthetic demo case', async () => {
    const app = await buildApp();
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/api/cases/demo' });
    expect(response.statusCode).toBe(200);
    const claim = response.json();
    expect(claim.status).toBe('NEEDS_REVIEW');
    expect(claim.documents).toHaveLength(2);
    expect(claim.fields).toHaveLength(3);
    expect(claim.issues).toHaveLength(2);
  });
});
