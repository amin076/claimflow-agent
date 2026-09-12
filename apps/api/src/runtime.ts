import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { readEnvironment, type Environment } from '@claimflow/config';
import { InMemoryCaseRepository } from './caseRepository.js';
import { FirestoreCaseRepository, type CaseRepository } from './persistence.js';
import {
  GcsDocumentStorage,
  LocalDocumentStorage,
  type DocumentStorage,
} from './documentStorage.js';

export interface Runtime {
  environment: Environment;
  cases: CaseRepository;
  documents: DocumentStorage;
  ready(): Promise<void>;
  close(): Promise<void>;
}
export function createRuntime(environment = readEnvironment()): Runtime {
  const db =
    environment.DATABASE_MODE === 'firestore'
      ? new Firestore({
          projectId: environment.GOOGLE_CLOUD_PROJECT!,
          databaseId: environment.FIRESTORE_DATABASE_ID,
        })
      : undefined;
  const storage =
    environment.STORAGE_MODE === 'gcs'
      ? new Storage({ projectId: environment.GOOGLE_CLOUD_PROJECT! })
      : undefined;
  return {
    environment,
    cases: db ? new FirestoreCaseRepository(db) : new InMemoryCaseRepository(),
    documents: storage
      ? new GcsDocumentStorage(storage, environment.DOCUMENT_BUCKET!)
      : new LocalDocumentStorage(environment.UPLOAD_DIR),
    async ready() {
      if (db) await db.collection('cases').limit(1).get();
      if (storage) await storage.bucket(environment.DOCUMENT_BUCKET!).getFiles({ maxResults: 1 });
    },
    async close() {
      if (db) await db.terminate();
    },
  };
}
