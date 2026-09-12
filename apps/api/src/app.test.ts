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

  it('completes the local case, document, process, review, and audit workflow', async () => {
    const app = await buildApp();
    apps.push(app);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/cases',
      payload: { title: 'Synthetic local workflow' },
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created.status).toBe('DRAFT');

    const documentResponse = await app.inject({
      method: 'POST',
      url: `/api/cases/${created.id}/documents`,
      payload: {
        filename: 'synthetic-claim-form.jpg',
        mimeType: 'image/jpeg',
        type: 'CLAIM_FORM',
      },
    });
    expect(documentResponse.statusCode).toBe(201);
    expect(documentResponse.json().documents).toHaveLength(1);

    const processResponse = await app.inject({
      method: 'POST',
      url: `/api/cases/${created.id}/process`,
    });
    expect(processResponse.statusCode).toBe(200);
    const processed = processResponse.json();
    expect(processed.status).toBe('NEEDS_REVIEW');
    expect(processed.fields).toHaveLength(3);
    expect(processed.issues).toHaveLength(2);
    expect(processed.agentRuns).toHaveLength(2);

    const reviewResponse = await app.inject({
      method: 'PATCH',
      url: `/api/cases/${created.id}/review`,
      payload: {
        reviewerId: 'local-reviewer',
        action: 'CORRECT',
        fieldName: 'incident.date',
        correctedValue: '2026-09-06',
        reason: 'Confirmed against the clearer synthetic source.',
      },
    });
    expect(reviewResponse.statusCode).toBe(200);
    const reviewed = reviewResponse.json();
    expect(reviewed.reviews).toHaveLength(1);
    expect(
      reviewed.fields.find((field: { name: string }) => field.name === 'incident.date'),
    ).toMatchObject({
      value: '2026-09-06',
      status: 'CORRECTED',
      requiresReview: false,
    });

    const auditResponse = await app.inject({
      method: 'GET',
      url: `/api/cases/${created.id}/audit-events`,
    });
    expect(auditResponse.statusCode).toBe(200);
    expect(auditResponse.json()).toHaveLength(4);

    const listResponse = await app.inject({ method: 'GET', url: '/api/cases' });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toHaveLength(2);
  });

  it('requires a document before processing a new case', async () => {
    const app = await buildApp();
    apps.push(app);
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/cases',
      payload: { title: 'No documents yet' },
    });
    const response = await app.inject({
      method: 'POST',
      url: `/api/cases/${createResponse.json().id}/process`,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('DOCUMENT_COUNT');
  });

  it('returns validation and not-found errors without exposing internals', async () => {
    const app = await buildApp();
    apps.push(app);

    const invalidResponse = await app.inject({
      method: 'POST',
      url: '/api/cases',
      payload: { title: '' },
    });
    expect(invalidResponse.statusCode).toBe(400);
    expect(invalidResponse.json().error).toBe('VALIDATION_ERROR');

    const missingResponse = await app.inject({ method: 'GET', url: '/api/cases/missing' });
    expect(missingResponse.statusCode).toBe(404);
    expect(missingResponse.json()).toEqual({ error: 'CASE_NOT_FOUND' });
  });
});
