import { z } from 'zod';

const EnvironmentSchema = z.object({
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_AGENT_ID: z.string().min(1).optional(),
  ELEVENLABS_PHONE_NUMBER_ID: z.string().min(1).optional(),
  ELEVENLABS_WEBHOOK_SECRET: z.string().min(1).optional(),
  CLARIFICATION_REVIEW_TOKEN: z.string().min(32).optional(),
  CLARIFICATION_TEST_PHONE: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/)
    .optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(8080),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().default('australia-southeast1'),
  STORAGE_MODE: z.enum(['local', 'gcs']).default('local'),
  DATABASE_MODE: z.enum(['memory', 'firestore']).default('memory'),
  AI_MODE: z.enum(['mock', 'vertex']).default('mock'),
  GEMINI_MODEL: z
    .string()
    .regex(/^gemini-[a-z0-9.-]+$/)
    .default('gemini-3.5-flash'),
  VERTEX_LOCATION: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .default('global'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(45000).default(40000),
  FIRESTORE_DATABASE_ID: z.string().min(1).default('(default)'),
  DOCUMENT_BUCKET: z.string().optional(),
  RAG_SERVICE_URL: z.string().url().optional(),
  RAG_INTERNAL_TOKEN: z.string().min(32).optional(),
  UPLOAD_DIR: z.string().default('uploads'),
  SERVE_WEB: z.enum(['true', 'false']).default('false'),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export const readEnvironment = (source: NodeJS.ProcessEnv = process.env): Environment =>
  EnvironmentSchema.superRefine((env, context) => {
    if (
      (env.DATABASE_MODE === 'firestore' ||
        env.STORAGE_MODE === 'gcs' ||
        env.AI_MODE === 'vertex') &&
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
    if (Boolean(env.RAG_SERVICE_URL) !== Boolean(env.RAG_INTERNAL_TOKEN)) {
      context.addIssue({
        code: 'custom',
        path: ['RAG_SERVICE_URL'],
        message: 'RAG service URL and internal token must be configured together.',
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
