import { z } from 'zod';
import {
  ClaimCaseSchema,
  type AddDocumentInput,
  type ClaimCase,
  type CreateCaseInput,
  type DocumentType,
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

const RuntimeInfoSchema = z.object({
  aiMode: z.enum(['mock', 'vertex']),
  model: z.string(),
  workflow: z.string(),
  maxDocuments: z.number(),
  maxTotalPages: z.number(),
});
export type RuntimeInfo = z.infer<typeof RuntimeInfoSchema>;
export const caseApi = {
  async get(id: string): Promise<ClaimCase> {
    return ClaimCaseSchema.parse(await request(`/api/cases/${encodeURIComponent(id)}`));
  },
  async clarification(
    id: string,
    action: string,
    body: unknown,
    token: string,
  ): Promise<ClaimCase> {
    return ClaimCaseSchema.parse(
      await request(
        `/api/cases/${encodeURIComponent(id)}/clarifications${action ? '/' + action.split('/').map(encodeURIComponent).join('/') : ''}`,
        {
          ...jsonRequest('POST', body),
          headers: { 'Content-Type': 'application/json', 'x-clarification-token': token },
        },
      ),
    );
  },
  async config(): Promise<RuntimeInfo> {
    return RuntimeInfoSchema.parse(await request('/api/config'));
  },
  async recover(id: string): Promise<ClaimCase> {
    return ClaimCaseSchema.parse(
      await request(`/api/cases/${encodeURIComponent(id)}/recover-processing`, jsonRequest('POST')),
    );
  },
  async upload(id: string, file: File, type: DocumentType, replaceId?: string): Promise<ClaimCase> {
    const body = new FormData();
    body.append('file', file);
    return ClaimCaseSchema.parse(
      await request(
        `/api/cases/${encodeURIComponent(id)}/uploads?type=${encodeURIComponent(type)}${replaceId ? `&replaceId=${encodeURIComponent(replaceId)}` : ''}`,
        { method: 'POST', body },
      ),
    );
  },
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
  async review(id: string, input: ReviewCaseInput, token?: string): Promise<ClaimCase> {
    return ClaimCaseSchema.parse(
      await request(`/api/cases/${encodeURIComponent(id)}/review`, {
        ...jsonRequest('PATCH', input),
        ...(token
          ? { headers: { 'Content-Type': 'application/json', 'x-clarification-token': token } }
          : {}),
      }),
    );
  },
};
