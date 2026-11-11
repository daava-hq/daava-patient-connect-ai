import 'server-only';
import { and, eq, isNull, ne, notExists, or } from 'drizzle-orm';
import { db } from '@/db';
import { appointmentReminders, appointmentReminderSchedules } from '@/db/schema/appointment_reminders';
import { appointments } from '@/db/schema/appointments';
import { birthdayCampaigns, birthdayMessageOccurrences } from '@/db/schema/birthday_engagement';
import { campaigns } from '@/db/schema/campaigns';
import { groupMembers, groups } from '@/db/schema/groups';
import { messageTemplates } from '@/db/schema/message_templates';
import { organisations } from '@/db/schema/organisations';
import { patients } from '@/db/schema/patients';
import { practices } from '@/db/schema/practices';
import { templateCategories, templates } from '@/db/schema/templates';
import { AppError, NotFoundError } from '@/lib/errors';
import { env } from '@/lib/env';
import { getLocalDateParts, addLocalDays } from '@/lib/birthdays/birthday-utils';
import { getSampleAppointmentTimes } from '@/lib/appointment-reminders/reminder-utils';
import sampleDataCatalog from './catalog.json';

const SAMPLE_PRACTICE_SLUG = sampleDataCatalog.practice.slug;
const SAMPLE_REMINDER_SCHEDULE_NAME = 'Sample 24-Hour Email Reminder';
const SAMPLE_EMAIL = sampleDataCatalog.practice.email;

function getSampleDateOfBirth(now: Date, timeZone: string, birthdayOffsetDays: number): string {
  const upcomingBirthday = addLocalDays(getLocalDateParts(now, timeZone), birthdayOffsetDays);
  const birthYear = upcomingBirthday.year - 30;
  const birthDay = upcomingBirthday.month === 2 && upcomingBirthday.day === 29
    ? 28
    : upcomingBirthday.day;
  return `${birthYear}-${String(upcomingBirthday.month).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
}

function getBirthdayChannel(channel: string): 'sms' | 'email' {
  if (channel !== 'sms' && channel !== 'email') {
    throw new Error(`Unsupported sample birthday campaign channel: ${channel}`);
  }
  return channel;
}

export async function resetSamplePracticeData(practiceId: string) {
  if (env.APP_ENVIRONMENT !== 'local' && env.APP_ENVIRONMENT !== 'dev') {
    throw new AppError(404, 'Sample data is unavailable', 'SAMPLE_DATA_UNAVAILABLE');
  }

  const [practice] = await db
    .select({ id: practices.id, timezone: practices.timezone })
    .from(practices)
    .innerJoin(organisations, eq(practices.organisationId, organisations.id))
    .where(and(
      eq(practices.id, practiceId),
      eq(practices.slug, SAMPLE_PRACTICE_SLUG),
      eq(practices.name, sampleDataCatalog.practice.name),
      eq(organisations.name, sampleDataCatalog.practice.organisationName)
    ))
    .limit(1);
  if (!practice) throw new NotFoundError('Sample practice not found');

  const now = new Date();
  const appointmentTimes = getSampleAppointmentTimes(now, practice.timezone, sampleDataCatalog.patients.length);

  return db.transaction(async (tx) => {
    const existingCampaigns = await tx
      .select({ id: campaigns.id, status: campaigns.status })
      .from(campaigns)
      .where(and(eq(campaigns.practiceId, practiceId), isNull(campaigns.deletedAt)))
      .for('update');
    if (existingCampaigns.some(({ status }) => status === 'scheduled' || status === 'processing')) {
      throw new AppError(
        409,
        'Cancel scheduled campaigns and wait for active campaigns to finish before resetting sample data.',
        'SAMPLE_DATA_CAMPAIGN_ACTIVE'
      );
    }

    const activeBirthdayCampaigns = await tx
      .select({ id: birthdayCampaigns.id })
      .from(birthdayCampaigns)
      .where(and(
        eq(birthdayCampaigns.practiceId, practiceId),
        eq(birthdayCampaigns.enabled, true),
        isNull(birthdayCampaigns.deletedAt)
      ))
      .for('update');
    if (activeBirthdayCampaigns.length) {
      throw new AppError(
        409,
        'Disable birthday campaigns before resetting sample data.',
        'SAMPLE_DATA_BIRTHDAY_CAMPAIGN_ACTIVE'
      );
    }

    const processingReminders = await tx
      .select({ id: appointmentReminders.id })
      .from(appointmentReminders)
      .where(and(
        eq(appointmentReminders.practiceId, practiceId),
        eq(appointmentReminders.status, 'processing')
      ))
      .for('update');
    if (processingReminders.length) {
      throw new AppError(
        409,
        'Wait for appointment reminders to finish processing before resetting sample data.',
        'SAMPLE_DATA_REMINDERS_ACTIVE'
      );
    }

    const deletedReminders = await tx
      .delete(appointmentReminders)
      .where(eq(appointmentReminders.practiceId, practiceId))
      .returning({ id: appointmentReminders.id });

    await tx
      .delete(birthdayMessageOccurrences)
      .where(eq(birthdayMessageOccurrences.practiceId, practiceId));
    const deletedBirthdayCampaigns = await tx
      .delete(birthdayCampaigns)
      .where(eq(birthdayCampaigns.practiceId, practiceId))
      .returning({ id: birthdayCampaigns.id });

    const deletedCampaigns = await tx
      .delete(campaigns)
      .where(eq(campaigns.practiceId, practiceId))
      .returning({ id: campaigns.id });

    const campaignFromAnotherPractice = tx
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(
        ne(campaigns.practiceId, practiceId),
        eq(campaigns.templateId, messageTemplates.id)
      ));
    await tx
      .delete(messageTemplates)
      .where(and(
        eq(messageTemplates.practiceId, practiceId),
        notExists(campaignFromAnotherPractice)
      ));

    await tx.delete(groups).where(eq(groups.practiceId, practiceId));
    await tx
      .delete(appointments)
      .where(eq(appointments.practiceId, practiceId));
    await tx
      .delete(patients)
      .where(eq(patients.practiceId, practiceId));

    const patientIdByNumber = new Map<number, string>();
    for (const [index, sample] of sampleDataCatalog.patients.entries()) {
      const [patient] = await tx
        .insert(patients)
        .values({
          practiceId,
          opendentalPatientId: sample.patientNumber,
          firstName: sample.firstName,
          lastName: sample.lastName,
          email: SAMPLE_EMAIL,
          phoneMobile: null,
          status: 'Patient',
          smsConsent: false,
          emailConsent: true,
          dateOfBirth: getSampleDateOfBirth(now, practice.timezone, sample.birthdayOffsetDays),
          syncedAt: now,
          updatedAt: now,
        })
        .returning({ id: patients.id });
      patientIdByNumber.set(sample.patientNumber, patient.id);

      await tx.insert(appointments).values({
        practiceId,
        patientId: patient.id,
        opendentalApptId: sample.appointmentNumber,
        scheduledAt: appointmentTimes[index],
        status: 'Scheduled',
        description: `Sample data: ${sample.description}`,
        syncedAt: now,
        updatedAt: now,
      });
    }

    const groupIdByKey = new Map<string, string>();
    for (const groupConfig of sampleDataCatalog.groups) {
      const [group] = await tx
        .insert(groups)
        .values({
          practiceId,
          name: groupConfig.name,
          description: groupConfig.description,
          groupType: 'static',
          criteria: {},
        })
        .returning({ id: groups.id });
      groupIdByKey.set(groupConfig.key, group.id);

      await tx.insert(groupMembers).values(
        groupConfig.patientNumbers.map((patientNumber) => {
          const patientId = patientIdByNumber.get(patientNumber);
          if (!patientId) throw new Error(`Unknown sample patient ${patientNumber} in group ${groupConfig.key}`);
          return { groupId: group.id, patientId };
        })
      );
    }

    const [birthdayTemplate] = await tx
      .select({ id: templates.id })
      .from(templates)
      .innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
      .where(and(
        eq(templateCategories.slug, 'birthdays'),
        eq(templates.status, 'published'),
        eq(templates.channel, getBirthdayChannel(sampleDataCatalog.birthdayCampaign.channel)),
        isNull(templates.deletedAt),
        or(eq(templates.practiceId, practiceId), eq(templates.isSystem, true))
      ))
      .limit(1);

    await tx.insert(birthdayCampaigns).values({
      practiceId,
      name: sampleDataCatalog.birthdayCampaign.name,
      channel: getBirthdayChannel(sampleDataCatalog.birthdayCampaign.channel),
      templateId: birthdayTemplate?.id ?? null,
      daysBefore: sampleDataCatalog.birthdayCampaign.daysBefore,
      localDeliveryTime: sampleDataCatalog.birthdayCampaign.localDeliveryTime,
      offerText: sampleDataCatalog.birthdayCampaign.offerText,
      enabled: sampleDataCatalog.birthdayCampaign.enabled,
    });

    for (const newsletter of sampleDataCatalog.newsletters) {
      const [template] = await tx
        .insert(messageTemplates)
        .values({
          practiceId,
          name: `${newsletter.name} content`,
          channel: 'email',
          subject: newsletter.content.subject,
          body: newsletter.content.sections.flatMap((section) =>
            section.blocks.map((block) => block.properties?.text ?? '')
          ).join('\n\n'),
          content: newsletter.content,
        })
        .returning({ id: messageTemplates.id });
      const groupIds = newsletter.groupKeys.map((key) => {
        const groupId = groupIdByKey.get(key);
        if (!groupId) throw new Error(`Unknown sample group ${key} for newsletter ${newsletter.name}`);
        return groupId;
      });
      await tx.insert(campaigns).values({
        practiceId,
        name: newsletter.name,
        type: 'newsletter',
        channel: 'email',
        status: 'draft',
        templateId: template.id,
        audienceFilter: { groupIds, patientStatuses: ['Patient'], consentEmail: true },
      });
    }

    for (const announcement of sampleDataCatalog.announcements) {
      const [template] = await tx
        .insert(messageTemplates)
        .values({
          practiceId,
          name: announcement.templateName,
          channel: 'email',
          subject: announcement.content.subject,
          body: announcement.content.sections.flatMap((section) =>
            section.blocks.map((block) => block.properties?.text ?? '')
          ).join('\n\n'),
          content: announcement.content,
        })
        .returning({ id: messageTemplates.id });
      const groupId = groupIdByKey.get(announcement.groupKey);
      if (!groupId) throw new Error(`Unknown sample group ${announcement.groupKey} for announcement ${announcement.name}`);
      await tx.insert(campaigns).values({
        practiceId,
        name: announcement.name,
        type: 'group_announcement',
        channel: 'email',
        status: 'draft',
        templateId: template.id,
        audienceFilter: { groupIds: [groupId], patientStatuses: ['Patient'], consentEmail: true },
      });
    }

    await tx
      .update(practices)
      .set({
        phone: sampleDataCatalog.practice.phone,
        address: sampleDataCatalog.practice.address,
        updatedAt: now,
      })
      .where(eq(practices.id, practiceId));

    await tx
      .delete(appointmentReminderSchedules)
      .where(and(
        eq(appointmentReminderSchedules.practiceId, practiceId),
        eq(appointmentReminderSchedules.name, SAMPLE_REMINDER_SCHEDULE_NAME)
      ));

    return {
      deletedReminders: deletedReminders.length,
      deletedBirthdayCampaigns: deletedBirthdayCampaigns.length,
      deletedCampaigns: deletedCampaigns.length,
      resetPatients: sampleDataCatalog.patients.length,
      resetAppointments: sampleDataCatalog.patients.length,
      resetGroups: sampleDataCatalog.groups.length,
      resetBirthdayCampaigns: 1,
      resetNewsletters: sampleDataCatalog.newsletters.length,
      resetAnnouncements: sampleDataCatalog.announcements.length,
    };
  });
}
