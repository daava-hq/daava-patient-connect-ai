import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as organisations from './schema/organisations';
import * as practices from './schema/practices';
import * as users from './schema/users';
import * as practiceMembers from './schema/practice_members';
import * as practiceCredentials from './schema/practice_credentials';
import * as patients from './schema/patients';
import * as appointments from './schema/appointments';

const client = postgres(env.DATABASE_URL, {
  user: process.env.USER || 'premkumark',
  database: 'patient_connect2',
});

export const db = drizzle(client, {
  schema: {
    ...organisations,
    ...practices,
    ...users,
    ...practiceMembers,
    ...practiceCredentials,
    ...patients,
    ...appointments,
  },
});
