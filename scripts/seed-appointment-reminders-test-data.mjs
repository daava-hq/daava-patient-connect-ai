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

    await tx`
      INSERT INTO practice_members (practice_id, user_id, role)
      SELECT ${practice.id}, id, 'admin'
      FROM users
      ON CONFLICT (practice_id, user_id) DO NOTHING
    `;
    const [user] = await tx`SELECT id FROM users LIMIT 1`;
    if (!user) throw new Error('Create a local user account before seeding reminder sample data.');

    return practice;
  });
}

async function upsertAppointments(practiceId) {
  const [{ timezone }] = await sql`
    SELECT timezone FROM practices WHERE id = ${practiceId} LIMIT 1
  `;
  const now = new Date();
  const localToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const localDate = new Map(localToday.map(({ type, value }) => [type, value]));
  const sampleDate = new Date(Date.UTC(
    Number(localDate.get('year')),
    Number(localDate.get('month')) - 1,
    Number(localDate.get('day')) + 8
  ));
  const sampleScenarios = [
    {
      patientId: 8901,
      appointmentId: 7801,
      firstName: 'William',
      lastName: 'Clark',
      description: 'Routine dental cleaning',
    },
    {
      patientId: 8902,
      appointmentId: 7802,
      firstName: 'Sarah',
      lastName: 'Jenkins',
      description: 'Dental examination',
    },
    {
      patientId: 8903,
      appointmentId: 7803,
      firstName: 'Michael',
      lastName: 'Chen',
      description: 'Preventive care visit',
    },
    {
      patientId: 8904,
      appointmentId: 7804,
      firstName: 'Jessica',
      lastName: 'Taylor',
      description: 'Dental cleaning',
    },
    {
      patientId: 8905,
      appointmentId: 7805,
      firstName: 'Emily',
      lastName: 'Davis',
      description: 'Follow-up appointment',
    },
    {
      patientId: 8906,
      appointmentId: 7806,
      firstName: 'Robert',
      lastName: 'Wilson',
      description: 'Routine dental examination',
    },
    {
      patientId: 8907,
      appointmentId: 7807,
      firstName: 'Olivia',
      lastName: 'Anderson',
      description: 'Preventive dental visit',
    },
    {
      patientId: 8908,
      appointmentId: 7808,
      firstName: 'James',
      lastName: 'Martinez',
      description: 'Dental examination',
    },
    {
      patientId: 8909,
      appointmentId: 7809,
      firstName: 'Ava',
      lastName: 'Robinson',
      description: 'Routine dental cleaning',
    },
    {
      patientId: 8910,
      appointmentId: 7810,
      firstName: 'Benjamin',
      lastName: 'Lee',
      description: 'Follow-up dental visit',
    },
  ];
  const scenarios = sampleScenarios.map((sample, index) => {
    const appointmentDate = new Date(Date.UTC(
      sampleDate.getUTCFullYear(),
      sampleDate.getUTCMonth(),
      sampleDate.getUTCDate() + Math.floor(index / 2)
    ));
    return {
      ...sample,
      appointmentAt: localDateTimeToInstant(
        {
          year: appointmentDate.getUTCFullYear(),
          month: appointmentDate.getUTCMonth() + 1,
          day: appointmentDate.getUTCDate(),
        },
        index % 2 === 0 ? '09:00' : '10:00',
        timezone
      ),
    };
  });

  await sql.begin(async (tx) => {
    await tx`DELETE FROM appointment_reminders WHERE practice_id = ${practiceId}`;
    await tx`
      DELETE FROM appointment_reminder_schedules
      WHERE practice_id = ${practiceId}
        AND name = 'Sample 24-Hour Email Reminder'
    `;
    await tx`
      DELETE FROM appointments
      WHERE practice_id = ${practiceId}
        AND opendental_appt_id NOT IN (7801, 7802, 7803, 7804, 7805, 7806, 7807, 7808, 7809, 7810)
    `;
    await tx`
      DELETE FROM patients
      WHERE practice_id = ${practiceId}
        AND opendental_patient_id NOT IN (8901, 8902, 8903, 8904, 8905, 8906, 8907, 8908, 8909, 8910)
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
          'Scheduled', ${`Sample data: ${sample.description}`}
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

function localDateTimeToInstant(date, time, timeZone) {
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const offsetProbe = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const offsets = new Set();
  for (const hours of [-24, -12, 0, 12, 24]) {
    const probe = target + hours * 60 * 60_000;
    const parts = new Map(offsetProbe.formatToParts(new Date(probe)).map(({ type, value }) => [type, value]));
    const localAsUtc = Date.UTC(
      Number(parts.get('year')),
      Number(parts.get('month')) - 1,
      Number(parts.get('day')),
      Number(parts.get('hour')),
      Number(parts.get('minute'))
    );
    offsets.add(localAsUtc - probe);
  }
  const instant = target - [...offsets][0];
  for (const offset of offsets) {
    const candidate = target - offset;
    const parts = new Map(offsetProbe.formatToParts(new Date(candidate)).map(({ type, value }) => [type, value]));
    if (
      Number(parts.get('year')) === date.year &&
      Number(parts.get('month')) === date.month &&
      Number(parts.get('day')) === date.day &&
      Number(parts.get('hour')) === hour &&
      Number(parts.get('minute')) === minute
    ) {
      return new Date(candidate);
    }
  }
  return new Date(instant);
}

async function main() {
  const practice = await getSamplePractice();
  const scenarios = await upsertAppointments(practice.id);

  console.log(`Cleared prior reminder history and refreshed ${scenarios.length} sample patients and appointments across five days.`);
  console.log(`Practice: ${practice.name} (${practice.id})`);
  console.log(`All ten email-consenting sample patients use ${sampleEmail}.`);
  console.log('Existing reminder schedules are preserved. Upcoming reminders are derived from enabled schedules and these appointments.');
  console.log('The data seeder does not send emails. Use `pnpm reminders:cron:local` to start the two-minute sample-only cron runner.');
}

main()
  .catch((error) => {
    console.error('Failed to seed appointment reminder sample data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
