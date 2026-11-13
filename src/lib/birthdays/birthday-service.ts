import 'server-only';
import { and, asc, eq, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { birthdayCampaigns, birthdayMessageOccurrences, type BirthdayEligibilityRules } from '@/db/schema/birthday_engagement';
import { patients } from '@/db/schema/patients';
import { practices } from '@/db/schema/practices';
import { templateCategories, templates } from '@/db/schema/templates';
import { AppError, NotFoundError } from '@/lib/errors';
import { logError } from '@/lib/logger';
import { getAdapter } from '@/lib/messaging/stub-adapter';
import { isPracticeChannelEnabled } from '@/lib/messaging/practice-channel-settings';
import { sendReminderWithAdapter, renderAppointmentTemplateContent } from '@/lib/appointment-reminders/reminder-utils';
import {
  addLocalDays,
  dateKey,
  getBirthdayDateKeys,
  getBirthdayDateRange,
  getBirthdayInYear,
  getBirthdaySuppressionReason,
  getLocalDateParts,
  getNextBirthdayOccurrence,
  type BirthdayRange,
  type LocalDateParts,
} from './birthday-utils';

const HISTORY_LIMIT = 50;
const UPCOMING_BIRTHDAY_MESSAGE_LIMIT = 500;
const MAX_DISPATCH_BATCH = 100;
const MAX_SEND_ATTEMPTS = 3;

interface BirthdayPatient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  phoneMobile: string | null;
  phoneHome: string | null;
  email: string | null;
  status: string;
  smsConsent: boolean;
  emailConsent: boolean;
}

function isBirthdayOnDate(dateOfBirth: string | null, onDate: LocalDateParts): boolean {
  if (!dateOfBirth) return false;
  const birthday = getBirthdayInYear(dateOfBirth, onDate.year);
  return Boolean(birthday && birthday.month === onDate.month && birthday.day === onDate.day);
}

function datePartsBetween(start: LocalDateParts, end: LocalDateParts): LocalDateParts[] {
  const startDate = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const endDate = new Date(Date.UTC(end.year, end.month - 1, end.day));
  const result: LocalDateParts[] = [];
  for (let instant = startDate.getTime(); instant <= endDate.getTime(); instant += 86_400_000) {
    const date = new Date(instant);
    result.push({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    });
  }
  return result;
}

async function getPractice(practiceId: string) {
  const [practice] = await db
    .select({
      id: practices.id,
      name: practices.name,
      phone: practices.phone,
      email: practices.email,
      website: practices.website,
      address: practices.address,
      timezone: practices.timezone,
    })
    .from(practices)
    .where(eq(practices.id, practiceId))
    .limit(1);
  if (!practice) throw new NotFoundError('Practice not found');
  return practice;
}

async function getBirthdayPatients(
  practiceId: string,
  start: LocalDateParts,
  end: LocalDateParts
): Promise<BirthdayPatient[]> {
  const monthDays = getBirthdayDateKeys(start, end);
  const monthDayExpression = sql<string>`to_char(${patients.dateOfBirth}, 'MM-DD')`;
  const rows = await db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      phoneMobile: patients.phoneMobile,
      phoneHome: patients.phoneHome,
      email: patients.email,
      status: patients.status,
      smsConsent: patients.smsConsent,
      emailConsent: patients.emailConsent,
    })
    .from(patients)
    .where(
      and(
        eq(patients.practiceId, practiceId),
        eq(patients.status, 'Patient'),
        isNotNull(patients.dateOfBirth),
        inArray(monthDayExpression, monthDays)
      )
    )
    .orderBy(asc(patients.lastName), asc(patients.firstName));
  return rows;
}

async function getBirthdayList(
  practiceId: string,
  start: LocalDateParts,
  end: LocalDateParts,
  timeZone: string,
  now: Date
) {
  const patientsWithBirthdays = await getBirthdayPatients(practiceId, start, end);
  const candidateDates = datePartsBetween(start, end);
  const today = getLocalDateParts(now, timeZone);
  return patientsWithBirthdays.flatMap((patient) => {
    return candidateDates
      .filter((date) => isBirthdayOnDate(patient.dateOfBirth, date))
      .map((birthdayDate) => {
        const observed = new Date(Date.UTC(birthdayDate.year, birthdayDate.month - 1, birthdayDate.day));
        const todayDate = new Date(Date.UTC(today.year, today.month - 1, today.day));
        const daysUntil = Math.floor((observed.getTime() - todayDate.getTime()) / 86_400_000);
        return {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          birthdayDate: dateKey(birthdayDate),
          daysUntil,
          smsEligible: patient.smsConsent && Boolean(patient.phoneMobile || patient.phoneHome),
          emailEligible: patient.emailConsent && Boolean(patient.email),
        };
      });
  }).sort((left, right) => left.birthdayDate.localeCompare(right.birthdayDate));
}

export async function getBirthdayDashboard(input: {
  practiceId: string;
  range: BirthdayRange;
  customStart?: string;
  customEnd?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const practice = await getPractice(input.practiceId);
  let selectedRange: { start: LocalDateParts; end: LocalDateParts };
  try {
    selectedRange = getBirthdayDateRange(
      input.range,
      now,
      practice.timezone,
      input.customStart,
      input.customEnd
    );
    getBirthdayDateKeys(selectedRange.start, selectedRange.end);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new AppError(400, error.message, 'INVALID_BIRTHDAY_RANGE');
    }
    throw error;
  }

  const today = getLocalDateParts(now, practice.timezone);
  const tomorrow = addLocalDays(today, 1);
  const sevenDays = addLocalDays(today, 6);
  const monthStart = { year: today.year, month: today.month, day: 1 };
  const monthEndDate = new Date(Date.UTC(today.year, today.month, 0));
  const monthEnd = {
    year: monthEndDate.getUTCFullYear(),
    month: monthEndDate.getUTCMonth() + 1,
    day: monthEndDate.getUTCDate(),
  };
  const [
    todayList,
    tomorrowList,
    upcomingList,
    monthList,
    selectedBirthdays,
    campaigns,
    history,
    scheduledMessages,
    statusCounts,
    missingBirthdates,
  ] =
    await Promise.all([
      getBirthdayList(input.practiceId, today, today, practice.timezone, now),
      getBirthdayList(input.practiceId, tomorrow, tomorrow, practice.timezone, now),
      getBirthdayList(input.practiceId, today, sevenDays, practice.timezone, now),
      getBirthdayList(input.practiceId, monthStart, monthEnd, practice.timezone, now),
      getBirthdayList(input.practiceId, selectedRange.start, selectedRange.end, practice.timezone, now),
      getBirthdayCampaigns(input.practiceId),
      getBirthdayHistory(input.practiceId, HISTORY_LIMIT),
      getUpcomingBirthdayMessages(input.practiceId, practice.timezone, now),
      getBirthdayReportCounts(input.practiceId),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(patients)
        .where(
          and(
            eq(patients.practiceId, input.practiceId),
            eq(patients.status, 'Patient'),
            isNull(patients.dateOfBirth)
          )
        )
        .then(([row]) => row?.count ?? 0),
    ]);

  return {
    timezone: practice.timezone,
    selectedRange: {
      start: dateKey(selectedRange.start),
      end: dateKey(selectedRange.end),
    },
    metrics: {
      today: todayList.length,
      tomorrow: tomorrowList.length,
      next7Days: upcomingList.length,
      thisMonth: monthList.length,
      patientsMissingBirthdate: missingBirthdates,
    },
    birthdays: selectedBirthdays,
    todayBirthdays: todayList,
    upcomingBirthdays: upcomingList,
    campaigns,
    history,
    scheduledMessages,
    report: statusCounts,
  };
}

export async function getBirthdayCampaigns(practiceId: string) {
  return db
    .select({
      id: birthdayCampaigns.id,
      name: birthdayCampaigns.name,
      channel: birthdayCampaigns.channel,
      templateId: birthdayCampaigns.templateId,
      daysBefore: birthdayCampaigns.daysBefore,
      localDeliveryTime: birthdayCampaigns.localDeliveryTime,
      offerText: birthdayCampaigns.offerText,
      eligibilityRules: birthdayCampaigns.eligibilityRules,
      enabled: birthdayCampaigns.enabled,
      createdAt: birthdayCampaigns.createdAt,
      updatedAt: birthdayCampaigns.updatedAt,
      templateName: templates.name,
      templateStatus: templates.status,
    })
    .from(birthdayCampaigns)
    .leftJoin(
      templates,
      and(
        eq(birthdayCampaigns.templateId, templates.id),
        or(eq(templates.practiceId, practiceId), eq(templates.isSystem, true))
      )
    )
    .where(and(eq(birthdayCampaigns.practiceId, practiceId), isNull(birthdayCampaigns.deletedAt)))
    .orderBy(asc(birthdayCampaigns.createdAt));
}

export async function getBirthdayTemplateOptions(practiceId: string) {
  return db
    .select({
      id: templates.id,
      name: templates.name,
      channel: templates.channel,
      content: templates.content,
      variables: templates.variables,
      status: templates.status,
      isSystem: templates.isSystem,
    })
    .from(templates)
    .innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
    .where(
      and(
        eq(templateCategories.slug, 'birthdays'),
        eq(templates.status, 'published'),
        isNull(templates.deletedAt),
        or(eq(templates.practiceId, practiceId), eq(templates.isSystem, true))
      )
    )
    .orderBy(asc(templates.name));
}

async function validateBirthdayTemplate(
  practiceId: string,
  templateId: string,
  channel: 'sms' | 'email',
  offerText: string | null
) {
  const [template] = await db
    .select({
      id: templates.id,
      channel: templates.channel,
      status: templates.status,
      content: templates.content,
    })
    .from(templates)
    .innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
    .where(
      and(
        eq(templates.id, templateId),
        eq(templateCategories.slug, 'birthdays'),
        isNull(templates.deletedAt),
        or(eq(templates.practiceId, practiceId), eq(templates.isSystem, true))
      )
    )
    .limit(1);
  if (!template || template.status !== 'published') {
    throw new AppError(400, 'Select a published birthday template', 'INVALID_BIRTHDAY_TEMPLATE');
  }
  if (template.channel !== channel) {
    throw new AppError(400, 'Template channel must match the campaign channel', 'BIRTHDAY_TEMPLATE_CHANNEL_MISMATCH');
  }
  const content = template.content as Record<string, unknown>;
  if (channel === 'email' && (typeof content.subject !== 'string' || !content.subject.trim())) {
    throw new AppError(400, 'Birthday email templates require a subject', 'INVALID_BIRTHDAY_TEMPLATE_SUBJECT');
  }
  if (!offerText?.trim() && JSON.stringify(content).includes('{{birthday.offer}}')) {
    throw new AppError(400, 'Enter an offer for the selected birthday template', 'BIRTHDAY_OFFER_REQUIRED');
  }
}

export interface BirthdayCampaignInput {
  name: string;
  channel: 'sms' | 'email';
  templateId: string;
  daysBefore: number;
  localDeliveryTime: string;
  offerText: string | null;
  eligibilityRules: BirthdayEligibilityRules;
  enabled: boolean;
}

export async function createBirthdayCampaign(
  practiceId: string,
  createdBy: string,
  input: BirthdayCampaignInput
) {
  await getPractice(practiceId);
  await validateBirthdayTemplate(practiceId, input.templateId, input.channel, input.offerText);
  const { groupIds: _legacyGroupIds, ...eligibilityRules } = input.eligibilityRules ?? {};
  const [campaign] = await db
    .insert(birthdayCampaigns)
    .values({
      practiceId,
      createdBy,
      ...input,
      eligibilityRules,
    })
    .returning();
  return campaign;
}

export async function updateBirthdayCampaign(
  practiceId: string,
  campaignId: string,
  input: BirthdayCampaignInput
) {
  const [existing] = await db
    .select()
    .from(birthdayCampaigns)
    .where(
      and(
        eq(birthdayCampaigns.id, campaignId),
        eq(birthdayCampaigns.practiceId, practiceId),
        isNull(birthdayCampaigns.deletedAt)
      )
    )
    .limit(1);
  if (!existing) throw new NotFoundError('Birthday campaign not found');
  await validateBirthdayTemplate(practiceId, input.templateId, input.channel, input.offerText);
  const { groupIds: _legacyGroupIds, ...eligibilityRules } = input.eligibilityRules ?? {};
  return db.transaction(async (tx) => {
    const [campaign] = await tx
      .update(birthdayCampaigns)
      .set({ ...input, eligibilityRules, updatedAt: new Date() })
      .where(and(eq(birthdayCampaigns.id, campaignId), eq(birthdayCampaigns.practiceId, practiceId)))
      .returning();
    if (!input.enabled) {
      await tx
        .update(birthdayMessageOccurrences)
        .set({
          status: 'skipped',
          lastErrorMessage: 'Campaign disabled',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(birthdayMessageOccurrences.practiceId, practiceId),
            eq(birthdayMessageOccurrences.campaignId, campaignId),
            eq(birthdayMessageOccurrences.status, 'pending')
          )
        );
    }
    return campaign;
  });
}

export async function deleteBirthdayCampaign(practiceId: string, campaignId: string) {
  await db.transaction(async (tx) => {
    const [campaign] = await tx
      .update(birthdayCampaigns)
      .set({ enabled: false, deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(birthdayCampaigns.practiceId, practiceId),
          eq(birthdayCampaigns.id, campaignId),
          isNull(birthdayCampaigns.deletedAt)
        )
      )
      .returning({ id: birthdayCampaigns.id });
    if (!campaign) throw new NotFoundError('Birthday campaign not found');
    await tx
      .update(birthdayMessageOccurrences)
      .set({
        status: 'skipped',
        lastErrorMessage: 'Campaign removed',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(birthdayMessageOccurrences.practiceId, practiceId),
          eq(birthdayMessageOccurrences.campaignId, campaignId),
          eq(birthdayMessageOccurrences.status, 'pending')
        )
      );
  });
}

export async function getBirthdayHistory(practiceId: string, limit = HISTORY_LIMIT) {
  const rows = await db
    .select({
      id: birthdayMessageOccurrences.id,
      campaignName: birthdayCampaigns.name,
      channel: birthdayCampaigns.channel,
      firstName: patients.firstName,
      lastName: patients.lastName,
      birthdayYear: birthdayMessageOccurrences.birthdayYear,
      scheduledFor: birthdayMessageOccurrences.scheduledFor,
      sentAt: birthdayMessageOccurrences.sentAt,
      status: birthdayMessageOccurrences.status,
      lastErrorMessage: birthdayMessageOccurrences.lastErrorMessage,
      createdAt: birthdayMessageOccurrences.createdAt,
    })
    .from(birthdayMessageOccurrences)
    .innerJoin(
      birthdayCampaigns,
      and(
        eq(birthdayMessageOccurrences.campaignId, birthdayCampaigns.id),
        eq(birthdayMessageOccurrences.practiceId, birthdayCampaigns.practiceId)
      )
    )
    .innerJoin(
      patients,
      and(
        eq(birthdayMessageOccurrences.patientId, patients.id),
        eq(birthdayMessageOccurrences.practiceId, patients.practiceId)
      )
    )
    .where(eq(birthdayMessageOccurrences.practiceId, practiceId))
    .orderBy(sql`${birthdayMessageOccurrences.scheduledFor} DESC`)
    .limit(limit);
  return rows;
}

export async function getUpcomingBirthdayMessages(practiceId: string, timeZone: string, now: Date) {
  const [campaigns, activePatients] = await Promise.all([
    db
      .select({
        id: birthdayCampaigns.id,
        name: birthdayCampaigns.name,
        channel: birthdayCampaigns.channel,
        daysBefore: birthdayCampaigns.daysBefore,
        localDeliveryTime: birthdayCampaigns.localDeliveryTime,
        eligibilityRules: birthdayCampaigns.eligibilityRules,
      })
      .from(birthdayCampaigns)
      .where(
        and(
          eq(birthdayCampaigns.practiceId, practiceId),
          eq(birthdayCampaigns.enabled, true),
          isNull(birthdayCampaigns.deletedAt)
        )
      ),
    db
      .select({
        id: patients.id,
        firstName: patients.firstName,
        lastName: patients.lastName,
        dateOfBirth: patients.dateOfBirth,
        phoneMobile: patients.phoneMobile,
        phoneHome: patients.phoneHome,
        email: patients.email,
        status: patients.status,
        smsConsent: patients.smsConsent,
        emailConsent: patients.emailConsent,
      })
      .from(patients)
      .where(
        and(
          eq(patients.practiceId, practiceId),
          eq(patients.status, 'Patient'),
          isNotNull(patients.dateOfBirth)
        )
      ),
  ]);
  const messages = campaigns
    .flatMap((campaign) =>
      activePatients.flatMap((patient) => {
        const occurrence = getNextBirthdayOccurrence({
          dateOfBirth: patient.dateOfBirth,
          daysBefore: campaign.daysBefore,
          localDeliveryTime: campaign.localDeliveryTime,
          timeZone,
          now,
        });
        if (!occurrence || !matchesAgeRules(patient.dateOfBirth, occurrence.birthdayYear, campaign.eligibilityRules)) {
          return [];
        }
        return [{
          id: `${campaign.id}:${patient.id}:${occurrence.birthdayYear}`,
          campaignId: campaign.id,
          patientId: patient.id,
          birthdayYear: occurrence.birthdayYear,
          campaignName: campaign.name,
          channel: campaign.channel,
          firstName: patient.firstName,
          lastName: patient.lastName,
          birthdayDate: dateKey(occurrence.birthdayDate),
          scheduledFor: occurrence.scheduledFor,
          eligible: getBirthdaySuppressionReason({
            patientStatus: patient.status,
            dateOfBirth: patient.dateOfBirth,
            hasConsent: campaign.channel === 'sms' ? patient.smsConsent : patient.emailConsent,
            hasDestination: campaign.channel === 'sms'
              ? Boolean(patient.phoneMobile || patient.phoneHome)
              : Boolean(patient.email),
          }) === null,
        }];
      })
    )
    .sort((left, right) => left.scheduledFor.getTime() - right.scheduledFor.getTime())
    .slice(0, UPCOMING_BIRTHDAY_MESSAGE_LIMIT);
  if (messages.length === 0) return [];

  const occurrenceRows = await db
    .select({
      id: birthdayMessageOccurrences.id,
      campaignId: birthdayMessageOccurrences.campaignId,
      patientId: birthdayMessageOccurrences.patientId,
      birthdayYear: birthdayMessageOccurrences.birthdayYear,
      scheduledFor: birthdayMessageOccurrences.scheduledFor,
      status: birthdayMessageOccurrences.status,
    })
    .from(birthdayMessageOccurrences)
    .where(and(
      eq(birthdayMessageOccurrences.practiceId, practiceId),
      or(...messages.map((message) => and(
        eq(birthdayMessageOccurrences.campaignId, message.campaignId),
        eq(birthdayMessageOccurrences.patientId, message.patientId),
        eq(birthdayMessageOccurrences.birthdayYear, message.birthdayYear)
      )))
    ));
  const occurrenceByKey = new Map(
    occurrenceRows.map((occurrence) => [
      `${occurrence.campaignId}:${occurrence.patientId}:${occurrence.birthdayYear}`,
      occurrence,
    ])
  );

  return messages.map((message) => {
    const occurrence = occurrenceByKey.get(
      `${message.campaignId}:${message.patientId}:${message.birthdayYear}`
    );
    return {
      id: occurrence?.id ?? message.id,
      campaignName: message.campaignName,
      channel: message.channel,
      firstName: message.firstName,
      lastName: message.lastName,
      birthdayDate: message.birthdayDate,
      scheduledFor: occurrence?.scheduledFor ?? message.scheduledFor,
      eligible: message.eligible,
      status: occurrence?.status === 'pending'
        ? 'scheduled'
        : occurrence?.status ?? 'scheduled',
    };
  });
}

async function getBirthdayReportCounts(practiceId: string) {
  const rows = await db
    .select({
      status: birthdayMessageOccurrences.status,
      count: sql<number>`count(*)::int`,
    })
    .from(birthdayMessageOccurrences)
    .where(eq(birthdayMessageOccurrences.practiceId, practiceId))
    .groupBy(birthdayMessageOccurrences.status);
  return rows.reduce<Record<string, number>>((result, row) => {
    result[row.status] = row.count;
    return result;
  }, {});
}

export async function previewBirthdayTemplate(input: {
  practiceId: string;
  templateId: string;
  firstName: string;
  birthdayDate?: string;
  offer?: string;
}) {
  const practice = await getPractice(input.practiceId);
  const options = await getBirthdayTemplateOptions(input.practiceId);
  const template = options.find((option) => option.id === input.templateId);
  if (!template) throw new NotFoundError('Birthday template not found');
  const birthdayDate = input.birthdayDate ?? dateKey(getLocalDateParts(new Date(), practice.timezone));
  const formattedBirthday = new Intl.DateTimeFormat('en-US', {
    timeZone: practice.timezone,
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${birthdayDate}T12:00:00`));
  const rendered = renderBirthdayContent(template.content as Record<string, unknown>, {
    firstName: input.firstName,
    lastName: 'Patient',
    email: 'patient@example.test',
    phone: '(555) 010-1000',
    practice,
    birthdayDate: formattedBirthday,
    offer: input.offer ?? '',
  });
  return {
    templateId: template.id,
    channel: template.channel,
    name: template.name,
    subject: rendered.subject,
    body: rendered.body,
    unresolved: rendered.unresolved,
  };
}

function renderBirthdayContent(
  content: Record<string, unknown>,
  input: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    practice: {
      name: string;
      phone: string | null;
      email: string | null;
      website: string | null;
      address: string | null;
    };
    birthdayDate: string;
    offer: string;
  }
) {
  return renderAppointmentTemplateContent(
    content,
    {
      patient: {
        firstName: input.firstName,
        lastName: input.lastName,
        fullName: `${input.firstName} ${input.lastName}`.trim(),
        email: input.email ?? '',
        phone: input.phone ?? '',
        birthDate: '',
      },
      practice: {
        name: input.practice.name,
        phone: input.practice.phone ?? '',
        address: input.practice.address ?? '',
        email: input.practice.email ?? undefined,
        website: input.practice.website ?? undefined,
      },
      appointment: {
        date: '',
        time: '',
        provider: '',
        status: '',
        confirmUrl: '',
      },
    },
    {
      'birthday.date': input.birthdayDate,
      'birthday.offer': input.offer,
    }
  );
}

export async function materializeBirthdayOccurrences(practiceId: string, now = new Date()) {
  const [practice] = await db
    .select({ timezone: practices.timezone })
    .from(practices)
    .where(eq(practices.id, practiceId))
    .limit(1);
  if (!practice) throw new NotFoundError('Practice not found');
  const campaigns = await db
    .select()
    .from(birthdayCampaigns)
    .where(
      and(
        eq(birthdayCampaigns.practiceId, practiceId),
        eq(birthdayCampaigns.enabled, true),
        isNull(birthdayCampaigns.deletedAt)
      )
    );
  let materialized = 0;
  for (const campaign of campaigns) {
    const activePatients = await db
      .select({
        id: patients.id,
        dateOfBirth: patients.dateOfBirth,
        status: patients.status,
      })
      .from(patients)
      .where(
        and(
          eq(patients.practiceId, practiceId),
          eq(patients.status, 'Patient'),
          isNotNull(patients.dateOfBirth)
        )
      );
    const occurrences = activePatients.flatMap((patient) => {
      const occurrence = getNextBirthdayOccurrence({
        dateOfBirth: patient.dateOfBirth,
        daysBefore: campaign.daysBefore,
        localDeliveryTime: campaign.localDeliveryTime,
        timeZone: practice.timezone,
        now,
      });
      if (!occurrence) return [];
      const rules = campaign.eligibilityRules;
      if (!matchesAgeRules(patient.dateOfBirth, occurrence.birthdayYear, rules)) return [];
      return [{
        practiceId,
        campaignId: campaign.id,
        patientId: patient.id,
        birthdayYear: occurrence.birthdayYear,
        scheduledFor: occurrence.scheduledFor,
      }];
    });
    const CHUNK_SIZE = 500;
    for (let offset = 0; offset < occurrences.length; offset += CHUNK_SIZE) {
      const inserted = await db
        .insert(birthdayMessageOccurrences)
        .values(occurrences.slice(offset, offset + CHUNK_SIZE))
        .onConflictDoUpdate({
          target: [
            birthdayMessageOccurrences.campaignId,
            birthdayMessageOccurrences.patientId,
            birthdayMessageOccurrences.birthdayYear,
          ],
          set: {
            scheduledFor: sql`excluded.scheduled_for`,
            status: 'pending',
            lastErrorMessage: null,
            updatedAt: now,
          },
          // A campaign-disabled occurrence can be re-armed if re-enabled before its birthday.
          where: and(
            eq(birthdayMessageOccurrences.attemptCount, 0),
            or(
              eq(birthdayMessageOccurrences.status, 'pending'),
              and(
                eq(birthdayMessageOccurrences.status, 'skipped'),
                eq(birthdayMessageOccurrences.lastErrorMessage, 'Campaign disabled')
              )
            )
          ),
        })
        .returning({ id: birthdayMessageOccurrences.id });
      materialized += inserted.length;
    }
  }
  return materialized;
}

function matchesAgeRules(dateOfBirth: string | null, birthdayYear: number, rules: BirthdayEligibilityRules) {
  if (rules.minimumAge === undefined && rules.maximumAge === undefined) return true;
  if (!dateOfBirth) return false;
  const birthYear = Number(dateOfBirth.slice(0, 4));
  const age = birthdayYear - birthYear;
  if (rules.minimumAge !== undefined && age < rules.minimumAge) return false;
  if (rules.maximumAge !== undefined && age > rules.maximumAge) return false;
  return true;
}

export async function processDueBirthdayOccurrences(practiceId: string, now = new Date()) {
  const staleProcessingBefore = new Date(now.getTime() - 15 * 60_000);
  await db
    .update(birthdayMessageOccurrences)
    .set({ status: 'pending', updatedAt: now })
    .where(
      and(
        eq(birthdayMessageOccurrences.practiceId, practiceId),
        eq(birthdayMessageOccurrences.status, 'processing'),
        lte(birthdayMessageOccurrences.attemptedAt, staleProcessingBefore)
      )
    );
  const due = await db
    .select({
      id: birthdayMessageOccurrences.id,
      campaignId: birthdayMessageOccurrences.campaignId,
      patientId: birthdayMessageOccurrences.patientId,
    })
    .from(birthdayMessageOccurrences)
    .where(
      and(
        eq(birthdayMessageOccurrences.practiceId, practiceId),
        eq(birthdayMessageOccurrences.status, 'pending'),
        lte(birthdayMessageOccurrences.scheduledFor, now)
      )
    )
    .limit(MAX_DISPATCH_BATCH);
  const result = { processed: 0, sent: 0, failed: 0, skipped: 0 };
  for (const occurrence of due) {
    const [claimed] = await db
      .update(birthdayMessageOccurrences)
      .set({
        status: 'processing',
        attemptedAt: now,
        attemptCount: sql`${birthdayMessageOccurrences.attemptCount} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(birthdayMessageOccurrences.id, occurrence.id),
          eq(birthdayMessageOccurrences.practiceId, practiceId),
          eq(birthdayMessageOccurrences.status, 'pending')
        )
      )
      .returning({ id: birthdayMessageOccurrences.id });
    if (!claimed) continue;
    result.processed++;

    try {
      const outcome = await dispatchBirthdayOccurrence(
        practiceId,
        occurrence.id,
        occurrence.campaignId,
        occurrence.patientId,
        now
      );
      if (outcome === 'sent') result.sent++;
      else result.skipped++;
    } catch {
      const [current] = await db
        .select({ attemptCount: birthdayMessageOccurrences.attemptCount })
        .from(birthdayMessageOccurrences)
        .where(eq(birthdayMessageOccurrences.id, occurrence.id))
        .limit(1);
      const retry = (current?.attemptCount ?? MAX_SEND_ATTEMPTS) < MAX_SEND_ATTEMPTS;
      await db
        .update(birthdayMessageOccurrences)
        .set({
          status: retry ? 'pending' : 'failed',
          scheduledFor: retry ? new Date(now.getTime() + 5 * 60_000) : undefined,
          lastErrorMessage: retry ? 'Provider request failed; retry scheduled' : 'Provider request failed',
          updatedAt: now,
        })
        .where(eq(birthdayMessageOccurrences.id, occurrence.id));
      if (!retry) result.failed++;
      logError(
        'Birthday message dispatch failed',
        new Error('Birthday provider request failed'),
        { practiceId, campaignId: occurrence.campaignId }
      );
    }
  }
  return result;
}

async function dispatchBirthdayOccurrence(
  practiceId: string,
  occurrenceId: string,
  campaignId: string,
  patientId: string,
  now: Date
): Promise<'sent' | 'skipped'> {
  const [record] = await db
    .select({
      campaign: birthdayCampaigns,
      patient: patients,
      practice: practices,
      template: templates,
    })
    .from(birthdayCampaigns)
    .innerJoin(
      patients,
      and(eq(patients.id, patientId), eq(patients.practiceId, birthdayCampaigns.practiceId))
    )
    .innerJoin(practices, eq(practices.id, birthdayCampaigns.practiceId))
    .leftJoin(
      templates,
      and(
        eq(templates.id, birthdayCampaigns.templateId),
        isNull(templates.deletedAt),
        or(eq(templates.practiceId, practiceId), eq(templates.isSystem, true))
      )
    )
    .where(
      and(
        eq(birthdayCampaigns.id, campaignId),
        eq(birthdayCampaigns.practiceId, practiceId),
        eq(patients.id, patientId),
        eq(birthdayCampaigns.enabled, true),
        isNull(birthdayCampaigns.deletedAt),
        isNotNull(patients.dateOfBirth)
      )
    )
    .limit(1);

  if (!record)   return markBirthdaySkipped(occurrenceId, practiceId, now, 'Campaign or patient is no longer eligible');

  const patient = record.patient;
  const campaign = record.campaign;
  const template = record.template;
  if (!(await isPracticeChannelEnabled(practiceId, campaign.channel))) {
    return markBirthdaySkipped(occurrenceId, practiceId, now, 'Practice channel is disabled');
  }
  const hasConsent = campaign.channel === 'sms' ? patient.smsConsent : patient.emailConsent;
  const destination = campaign.channel === 'sms'
    ? patient.phoneMobile || patient.phoneHome
    : patient.email;
  const suppressionReason = getBirthdaySuppressionReason({
    patientStatus: patient.status,
    dateOfBirth: patient.dateOfBirth,
    hasConsent,
    hasDestination: Boolean(destination),
  });
  if (suppressionReason) {
    return markBirthdaySkipped(
      occurrenceId,
      practiceId,
      now,
      suppressionReason
    );
  }
  if (!destination) {
    return markBirthdaySkipped(occurrenceId, practiceId, now, 'Patient has no contact for this channel');
  }

  if (
    !template ||
    template.status !== 'published' ||
    template.channel !== campaign.channel
  ) {
    return markBirthdaySkipped(occurrenceId, practiceId, now, 'Birthday template is unavailable');
  }
  const [category] = await db
    .select({ id: templateCategories.id })
    .from(templateCategories)
    .where(and(eq(templateCategories.id, template.categoryId), eq(templateCategories.slug, 'birthdays')))
    .limit(1);
  if (!category || (template.practiceId !== null && template.practiceId !== practiceId)) {
    return markBirthdaySkipped(occurrenceId, practiceId, now, 'Birthday template is unavailable');
  }

  const [occurrence] = await db
    .select({
      id: birthdayMessageOccurrences.id,
      birthdayYear: birthdayMessageOccurrences.birthdayYear,
      scheduledFor: birthdayMessageOccurrences.scheduledFor,
    })
    .from(birthdayMessageOccurrences)
    .where(and(
      eq(birthdayMessageOccurrences.id, occurrenceId),
      eq(birthdayMessageOccurrences.practiceId, practiceId),
      eq(birthdayMessageOccurrences.status, 'processing')
    ))
    .limit(1);
  if (!occurrence) return 'skipped';
  const expectedOccurrence = getNextBirthdayOccurrence({
    dateOfBirth: patient.dateOfBirth,
    daysBefore: campaign.daysBefore,
    localDeliveryTime: campaign.localDeliveryTime,
    timeZone: record.practice.timezone,
    now: new Date(occurrence.scheduledFor.getTime() - 1),
  });
  if (
    !expectedOccurrence ||
    expectedOccurrence.birthdayYear !== occurrence.birthdayYear ||
    expectedOccurrence.scheduledFor.getTime() !== occurrence.scheduledFor.getTime()
  ) {
    return markBirthdaySkipped(occurrenceId, practiceId, now, 'Patient birthday details changed before dispatch');
  }

  const birthdayDate = getBirthdayInYear(patient.dateOfBirth, occurrence.birthdayYear);
  if (!birthdayDate) {
    return markBirthdaySkipped(occurrenceId, practiceId, now, 'Patient birthdate is unavailable');
  }
  const formattedBirthday = new Intl.DateTimeFormat('en-US', {
    timeZone: record.practice.timezone,
    month: 'long',
    day: 'numeric',
  }).format(new Date(Date.UTC(birthdayDate.year, birthdayDate.month - 1, birthdayDate.day, 12)));
  if (!matchesAgeRules(patient.dateOfBirth, occurrence.birthdayYear, campaign.eligibilityRules)) {
    return markBirthdaySkipped(occurrenceId, practiceId, now, 'Patient does not match campaign eligibility rules');
  }
  const rendered = renderBirthdayContent(template.content as Record<string, unknown>, {
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email,
    phone: patient.phoneMobile ?? patient.phoneHome,
    practice: record.practice,
    birthdayDate: formattedBirthday,
    offer: campaign.offerText ?? '',
  });
  if (rendered.unresolved.length > 0 || !rendered.body.trim() || (campaign.channel === 'email' && !rendered.subject.trim())) {
    return markBirthdaySkipped(occurrenceId, practiceId, now, 'Birthday template contains unresolved variables');
  }
  const adapter = getAdapter(campaign.channel);
  const sendResult = await sendReminderWithAdapter(adapter, {
    to: destination,
    body: rendered.body,
    subject: rendered.subject || undefined,
    html: campaign.channel === 'email' ? rendered.html : undefined,
    idempotencyKey: occurrence.id,
  });
  if (!sendResult.accepted) throw new Error(sendResult.failureReason);

  await db
    .update(birthdayMessageOccurrences)
    .set({
      status: 'sent',
      sentAt: now,
      providerMessageId: sendResult.providerMessageId,
      lastErrorMessage: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(birthdayMessageOccurrences.id, occurrence.id),
        eq(birthdayMessageOccurrences.practiceId, practiceId),
        eq(birthdayMessageOccurrences.status, 'processing')
      )
    );
  return 'sent';
}

async function markBirthdaySkipped(
  occurrenceId: string,
  practiceId: string,
  now: Date,
  reason: string
): Promise<'skipped'> {
  await db
    .update(birthdayMessageOccurrences)
    .set({ status: 'skipped', lastErrorMessage: reason, updatedAt: now })
    .where(
      and(
        eq(birthdayMessageOccurrences.practiceId, practiceId),
        eq(birthdayMessageOccurrences.id, occurrenceId),
        eq(birthdayMessageOccurrences.status, 'processing')
      )
    );
  return 'skipped';
}

export async function processBirthdayCampaigns(practiceId: string, now = new Date()) {
  const materialized = await materializeBirthdayOccurrences(practiceId, now);
  const processed = await processDueBirthdayOccurrences(practiceId, now);
  return { materialized, ...processed };
}
