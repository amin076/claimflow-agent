import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Storage } from '@google-cloud/storage';
import { ApiError } from './persistence.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export interface DocumentStorage {
  put(key: string, bytes: Buffer, mimeType: string): Promise<string>;
  read(key: string): Promise<Buffer>;
}
export const documentKey = (caseId: string, documentId: string) =>
  `cases/${caseId}/documents/${documentId}/original`;
export function validateDocument(bytes: Buffer, mimeType: string) {
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES)
    throw new ApiError(413, 'INVALID_FILE_SIZE', 'Upload a non-empty file of at most 5 MiB.');
  const valid =
    mimeType === 'application/pdf'
      ? bytes.subarray(0, 5).toString() === '%PDF-'
      : mimeType === 'image/png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mimeType === 'image/jpeg'
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : false;
  if (!valid)
    throw new ApiError(
      415,
      'UNSUPPORTED_FILE',
      'Choose a synthetic PDF, JPEG or PNG with matching file content.',
    );
}
export class LocalDocumentStorage implements DocumentStorage {
  constructor(private readonly root: string) {}
  private path(key: string) {
    const root = resolve(this.root);
    const path = resolve(root, key);
    if (!path.startsWith(root + sep)) throw new Error('Invalid storage key');
    return path;
  }
  async put(key: string, bytes: Buffer) {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes, { flag: 'wx' });
    return `local://${key}`;
  }
  read(key: string) {
    return readFile(this.path(key));
  }
}
export class GcsDocumentStorage implements DocumentStorage {
  constructor(
    private readonly storage: Storage,
    private readonly bucket: string,
  ) {}
  async put(key: string, bytes: Buffer, mimeType: string) {
    await this.storage
      .bucket(this.bucket)
      .file(key)
      .save(bytes, {
        resumable: false,
        validation: 'crc32c',
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: mimeType, cacheControl: 'private, no-store' },
      });
    return `gs://${this.bucket}/${key}`;
  }
  async read(key: string) {
    const [bytes] = await this.storage.bucket(this.bucket).file(key).download();
    return bytes;
  }
}
