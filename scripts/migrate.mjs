import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be configured before running migrations');
}

const client = postgres(databaseUrl, { max: 1 });

try {
  await migrate(drizzle(client), { migrationsFolder: 'src/db/migrations' });
  console.log('Database migrations applied successfully.');
} catch (error) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error &&
    typeof error.code === 'string'
      ? ` (database code ${error.code})`
      : '';
  console.error(`Database migration failed${code}. See server/database logs for details.`);
  process.exitCode = 1;
} finally {
  await client.end();
}
