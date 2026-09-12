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
  AI_MODE: z.enum(['mock', 'vertex']).default('mock'),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export const readEnvironment = (source: NodeJS.ProcessEnv = process.env): Environment =>
  EnvironmentSchema.parse(source);
