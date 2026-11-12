import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { assertSampleDataEnvironment } from './sample-data-environment.mjs';

assertSampleDataEnvironment(process.env.APP_ENVIRONMENT);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set explicitly before seeding sample practice data.');
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const sampleDataCatalog = JSON.parse(
  readFileSync(new URL('../src/lib/sample-data/catalog.json', import.meta.url), 'utf8')
);
const samplePracticeSlug = sampleDataCatalog.practice.slug;
const samplePracticeName = sampleDataCatalog.practice.name;
const sampleOrganisationName = sampleDataCatalog.practice.organisationName;
const sampleEmail = sampleDataCatalog.practice.email;
const samplePracticePhone = sampleDataCatalog.practice.phone;
const samplePracticeAddress = sampleDataCatalog.practice.address;

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
    Number(localDate.get('day')) + 7
  ));
  const scenarios = sampleDataCatalog.patients.map((sample, index) => {
    const appointmentDate = new Date(Date.UTC(
      sampleDate.getUTCFullYear(),
      sampleDate.getUTCMonth(),
      sampleDate.getUTCDate() + Math.floor(index / 2)
    ));
    const birthdayDate = new Date(Date.UTC(
      Number(localDate.get('year')),
      Number(localDate.get('month')) - 1,
      Number(localDate.get('day')) + sample.birthdayOffsetDays
    ));
    const birthdayMonth = birthdayDate.getUTCMonth() + 1;
    const birthdayDay = birthdayMonth === 2 && birthdayDate.getUTCDate() === 29
      ? 28
      : birthdayDate.getUTCDate();
    return {
      ...sample,
      dateOfBirth: `${birthdayDate.getUTCFullYear() - 30}-${String(birthdayMonth).padStart(2, '0')}-${String(birthdayDay).padStart(2, '0')}`,
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
    const [activeCampaign] = await tx`
      SELECT id
      FROM campaigns
      WHERE practice_id = ${practiceId}
        AND deleted_at IS NULL
        AND status IN ('scheduled', 'processing')
      LIMIT 1
      FOR UPDATE
    `;
    if (activeCampaign) {
      throw new Error('Cancel scheduled campaigns and wait for active campaigns to finish before resetting sample data.');
    }

    const [activeBirthdayCampaign] = await tx`
      SELECT id
      FROM birthday_engagement_campaigns
      WHERE practice_id = ${practiceId}
        AND enabled = true
        AND deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
    `;
    if (activeBirthdayCampaign) {
      throw new Error('Disable birthday campaigns before resetting sample data.');
    }

    const [processingReminder] = await tx`
      SELECT id
      FROM appointment_reminders
      WHERE practice_id = ${practiceId}
        AND status = 'processing'
      LIMIT 1
      FOR UPDATE
    `;
    if (processingReminder) {
      throw new Error('Wait for appointment reminders to finish processing before resetting sample data.');
    }

    await tx`DELETE FROM appointment_reminders WHERE practice_id = ${practiceId}`;
    await tx`DELETE FROM birthday_engagement_occurrences WHERE practice_id = ${practiceId}`;
    await tx`DELETE FROM birthday_engagement_campaigns WHERE practice_id = ${practiceId}`;
    await tx`DELETE FROM campaigns WHERE practice_id = ${practiceId}`;
    await tx`DELETE FROM groups WHERE practice_id = ${practiceId}`;
    await tx`
      DELETE FROM message_templates mt
      WHERE mt.practice_id = ${practiceId}
        AND NOT EXISTS (
          SELECT 1
          FROM campaigns c
          WHERE c.practice_id <> ${practiceId}
            AND c.template_id = mt.id
        )
    `;
    await tx`
      DELETE FROM appointment_reminder_schedules
      WHERE practice_id = ${practiceId}
        AND name = 'Sample 24-Hour Email Reminder'
    `;
    await tx`DELETE FROM appointments WHERE practice_id = ${practiceId}`;
    await tx`DELETE FROM patients WHERE practice_id = ${practiceId}`;

    for (const sample of scenarios) {
      const [patient] = await tx`
        INSERT INTO patients (
          practice_id, opendental_patient_id, first_name, last_name, email,
          phone_mobile, status, sms_consent, email_consent, date_of_birth
        )
        VALUES (
          ${practiceId}, ${sample.patientNumber}, ${sample.firstName}, ${sample.lastName},
          ${sampleEmail}, NULL, 'Patient', false, true, ${sample.dateOfBirth}
        )
        RETURNING id
      `;

      await tx`
        INSERT INTO appointments (
          practice_id, patient_id, opendental_appt_id, scheduled_at, status, description
        )
        VALUES (
          ${practiceId}, ${patient.id}, ${sample.appointmentNumber}, ${sample.appointmentAt},
          'Scheduled', ${`Sample data: ${sample.description}`}
        )
      `;
    }

    await seedEngagementData(tx, practiceId);
  });

  return scenarios;
}

async function seedEngagementData(tx, practiceId) {
  const patientRows = await tx`
    SELECT id, opendental_patient_id
    FROM patients
    WHERE practice_id = ${practiceId}
  `;
  const patientIdByNumber = new Map(
    patientRows.map((patient) => [Number(patient.opendental_patient_id), patient.id])
  );
  const groupIdByKey = new Map();

  for (const groupConfig of sampleDataCatalog.groups) {
    const [group] = await tx`
      INSERT INTO groups (practice_id, name, description, group_type, criteria)
      VALUES (${practiceId}, ${groupConfig.name}, ${groupConfig.description}, 'static', '{}'::jsonb)
      RETURNING id
    `;
    groupIdByKey.set(groupConfig.key, group.id);
    for (const patientNumber of groupConfig.patientNumbers) {
      const patientId = patientIdByNumber.get(patientNumber);
      if (!patientId) throw new Error(`Unknown sample patient ${patientNumber} in group ${groupConfig.key}`);
      await tx`
        INSERT INTO group_members (group_id, patient_id)
        VALUES (${group.id}, ${patientId})
        ON CONFLICT (group_id, patient_id) DO NOTHING
      `;
    }
  }

  const birthday = sampleDataCatalog.birthdayCampaign;
  const [birthdayTemplate] = await tx`
    SELECT t.id
    FROM templates t
    JOIN template_categories c ON c.id = t.category_id
    WHERE c.slug = 'birthdays'
      AND t.status = 'published'
      AND t.channel = ${birthday.channel}
      AND t.deleted_at IS NULL
      AND (t.practice_id = ${practiceId} OR t.is_system = true)
    LIMIT 1
  `;
  await tx`
    INSERT INTO birthday_engagement_campaigns (
      practice_id, name, channel, template_id, days_before, local_delivery_time, offer_text, enabled
    )
    VALUES (
      ${practiceId}, ${birthday.name}, ${birthday.channel}, ${birthdayTemplate?.id ?? null}, ${birthday.daysBefore},
      ${birthday.localDeliveryTime}, ${birthday.offerText}, ${birthday.enabled}
    )
  `;

  for (const newsletter of sampleDataCatalog.newsletters) {
    const groupIds = newsletter.groupKeys.map((key) => {
      const groupId = groupIdByKey.get(key);
      if (!groupId) throw new Error(`Unknown sample group ${key} for newsletter ${newsletter.name}`);
      return groupId;
    });
    await insertSampleCampaign(tx, {
      practiceId,
      name: newsletter.name,
      type: 'newsletter',
      content: newsletter.content,
      audienceFilter: { groupIds, patientStatuses: ['Patient'], consentEmail: true },
    });
  }

  for (const announcement of sampleDataCatalog.announcements) {
    const groupId = groupIdByKey.get(announcement.groupKey);
    if (!groupId) throw new Error(`Unknown sample group ${announcement.groupKey} for announcement ${announcement.name}`);
    await insertSampleCampaign(tx, {
      practiceId,
      name: announcement.name,
      templateName: announcement.templateName,
      type: 'group_announcement',
      content: announcement.content,
      audienceFilter: { groupIds: [groupId], patientStatuses: ['Patient'], consentEmail: true },
    });
  }
}

async function insertSampleCampaign(tx, { practiceId, name, templateName, type, content, audienceFilter }) {
  const body = content.sections
    .flatMap((section) => section.blocks)
    .map((block) => block.properties?.text ?? block.text ?? '')
    .filter(Boolean)
    .join('\n\n');
  const [template] = await tx`
    INSERT INTO message_templates (
      practice_id, name, channel, subject, body, content
    )
    VALUES (
      ${practiceId}, ${templateName || `${name} content`}, 'email',
      ${content.subject}, ${body}, ${JSON.stringify(content)}::jsonb
    )
    RETURNING id
  `;
  await tx`
    INSERT INTO campaigns (
      practice_id, name, type, channel, status, template_id, audience_filter
    )
    VALUES (
      ${practiceId}, ${name}, ${type}, 'email', 'draft', ${template.id},
      ${JSON.stringify(audienceFilter)}::jsonb
    )
  `;
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

  console.log(`Refreshed ${scenarios.length} sample patients and appointments across five days.`);
  console.log(`Practice: ${practice.name} (${practice.id})`);
  console.log(`Sample patients use ${sampleEmail}; birthdays, groups, a birthday campaign, a newsletter, and a group announcement were refreshed.`);
  console.log('Newsletter and group announcement campaigns are drafts. The birthday campaign is disabled. The seeder does not send emails.');
  console.log('Existing reminder schedules are preserved. Upcoming reminders are derived from enabled schedules and these appointments.');
  console.log('Use `pnpm sample:cron:local` to poll all sample engagement email modules.');
}

main()
  .catch((error) => {
    console.error('Failed to seed sample practice data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
