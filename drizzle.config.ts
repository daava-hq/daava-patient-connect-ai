import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema/!(*.test).ts',
  out: './src/db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/patient_connect',
  },
} satisfies Config;
