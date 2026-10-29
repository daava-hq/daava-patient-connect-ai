import { db } from '@/db';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Running database seed...');

  // Create organisation
  const orgs = await db.execute(sql`
    INSERT INTO organisations (name) VALUES ('DAG Dental Group') 
    ON CONFLICT DO NOTHING 
    RETURNING id
  `);
  let orgId = orgs[0]?.id;
  if (!orgId) {
    const existingOrgs = await db.execute(sql`SELECT id FROM organisations LIMIT 1`);
    orgId = existingOrgs[0].id;
  }

  // Create practice: Riversbend Dental (auto-generated UUID, idempotent on slug)
  const practiceResult = await db.execute(sql`
    INSERT INTO practices (organisation_id, name, slug, address, phone, timezone) 
    VALUES (${orgId as string}, 'Riversbend Dental', 'riversbend-dental', '123 Riversbend Way, Harrisonburg, VA', '(555) 019-2834', 'America/New_York') 
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
  const practiceId = practiceResult[0]?.id as string;

  // Create demo user: doctor@riversbenddental.com / password123
  const hashedPassword = await bcrypt.hash('password123', 10);
  const usersRes = await db.execute(sql`
    INSERT INTO users (email, hashed_password, name, role) 
    VALUES ('doctor@riversbenddental.com', ${hashedPassword}, 'Dr. Brian Albert', 'admin') 
    ON CONFLICT (email) DO UPDATE SET hashed_password = EXCLUDED.hashed_password 
    RETURNING id
  `);
  const userId = usersRes[0]?.id as string;

  if (userId && practiceId) {
    await db.execute(sql`
      INSERT INTO practice_members (practice_id, user_id, role) 
      VALUES (${practiceId}, ${userId}, 'admin') 
      ON CONFLICT DO NOTHING
    `);
  }

  // Seed placeholder OpenDental credentials (replace with real keys in production)
  if (practiceId) {
    await db.execute(sql`
      INSERT INTO practice_opendental_credentials (practice_id, developer_key_enc, customer_key_enc)
      VALUES (${practiceId}, 'U2FsdGVkX1+v+v...', 'U2FsdGVkX1+v+v...')
      ON CONFLICT (practice_id) DO NOTHING
    `);
  }

  console.log('Seed completed successfully.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

