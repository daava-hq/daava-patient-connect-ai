import { z } from 'zod';

export const APP_ENVIRONMENTS = ['local', 'dev', 'stage', 'production'] as const;
export const appEnvironmentSchema = z.enum(APP_ENVIRONMENTS);
export type AppEnvironment = z.infer<typeof appEnvironmentSchema>;

export function parseAppEnvironment(value: string | undefined): AppEnvironment {
  return appEnvironmentSchema.parse(value ?? 'local');
}

const envSchema = z.object({
  APP_ENVIRONMENT: appEnvironmentSchema,
  DATABASE_URL: z.string(),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  CREDENTIALS_ENCRYPTION_KEY: z.string().min(32),
  REGISTER_TOKEN_SECRET: z.string().min(16),
  OPENDENTAL_BASE_URL: z.string().url(),
});

export const env = envSchema.parse({
  APP_ENVIRONMENT: parseAppEnvironment(process.env.APP_ENVIRONMENT),
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/patient_connect2',
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'test-secret-key-min-length-required',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  CREDENTIALS_ENCRYPTION_KEY: process.env.CREDENTIALS_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  REGISTER_TOKEN_SECRET: process.env.REGISTER_TOKEN_SECRET || 'register-token-secret-change-in-production-32x',
  OPENDENTAL_BASE_URL: process.env.OPENDENTAL_BASE_URL || 'https://api.opendental.com/api/v1',
});
