import { z } from 'zod';

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(8080),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().default('australia-southeast1'),
  STORAGE_MODE: z.enum(['local', 'gcs']).default('local'),
  DATABASE_MODE: z.enum(['memory', 'firestore']).default('memory'),
  AI_MODE: z.literal('mock').default('mock'),
  FIRESTORE_DATABASE_ID: z.string().min(1).default('(default)'),
  DOCUMENT_BUCKET: z.string().optional(),
  UPLOAD_DIR: z.string().default('uploads'),
  SERVE_WEB: z.enum(['true', 'false']).default('false'),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export const readEnvironment = (source: NodeJS.ProcessEnv = process.env): Environment =>
  EnvironmentSchema.superRefine((env, context) => {
    if (
      (env.DATABASE_MODE === 'firestore' || env.STORAGE_MODE === 'gcs') &&
      !env.GOOGLE_CLOUD_PROJECT
    ) {
      context.addIssue({
        code: 'custom',
        path: ['GOOGLE_CLOUD_PROJECT'],
        message: 'Cloud mode requires a project.',
      });
    }
    if (env.STORAGE_MODE === 'gcs' && !env.DOCUMENT_BUCKET) {
      context.addIssue({
        code: 'custom',
        path: ['DOCUMENT_BUCKET'],
        message: 'GCS mode requires a private bucket.',
      });
    }
    if (
      env.NODE_ENV === 'production' &&
      (env.DATABASE_MODE !== 'firestore' || env.STORAGE_MODE !== 'gcs')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Production requires durable Firestore and GCS adapters.',
      });
    }
  }).parse(source);
