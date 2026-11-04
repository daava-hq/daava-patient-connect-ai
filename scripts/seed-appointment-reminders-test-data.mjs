import postgres from 'postgres';
import { assertSampleDataEnvironment } from './sample-data-environment.mjs';

assertSampleDataEnvironment(process.env.APP_ENVIRONMENT);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set explicitly before seeding reminder sample data.');
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const samplePracticeSlug = 'appointment-reminder-sample';
const samplePracticeName = 'Appointment Reminder Sample Practice';
const sampleOrganisationName = 'Patient Connect Sample Data';
const sampleEmail = 'prem@daava.ai';
const samplePracticePhone = '(555) 010-0100';
const samplePracticeAddress = '123 Sample Street, Test City, NY 10001';

async function getSamplePractice() {
  return sql.begin(async (tx) => {
    const [existing] = await tx`
      SELECT p.id, p.name, p.timezone, o.name AS organisation_name
      FROM practices p
      JOIN organisations o ON o.id = p.organisation_id
      WHERE p.slug = ${samplePracticeSlug}
      LIMIT 1
    `;

    let practice = existing;
    if (practice) {
      if (practice.name !== samplePracticeName || practice.organisation_name !== sampleOrganisationName) {
        throw new Error(`The reserved sample practice slug "${samplePracticeSlug}" is already in use.`);
      }
      await tx`
        UPDATE practices
        SET phone = ${samplePracticePhone},
            address = ${samplePracticeAddress},
            updated_at = NOW()
        WHERE id = ${practice.id}
      `;
    } else {
      const [organisation] = await tx`
        INSERT INTO organisations (name)
        VALUES (${sampleOrganisationName})
        RETURNING id
      `;
      [practice] = await tx`
        INSERT INTO practices (
          organisation_id, name, slug, timezone, phone, address
        )
        VALUES (
          ${organisation.id}, ${samplePracticeName}, ${samplePracticeSlug}, 'America/New_York',
          ${samplePracticePhone}, ${samplePracticeAddress}
        )
        RETURNING id, name, timezone
      `;
    }

    const [membership] = await tx`
      INSERT INTO practice_members (practice_id, user_id, role)
      SELECT ${practice.id}, id, 'admin'
      FROM users
      ON CONFLICT (practice_id, user_id) DO NOTHING
      RETURNING user_id
    `;
    const [user] = await tx`SELECT id FROM users LIMIT 1`;
    if (!user) throw new Error('Create a local user account before seeding reminder sample data.');

    return { ...practice, createdBy: membership?.user_id ?? user.id };
  });
}

async function getEmailTemplate() {
  const [template] = await sql`
    SELECT t.id, t.name
    FROM templates t
    JOIN template_categories c ON c.id = t.category_id
    WHERE c.slug = 'appointment-reminders'
      AND t.status = 'published'
      AND t.channel = 'email'
      AND t.is_system = true
      AND t.deleted_at IS NULL
      AND t.name <> '24-Hour Appointment Reminder (EMAIL)'
    ORDER BY t.is_system DESC, t.name
    LIMIT 1
  `;
  if (!template) {
    throw new Error('No published appointment-reminder email template found. Seed or publish one first.');
  }
  return template;
}

async function upsertSchedules(practice, template) {
  const definitions = [{ name: 'Sample 24-Hour Email Reminder', interval: '24_hours', localSendTime: '09:00' }];
  const schedules = [];

  await sql`
    UPDATE appointment_reminder_schedules
    SET enabled = false, updated_at = NOW()
    WHERE practice_id = ${practice.id}
  `;

  for (const definition of definitions) {
    const [existing] = await sql`
      SELECT id
      FROM appointment_reminder_schedules
      WHERE practice_id = ${practice.id} AND name = ${definition.name}
      LIMIT 1
    `;
    if (existing) {
      const [updated] = await sql`
        UPDATE appointment_reminder_schedules
        SET interval = ${definition.interval},
            channel = 'email',
            local_send_time = ${definition.localSendTime},
            template_id = ${template.id},
            enabled = true,
            updated_at = NOW()
        WHERE id = ${existing.id} AND practice_id = ${practice.id}
        RETURNING id, name, interval
      `;
      schedules.push(updated);
    } else {
      const [inserted] = await sql`
        INSERT INTO appointment_reminder_schedules (
          practice_id, name, interval, channel, local_send_time, template_id, enabled, created_by
        )
        VALUES (
          ${practice.id}, ${definition.name}, ${definition.interval}, 'email',
          ${definition.localSendTime}, ${template.id}, true, ${practice.createdBy}
        )
        RETURNING id, name, interval
      `;
      schedules.push(inserted);
    }
  }

  return schedules;
}

async function upsertAppointments(practiceId) {
  const now = Date.now();
  const appointmentAt = new Date(now + 24 * 60 * 60_000 + 10 * 60_000);
  const scenarios = [
    {
      patientId: 8901,
      appointmentId: 7801,
      firstName: 'William',
      lastName: 'Clark',
      appointmentAt,
      description: 'Automatic reminder test 1',
    },
    {
      patientId: 8902,
      appointmentId: 7802,
      firstName: 'Sarah',
      lastName: 'Jenkins',
      appointmentAt,
      description: 'Automatic reminder test 2',
    },
    {
      patientId: 8903,
      appointmentId: 7803,
      firstName: 'Michael',
      lastName: 'Chen',
      appointmentAt,
      description: 'Automatic reminder test 3',
    },
    {
      patientId: 8904,
      appointmentId: 7804,
      firstName: 'Jessica',
      lastName: 'Taylor',
      appointmentAt,
      description: 'Automatic reminder test 4',
    },
    {
      patientId: 8905,
      appointmentId: 7805,
      firstName: 'Emily',
      lastName: 'Davis',
      appointmentAt,
      description: 'Automatic reminder test 5',
    },
    {
      patientId: 8906,
      appointmentId: 7806,
      firstName: 'Robert',
      lastName: 'Wilson',
      appointmentAt,
      description: 'Automatic reminder test 6',
    },
  ];

  await sql.begin(async (tx) => {
    await tx`DELETE FROM appointment_reminders WHERE practice_id = ${practiceId}`;
    await tx`
      DELETE FROM appointments
      WHERE practice_id = ${practiceId}
        AND opendental_appt_id NOT IN (7801, 7802, 7803, 7804, 7805, 7806)
    `;
    await tx`
      DELETE FROM patients
      WHERE practice_id = ${practiceId}
        AND opendental_patient_id NOT IN (8901, 8902, 8903, 8904, 8905, 8906)
    `;

    for (const sample of scenarios) {
      const [patient] = await tx`
        INSERT INTO patients (
          practice_id, opendental_patient_id, first_name, last_name, email,
          phone_mobile, status, sms_consent, email_consent, date_of_birth
        )
        VALUES (
          ${practiceId}, ${sample.patientId}, ${sample.firstName}, ${sample.lastName},
          ${sampleEmail}, NULL, 'Patient', false, true, '1985-06-15'
        )
        ON CONFLICT (practice_id, opendental_patient_id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          email = EXCLUDED.email,
          phone_mobile = NULL,
          status = 'Patient',
          sms_consent = false,
          email_consent = true,
          date_of_birth = EXCLUDED.date_of_birth,
          updated_at = NOW()
        RETURNING id
      `;

      await tx`
        INSERT INTO appointments (
          practice_id, patient_id, opendental_appt_id, scheduled_at, status, description
        )
        VALUES (
          ${practiceId}, ${patient.id}, ${sample.appointmentId}, ${sample.appointmentAt},
          'Scheduled', ${sample.description}
        )
        ON CONFLICT (practice_id, opendental_appt_id) DO UPDATE SET
          patient_id = EXCLUDED.patient_id,
          scheduled_at = EXCLUDED.scheduled_at,
          status = 'Scheduled',
          description = EXCLUDED.description,
          updated_at = NOW()
      `;
    }
  });

  return scenarios;
}

async function main() {
  const template = await getEmailTemplate();
  const practice = await getSamplePractice();
  const schedules = await upsertSchedules(practice, template);
  const scenarios = await upsertAppointments(practice.id);

  console.log(`Cleared prior sample history and seeded ${scenarios.length} eligible appointments.`);
  console.log(`Practice: ${practice.name} (${practice.id})`);
  console.log(`Template: ${template.name}`);
  console.log(`Schedules: ${schedules.map(({ name }) => name).join(', ')}`);
  console.log(`All six consenting sample patients use ${sampleEmail}. Their 24-hour reminders are due now.`);
  console.log('The seeder does not send emails. Use `pnpm reminders:cron:local` to start the two-minute sample-only cron runner.');
}

main()
  .catch((error) => {
    console.error('Failed to seed appointment reminder sample data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
