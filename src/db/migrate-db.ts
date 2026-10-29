import { db } from './index';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Creating database tables if not exist...');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS organisations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS practices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      logo_url TEXT,
      timezone TEXT DEFAULT 'UTC' NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      hashed_password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'member' NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS practice_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member' NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      CONSTRAINT practice_members_practice_id_user_id_uniq UNIQUE(practice_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS practice_opendental_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE UNIQUE,
      developer_key_enc TEXT NOT NULL,
      customer_key_enc TEXT NOT NULL,
      last_patient_synced_at TIMESTAMPTZ,
      last_appt_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
      opendental_patient_id BIGINT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth DATE,
      phone_home TEXT,
      phone_mobile TEXT,
      email TEXT,
      status TEXT DEFAULT 'Patient' NOT NULL,
      sms_consent BOOLEAN DEFAULT FALSE NOT NULL,
      email_consent BOOLEAN DEFAULT FALSE NOT NULL,
      opendental_updated_at TIMESTAMPTZ,
      synced_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      CONSTRAINT patients_practice_id_opendental_patient_id_uniq UNIQUE(practice_id, opendental_patient_id)
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      opendental_appt_id BIGINT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      status TEXT DEFAULT 'Scheduled' NOT NULL,
      description TEXT,
      opendental_updated_at TIMESTAMPTZ,
      synced_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      CONSTRAINT appointments_practice_id_opendental_appt_id_uniq UNIQUE(practice_id, opendental_appt_id)
    );
  `);

  console.log('Database tables created successfully.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
