import type { Firestore } from '@google-cloud/firestore';
import {
  ClaimCaseSchema,
  type ClaimCase,
  type SourceDocument,
  type AddDocumentInput,
  type CreateCaseInput,
  type ReviewCaseInput,
} from '@claimflow/domain';
import { InMemoryCaseRepository } from './caseRepository.js';

import { ApiError } from './errors.js';
export { ApiError } from './errors.js';

type MaybePromise<T> = T | Promise<T>;
export interface CaseRepository {
  update(id: string, change: (claim: ClaimCase) => ClaimCase): MaybePromise<ClaimCase | undefined>;
  list(): MaybePromise<ClaimCase[]>;
  findConversation(conversationId: string): MaybePromise<ClaimCase | undefined>;
  get(id: string): MaybePromise<ClaimCase | undefined>;
  create(input: CreateCaseInput): MaybePromise<ClaimCase>;
  addDocument(
    id: string,
    input: AddDocumentInput,
    stored?: SourceDocument,
    replaceId?: string,
  ): MaybePromise<ClaimCase | undefined>;
  process(id: string): MaybePromise<ClaimCase | 'NO_DOCUMENTS' | undefined>;
  review(id: string, input: ReviewCaseInput): MaybePromise<ClaimCase | undefined>;
}

// Case metadata and audit history commit together. File bytes never enter Firestore.
export function encodeCase(claim: ClaimCase) {
  const payload = JSON.stringify(ClaimCaseSchema.parse(claim));
  if (Buffer.byteLength(payload) > 700_000) {
    throw new ApiError(
      409,
      'CASE_CAPACITY_REACHED',
      'This demo case has reached its history limit. Create a new case.',
    );
  }
  return {
    payload,
    updatedAt: claim.updatedAt,
    conversationIds: (claim.clarifications ?? []).flatMap((item) =>
      item.externalConversationId ? [item.externalConversationId] : [],
    ),
  };
}
const decodeCase = (data: { payload?: unknown } | undefined) => {
  if (!data) return undefined;
  if (typeof data.payload !== 'string') throw new Error('Invalid persisted case');
  return ClaimCaseSchema.parse(JSON.parse(data.payload));
};

export class FirestoreCaseRepository implements CaseRepository {
  constructor(private readonly db: Firestore) {}
  async list() {
    const snapshot = await this.db
      .collection('cases')
      .orderBy('updatedAt', 'desc')
      .limit(100)
      .get();
    return snapshot.docs.map((doc) => decodeCase(doc.data())!);
  }
  async findConversation(conversationId: string) {
    const snapshot = await this.db
      .collection('cases')
      .where('conversationIds', 'array-contains', conversationId)
      .limit(2)
      .get();
    return snapshot.size === 1 ? decodeCase(snapshot.docs[0]!.data()) : undefined;
  }
  async get(id: string) {
    return decodeCase((await this.db.collection('cases').doc(id).get()).data());
  }
  async create(input: CreateCaseInput) {
    const claim = new InMemoryCaseRepository([]).create(input);
    await this.db.collection('cases').doc(claim.id).create(encodeCase(claim));
    return claim;
  }
  private async mutate<T extends ClaimCase | 'NO_DOCUMENTS' | undefined>(
    id: string,
    action: (workflow: InMemoryCaseRepository) => T,
  ): Promise<T | undefined> {
    const ref = this.db.collection('cases').doc(id);
    return this.db.runTransaction(async (transaction) => {
      const claim = decodeCase((await transaction.get(ref)).data());
      if (!claim) return undefined;
      // Callback may retry: no uploads, network calls or model calls inside it.
      const result = action(new InMemoryCaseRepository([claim]));
      if (result && result !== 'NO_DOCUMENTS') transaction.set(ref, encodeCase(result));
      return result;
    });
  }
  update(id: string, change: (claim: ClaimCase) => ClaimCase) {
    return this.mutate(id, (workflow) => workflow.update(id, change));
  }
  addDocument(id: string, input: AddDocumentInput, stored?: SourceDocument, replaceId?: string) {
    return this.mutate(id, (workflow) => workflow.addDocument(id, input, stored, replaceId));
  }
  process(id: string) {
    return this.mutate(id, (workflow) => workflow.process(id));
  }
  review(id: string, input: ReviewCaseInput) {
    return this.mutate(id, (workflow) => workflow.review(id, input));
  }
}
