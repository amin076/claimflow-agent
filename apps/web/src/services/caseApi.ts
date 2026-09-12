import {
  ClaimCaseSchema,
  type AddDocumentInput,
  type ClaimCase,
  type CreateCaseInput,
  type ReviewCaseInput,
} from '@claimflow/domain';

const request = async (path: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(path, init);
  const body = (await response.json()) as { message?: unknown; error?: unknown };
  if (!response.ok) {
    const message =
      typeof body.message === 'string'
        ? body.message
        : typeof body.error === 'string'
          ? body.error
          : `API returned ${response.status}`;
    throw new Error(message);
  }
  return body;
};

const jsonRequest = (method: string, body?: unknown): RequestInit =>
  body === undefined
    ? { method }
    : {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      };

export const caseApi = {
  async list(): Promise<ClaimCase[]> {
    const body = await request('/api/cases');
    if (!Array.isArray(body)) throw new Error('The API returned an invalid case list.');
    return body.map((claim) => ClaimCaseSchema.parse(claim));
  },
  async create(input: CreateCaseInput): Promise<ClaimCase> {
    return ClaimCaseSchema.parse(await request('/api/cases', jsonRequest('POST', input)));
  },
  async addDocument(id: string, input: AddDocumentInput): Promise<ClaimCase> {
    return ClaimCaseSchema.parse(
      await request(`/api/cases/${encodeURIComponent(id)}/documents`, jsonRequest('POST', input)),
    );
  },
  async process(id: string): Promise<ClaimCase> {
    return ClaimCaseSchema.parse(
      await request(`/api/cases/${encodeURIComponent(id)}/process`, jsonRequest('POST')),
    );
  },
  async review(id: string, input: ReviewCaseInput): Promise<ClaimCase> {
    return ClaimCaseSchema.parse(
      await request(`/api/cases/${encodeURIComponent(id)}/review`, jsonRequest('PATCH', input)),
    );
  },
};
