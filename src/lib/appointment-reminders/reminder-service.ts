import 'server-only';
import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { appointmentReminders, appointmentReminderSchedules } from '@/db/schema/appointment_reminders';
import { appointments } from '@/db/schema/appointments';
import { patients } from '@/db/schema/patients';
import { practices } from '@/db/schema/practices';
import { templateCategories, templates } from '@/db/schema/templates';
import { AppError, NotFoundError } from '@/lib/errors';
import { getAdapter } from '@/lib/messaging/stub-adapter';
import {
  buildAppointmentTemplateContext,
  calculateReminderTime,
  getReminderSuppressionReason,
  isEligibleAppointment,
  isRenderedAppointmentTemplateValid,
  renderAppointmentTemplateContent,
  sendReminderWithAdapter,
  type ReminderIntervalValue,
} from './reminder-utils';

export interface ReminderScheduleInput {
  name: string;
  interval: ReminderIntervalValue;
  channel: 'sms' | 'email';
  localSendTime: string;
  templateId: string;
  enabled: boolean;
}

export async function getReminderDashboard(practiceId: string, now = new Date()) {
  const [practice] = await db
    .select({
      name: practices.name,
      phone: practices.phone,
      address: practices.address,
      timezone: practices.timezone,
    })
    .from(practices)
    .where(eq(practices.id, practiceId))
    .limit(1);
  if (!practice) throw new NotFoundError('Practice not found');

  const scheduleRows = await db
    .select({
      id: appointmentReminderSchedules.id,
      name: appointmentReminderSchedules.name,
      interval: appointmentReminderSchedules.interval,
      channel: appointmentReminderSchedules.channel,
      localSendTime: appointmentReminderSchedules.localSendTime,
      templateId: appointmentReminderSchedules.templateId,
      enabled: appointmentReminderSchedules.enabled,
      createdAt: appointmentReminderSchedules.createdAt,
      templateName: templates.name,
    })
    .from(appointmentReminderSchedules)
    .leftJoin(templates, eq(appointmentReminderSchedules.templateId, templates.id))
    .where(eq(appointmentReminderSchedules.practiceId, practiceId))
    .orderBy(asc(appointmentReminderSchedules.createdAt));

  const appointmentRows = await db
    .select({
      id: appointments.id,
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
      description: appointments.description,
      patientId: patients.id,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientStatus: patients.status,
      smsConsent: patients.smsConsent,
      emailConsent: patients.emailConsent,
      hasSmsNumber: sql<boolean>`(${patients.phoneMobile} IS NOT NULL OR ${patients.phoneHome} IS NOT NULL)`,
      hasEmail: sql<boolean>`(${patients.email} IS NOT NULL)`,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(
      and(
        eq(appointments.practiceId, practiceId),
        eq(appointments.status, 'Scheduled'),
        eq(patients.status, 'Patient'),
        gt(appointments.scheduledAt, now),
        lte(appointments.scheduledAt, new Date(now.getTime() + 30 * 24 * 60 * 60_000))
      )
    )
    .orderBy(asc(appointments.scheduledAt))
    .limit(500);

  const upcomingIds = appointmentRows.map((appointment) => appointment.id);
  const scheduleIds = scheduleRows.map((schedule) => schedule.id);
  const occurrenceRows =
    upcomingIds.length > 0 && scheduleIds.length > 0
      ? await db
          .select({
            id: appointmentReminders.id,
            appointmentId: appointmentReminders.appointmentId,
            scheduleId: appointmentReminders.scheduleId,
            status: appointmentReminders.status,
            scheduledFor: appointmentReminders.scheduledFor,
            lastErrorMessage: appointmentReminders.lastErrorMessage,
          })
          .from(appointmentReminders)
          .where(
            and(
              eq(appointmentReminders.practiceId, practiceId),
              inArray(appointmentReminders.appointmentId, upcomingIds),
              inArray(appointmentReminders.scheduleId, scheduleIds)
            )
          )
      : [];
  const occurrenceByKey = new Map(
    occurrenceRows.map((reminder) => [`${reminder.appointmentId}:${reminder.scheduleId}`, reminder])
  );

  const upcoming = appointmentRows.flatMap((appointment) =>
    scheduleRows
      .filter((schedule) => schedule.enabled)
      .map((schedule) => {
        const scheduledFor = calculateReminderTime(
          appointment.scheduledAt,
          schedule.interval as ReminderIntervalValue,
          practice.timezone,
          schedule.localSendTime
        );
        const existing = occurrenceByKey.get(`${appointment.id}:${schedule.id}`);
        const hasConsent = schedule.channel === 'sms' ? appointment.smsConsent : appointment.emailConsent;
        const hasContact = schedule.channel === 'sms' ? appointment.hasSmsNumber : appointment.hasEmail;
        return {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          patientName: `${appointment.patientFirstName} ${appointment.patientLastName}`.trim(),
          scheduledAt: appointment.scheduledAt,
          appointmentStatus: appointment.status,
          description: appointment.description,
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          interval: schedule.interval,
          channel: schedule.channel,
          reminderAt: existing?.scheduledFor ?? scheduledFor,
          reminderStatus: existing?.status ?? (scheduledFor <= now ? 'due' : 'scheduled'),
          lastErrorMessage: existing?.lastErrorMessage ?? null,
          eligible: hasConsent && hasContact && appointment.patientStatus === 'Patient',
        };
      })
  );

  const history = await db
    .select({
      id: appointmentReminders.id,
      patientName: sql<string>`concat(${patients.firstName}, ' ', ${patients.lastName})`,
      appointmentAt: appointments.scheduledAt,
      scheduleName: appointmentReminderSchedules.name,
      channel: appointmentReminders.channel,
      status: appointmentReminders.status,
      attemptCount: appointmentReminders.attemptCount,
      attemptedAt: appointmentReminders.attemptedAt,
      sentAt: appointmentReminders.sentAt,
      deliveredAt: appointmentReminders.deliveredAt,
      providerMessageId: appointmentReminders.providerMessageId,
      lastErrorMessage: appointmentReminders.lastErrorMessage,
      scheduledFor: appointmentReminders.scheduledFor,
      manual: appointmentReminders.manual,
    })
    .from(appointmentReminders)
    .innerJoin(
      appointmentReminderSchedules,
      and(
        eq(appointmentReminders.scheduleId, appointmentReminderSchedules.id),
        eq(appointmentReminders.practiceId, appointmentReminderSchedules.practiceId)
      )
    )
    .innerJoin(
      appointments,
      and(
        eq(appointmentReminders.appointmentId, appointments.id),
        eq(appointmentReminders.practiceId, appointments.practiceId)
      )
    )
    .innerJoin(
      patients,
      and(
        eq(appointmentReminders.patientId, patients.id),
        eq(appointmentReminders.practiceId, patients.practiceId)
      )
    )
    .where(eq(appointmentReminders.practiceId, practiceId))
    .orderBy(desc(appointmentReminders.createdAt))
    .limit(100);

  const [stats] = await db
    .select({
      scheduled: sql<number>`count(*) FILTER (WHERE ${appointmentReminders.status} = 'pending')::int`,
      attempted: sql<number>`count(*) FILTER (WHERE ${appointmentReminders.attemptedAt} IS NOT NULL)::int`,
      sent: sql<number>`count(*) FILTER (WHERE ${appointmentReminders.status} IN ('sent', 'delivered'))::int`,
      delivered: sql<number>`count(*) FILTER (WHERE ${appointmentReminders.status} = 'delivered')::int`,
      failed: sql<number>`count(*) FILTER (WHERE ${appointmentReminders.status} = 'failed')::int`,
      skipped: sql<number>`count(*) FILTER (WHERE ${appointmentReminders.status} = 'skipped')::int`,
    })
    .from(appointmentReminders)
    .where(eq(appointmentReminders.practiceId, practiceId));

  return {
    practice,
    schedules: scheduleRows,
    upcoming: upcoming.sort((a, b) => a.reminderAt.getTime() - b.reminderAt.getTime()).slice(0, 500),
    history,
    stats: stats ?? { scheduled: 0, attempted: 0, sent: 0, delivered: 0, failed: 0, skipped: 0 },
    providerAvailability: {
      sms: getAdapter('sms').configured,
      email: getAdapter('email').configured,
    },
  };
}

export async function createReminderSchedule(
  practiceId: string,
  userId: string,
  input: ReminderScheduleInput
) {
  await validateScheduleTemplate(practiceId, input.templateId, input.channel);
  validateLocalSendTime(input.localSendTime);
  const [schedule] = await db
    .insert(appointmentReminderSchedules)
    .values({ practiceId, createdBy: userId, ...input })
    .returning();
  return schedule;
}

export async function updateReminderSchedule(
  practiceId: string,
  scheduleId: string,
  input: Partial<ReminderScheduleInput>
) {
  const existing = await getSchedule(practiceId, scheduleId);
  const channel = input.channel ?? existing.channel;
  const templateId = input.templateId ?? existing.templateId;
  if (!templateId) throw new AppError(400, 'A reminder template must be selected', 'TEMPLATE_REQUIRED');
  await validateScheduleTemplate(practiceId, templateId, channel);
  if (input.localSendTime) validateLocalSendTime(input.localSendTime);

  const [updated] = await db
    .update(appointmentReminderSchedules)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(
        eq(appointmentReminderSchedules.id, scheduleId),
        eq(appointmentReminderSchedules.practiceId, practiceId)
      )
    )
    .returning();
  return updated;
}

export async function getReminderTemplateOptions(practiceId: string) {
  return db
    .select({
      id: templates.id,
      name: templates.name,
      channel: templates.channel,
      templateType: templates.templateType,
      status: templates.status,
      isSystem: templates.isSystem,
      practiceId: templates.practiceId,
    })
    .from(templates)
    .innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
    .where(
      and(
        eq(templateCategories.slug, 'appointment-reminders'),
        eq(templates.status, 'published'),
        isNull(templates.deletedAt),
        or(eq(templates.practiceId, practiceId), eq(templates.isSystem, true))
      )
    )
    .orderBy(asc(templates.name));
}

export async function previewAppointmentReminder(
  practiceId: string,
  appointmentId: string,
  templateId: string
) {
  const contextRow = await getAppointmentContext(practiceId, appointmentId);
  const template = await getAppointmentTemplate(practiceId, templateId);
  if (template.channel !== 'sms' && template.channel !== 'email') {
    throw new AppError(400, 'Only SMS and email templates can be used for appointment reminders', 'INVALID_CHANNEL');
  }
  const context = buildAppointmentTemplateContext({
    patient: {
      firstName: contextRow.patientFirstName,
      lastName: contextRow.patientLastName,
      email: contextRow.email,
      phone: contextRow.phoneMobile ?? contextRow.phoneHome,
      birthDate: contextRow.birthDate,
    },
    practice: {
      name: contextRow.practiceName,
      phone: contextRow.practicePhone,
      address: contextRow.practiceAddress,
    },
    appointment: {
      scheduledAt: contextRow.scheduledAt,
      providerName: null,
      status: contextRow.status,
    },
    timeZone: contextRow.timezone,
  });
  const rendered = renderAppointmentTemplateContent(template.content as Record<string, unknown>, context);
  return {
    templateId: template.id,
    templateName: template.name,
    channel: template.channel,
    subject: rendered.subject,
    body: rendered.body,
    unresolved: rendered.unresolved,
    isValid: isRenderedAppointmentTemplateValid(rendered, template.channel),
  };
}

export async function queueManualAppointmentReminder(input: {
  practiceId: string;
  scheduleId: string;
  appointmentId: string;
}) {
  const schedule = await getSchedule(input.practiceId, input.scheduleId);
  if (!schedule.enabled) throw new AppError(409, 'Enable this reminder schedule before sending manually', 'SCHEDULE_DISABLED');

  const appointment = await getAppointmentContext(input.practiceId, input.appointmentId);
  if (!isEligibleAppointment(appointment.status, appointment.patientStatus)) {
    throw new AppError(409, 'Only active patients with scheduled appointments are eligible', 'APPOINTMENT_INELIGIBLE');
  }
  if (appointment.scheduledAt <= new Date()) {
    throw new AppError(409, 'The appointment time has passed', 'APPOINTMENT_PASSED');
  }

  const [inserted] = await db
    .insert(appointmentReminders)
    .values({
      practiceId: input.practiceId,
      scheduleId: schedule.id,
      appointmentId: input.appointmentId,
      patientId: appointment.patientId,
      channel: schedule.channel,
      scheduledFor: new Date(),
      manual: true,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted) return inserted;

  const existing = await db
    .select()
    .from(appointmentReminders)
    .where(
      and(
        eq(appointmentReminders.practiceId, input.practiceId),
        eq(appointmentReminders.appointmentId, input.appointmentId),
        eq(appointmentReminders.scheduleId, schedule.id),
        eq(appointmentReminders.patientId, appointment.patientId),
        eq(appointmentReminders.channel, schedule.channel)
      )
    )
    .limit(1);
  const reminder = existing[0];
  if (!reminder || reminder.status !== 'pending') {
    throw new AppError(409, 'A reminder for this appointment and schedule has already been attempted', 'REMINDER_ALREADY_ATTEMPTED');
  }

  const [queued] = await db
    .update(appointmentReminders)
    .set({ scheduledFor: new Date(), manual: true, updatedAt: new Date() })
    .where(
      and(
        eq(appointmentReminders.id, reminder.id),
        eq(appointmentReminders.practiceId, input.practiceId),
        eq(appointmentReminders.status, 'pending')
      )
    )
    .returning();
  return queued ?? reminder;
}

export async function executeManualAppointmentReminder(input: {
  practiceId: string;
  scheduleId: string;
  appointmentId: string;
}) {
  const reminder = await queueManualAppointmentReminder(input);
  if (reminder.status !== 'pending') {
    throw new AppError(409, 'This reminder has already been processed', 'REMINDER_ALREADY_ATTEMPTED');
  }

  await dispatchAppointmentReminder(reminder.id, input.practiceId, new Date());
  const [updated] = await db
    .select({
      id: appointmentReminders.id,
      status: appointmentReminders.status,
      attemptedAt: appointmentReminders.attemptedAt,
      sentAt: appointmentReminders.sentAt,
      lastErrorMessage: appointmentReminders.lastErrorMessage,
    })
    .from(appointmentReminders)
    .where(
      and(
        eq(appointmentReminders.id, reminder.id),
        eq(appointmentReminders.practiceId, input.practiceId)
      )
    )
    .limit(1);
  return updated ?? reminder;
}

export async function processDueAppointmentReminders(input: {
  practiceId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const staleProcessingBefore = new Date(now.getTime() - 15 * 60_000);
  const staleConditions = [
    eq(appointmentReminders.practiceId, input.practiceId),
    eq(appointmentReminders.status, 'processing'),
    lte(appointmentReminders.updatedAt, staleProcessingBefore),
  ];
  await db
    .update(appointmentReminders)
    .set({ status: 'pending', updatedAt: now })
    .where(and(...staleConditions));

  const schedules = await db
    .select({
      id: appointmentReminderSchedules.id,
      practiceId: appointmentReminderSchedules.practiceId,
      interval: appointmentReminderSchedules.interval,
      localSendTime: appointmentReminderSchedules.localSendTime,
      channel: appointmentReminderSchedules.channel,
    })
    .from(appointmentReminderSchedules)
    .where(
      and(
        eq(appointmentReminderSchedules.practiceId, input.practiceId),
        eq(appointmentReminderSchedules.enabled, true)
      )
    );

  let upserted = 0;
  for (const schedule of schedules) {
    const [practice] = await db
      .select({ timezone: practices.timezone })
      .from(practices)
      .where(eq(practices.id, schedule.practiceId))
      .limit(1);
    if (!practice) continue;

    for (let offset = 0; ; ) {
      const candidates = await db
        .select({
          appointmentId: appointments.id,
          patientId: patients.id,
          scheduledAt: appointments.scheduledAt,
        })
        .from(appointments)
        .innerJoin(
          patients,
          and(eq(appointments.patientId, patients.id), eq(appointments.practiceId, patients.practiceId))
        )
        .where(
          and(
            eq(appointments.practiceId, schedule.practiceId),
            eq(appointments.status, 'Scheduled'),
            eq(patients.status, 'Patient'),
            gt(appointments.scheduledAt, now),
            lte(appointments.scheduledAt, new Date(now.getTime() + 30 * 24 * 60 * 60_000))
          )
        )
        .orderBy(asc(appointments.scheduledAt), asc(appointments.id))
        .limit(1000)
        .offset(offset);
      if (candidates.length === 0) break;

      const occurrences = candidates.map((appointment) => ({
        practiceId: schedule.practiceId,
        scheduleId: schedule.id,
        appointmentId: appointment.appointmentId,
        patientId: appointment.patientId,
        channel: schedule.channel,
        scheduledFor: calculateReminderTime(
          appointment.scheduledAt,
          schedule.interval as ReminderIntervalValue,
          practice.timezone,
          schedule.localSendTime
        ),
      }));
      const rows = await db
        .insert(appointmentReminders)
        .values(occurrences)
        .onConflictDoUpdate({
          target: [
            appointmentReminders.appointmentId,
            appointmentReminders.scheduleId,
            appointmentReminders.channel,
            appointmentReminders.patientId,
          ],
          set: {
            scheduledFor: sql`excluded.scheduled_for`,
            updatedAt: now,
          },
          setWhere: and(
            eq(appointmentReminders.status, 'pending'),
            eq(appointmentReminders.manual, false)
          ),
        })
        .returning({ id: appointmentReminders.id });
      upserted += rows.length;
      if (candidates.length < 1000) break;
      offset += candidates.length;
    }
  }

  const pendingConditions = [
    eq(appointmentReminders.practiceId, input.practiceId),
    eq(appointmentReminders.status, 'pending'),
    lte(appointmentReminders.scheduledFor, now),
  ];
  const pending = await db
    .select({ id: appointmentReminders.id, practiceId: appointmentReminders.practiceId })
    .from(appointmentReminders)
    .where(and(...pendingConditions))
    .orderBy(asc(appointmentReminders.scheduledFor))
    .limit(500);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const reminder of pending) {
    const result = await dispatchAppointmentReminder(reminder.id, reminder.practiceId, now);
    if (result === 'sent') sent++;
    if (result === 'failed') failed++;
    if (result === 'skipped') skipped++;
  }
  return { upserted, processed: pending.length, sent, failed, skipped };
}

async function dispatchAppointmentReminder(reminderId: string, practiceId: string, now: Date) {
  const [claimed] = await db
    .update(appointmentReminders)
    .set({
      status: 'processing',
      updatedAt: now,
    })
    .where(
      and(
        eq(appointmentReminders.id, reminderId),
        eq(appointmentReminders.practiceId, practiceId),
        eq(appointmentReminders.status, 'pending'),
        lte(appointmentReminders.scheduledFor, now)
      )
    )
    .returning({ id: appointmentReminders.id });
  if (!claimed) return 'skipped' as const;

  const [record] = await db
    .select({
      reminderId: appointmentReminders.id,
      practiceId: appointmentReminders.practiceId,
      appointmentId: appointments.id,
      patientId: patients.id,
      scheduledFor: appointmentReminders.scheduledFor,
      manual: appointmentReminders.manual,
      channel: appointmentReminders.channel,
      appointmentAt: appointments.scheduledAt,
      appointmentStatus: appointments.status,
      patientStatus: patients.status,
      firstName: patients.firstName,
      lastName: patients.lastName,
      email: patients.email,
      phoneMobile: patients.phoneMobile,
      phoneHome: patients.phoneHome,
      smsConsent: patients.smsConsent,
      emailConsent: patients.emailConsent,
      birthDate: patients.dateOfBirth,
      scheduleId: appointmentReminderSchedules.id,
      scheduleInterval: appointmentReminderSchedules.interval,
      scheduleSendTime: appointmentReminderSchedules.localSendTime,
      scheduleEnabled: appointmentReminderSchedules.enabled,
      templateId: appointmentReminderSchedules.templateId,
      practiceName: practices.name,
      practicePhone: practices.phone,
      practiceAddress: practices.address,
      timezone: practices.timezone,
    })
    .from(appointmentReminders)
    .innerJoin(
      appointmentReminderSchedules,
      and(
        eq(appointmentReminders.scheduleId, appointmentReminderSchedules.id),
        eq(appointmentReminders.practiceId, appointmentReminderSchedules.practiceId)
      )
    )
    .innerJoin(
      appointments,
      and(
        eq(appointmentReminders.appointmentId, appointments.id),
        eq(appointmentReminders.practiceId, appointments.practiceId)
      )
    )
    .innerJoin(
      patients,
      and(
        eq(appointmentReminders.patientId, patients.id),
        eq(appointmentReminders.practiceId, patients.practiceId)
      )
    )
    .innerJoin(practices, eq(appointmentReminders.practiceId, practices.id))
    .where(
      and(
        eq(appointmentReminders.id, reminderId),
        eq(appointmentReminders.practiceId, practiceId)
      )
    )
    .limit(1);

  if (!record) return await finishReminder(practiceId, reminderId, 'failed', 'Reminder record could not be loaded');
  if (!record.scheduleEnabled || !isEligibleAppointment(record.appointmentStatus, record.patientStatus)) {
    return await finishReminder(practiceId, reminderId, 'skipped', 'Appointment or patient is no longer eligible');
  }

  if (!record.manual) {
    let currentReminderAt: Date;
    try {
      currentReminderAt = calculateReminderTime(
        record.appointmentAt,
        record.scheduleInterval as ReminderIntervalValue,
        record.timezone,
        record.scheduleSendTime
      );
    } catch (error) {
      if (error instanceof RangeError) {
        return await finishReminder(practiceId, reminderId, 'failed', 'Practice timezone or reminder time is invalid');
      }
      throw error;
    }
    if (record.appointmentAt <= now) {
      return await finishReminder(practiceId, reminderId, 'skipped', 'Appointment time has passed');
    }
    if (currentReminderAt > now) {
      await db
        .update(appointmentReminders)
        .set({ status: 'pending', scheduledFor: currentReminderAt, updatedAt: now })
        .where(
          and(
            eq(appointmentReminders.id, reminderId),
            eq(appointmentReminders.practiceId, record.practiceId)
          )
        );
      return 'skipped' as const;
    }
  }

  const hasConsent = record.channel === 'sms' ? record.smsConsent : record.emailConsent;
  const destination = record.channel === 'sms'
    ? record.phoneMobile ?? record.phoneHome
    : record.email;
  const suppressionReason = getReminderSuppressionReason({
    appointmentStatus: record.appointmentStatus,
    patientStatus: record.patientStatus,
    hasConsent,
    hasDestination: Boolean(destination),
  });
  if (suppressionReason) {
    return await finishReminder(practiceId, reminderId, 'skipped', suppressionReason);
  }
  if (!destination) {
    return await finishReminder(practiceId, reminderId, 'skipped', 'Patient has no contact for this channel');
  }
  if (!record.templateId) return await finishReminder(practiceId, reminderId, 'failed', 'Reminder schedule has no template');

  let template;
  try {
    template = await getAppointmentTemplate(record.practiceId, record.templateId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return await finishReminder(practiceId, reminderId, 'failed', 'Reminder template is no longer available');
    }
    throw error;
  }
  if (template.channel !== record.channel) {
    return await finishReminder(practiceId, reminderId, 'failed', 'Template channel does not match the reminder schedule');
  }
  const context = buildAppointmentTemplateContext({
    patient: {
      firstName: record.firstName,
      lastName: record.lastName,
      email: record.email,
      phone: record.phoneMobile ?? record.phoneHome,
      birthDate: record.birthDate,
    },
    practice: {
      name: record.practiceName,
      phone: record.practicePhone,
      address: record.practiceAddress,
    },
    appointment: {
      scheduledAt: record.appointmentAt,
      providerName: null,
      status: record.appointmentStatus,
    },
    timeZone: record.timezone,
  });
  const rendered = renderAppointmentTemplateContent(template.content as Record<string, unknown>, context);
  if (!isRenderedAppointmentTemplateValid(rendered, record.channel)) {
    const reason = rendered.unresolved.length > 0
      ? `Missing required template variables: ${rendered.unresolved.join(', ')}`
      : record.channel === 'email' && !rendered.subject.trim()
        ? 'Email template has no subject'
        : 'Template has no message body';
    return await finishReminder(practiceId, reminderId, 'failed', reason);
  }

  const adapter = getAdapter(record.channel);
  if (!adapter.configured) {
    return await finishReminder(practiceId, reminderId, 'failed', `No ${record.channel.toUpperCase()} provider is configured`);
  }

  const [attemptStarted] = await db
    .update(appointmentReminders)
    .set({
      attemptCount: sql`${appointmentReminders.attemptCount} + 1`,
      attemptedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(appointmentReminders.id, reminderId),
        eq(appointmentReminders.practiceId, record.practiceId),
        eq(appointmentReminders.status, 'processing')
      )
    )
    .returning({ id: appointmentReminders.id });
  if (!attemptStarted) return 'skipped' as const;

  const outcome = await sendReminderWithAdapter(adapter, {
    to: destination,
    body: rendered.body,
    subject: rendered.subject || undefined,
    idempotencyKey: reminderId,
  });
  if (!outcome.accepted) {
    return await finishReminder(practiceId, reminderId, 'failed', outcome.failureReason);
  }

  await db
    .update(appointmentReminders)
    .set({
      status: 'sent',
      providerMessageId: outcome.providerMessageId,
      sentAt: now,
      lastErrorMessage: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(appointmentReminders.id, reminderId),
        eq(appointmentReminders.practiceId, record.practiceId),
        eq(appointmentReminders.status, 'processing')
      )
    );
  return 'sent' as const;
}

async function finishReminder(
  practiceId: string,
  reminderId: string,
  status: 'failed' | 'skipped',
  reason: string
): Promise<'failed' | 'skipped'> {
  await db
    .update(appointmentReminders)
    .set({ status, lastErrorMessage: reason, updatedAt: new Date() })
    .where(
      and(
        eq(appointmentReminders.id, reminderId),
        eq(appointmentReminders.practiceId, practiceId),
        eq(appointmentReminders.status, 'processing')
      )
    );
  return status;
}

async function getSchedule(practiceId: string, scheduleId: string) {
  const [schedule] = await db
    .select()
    .from(appointmentReminderSchedules)
    .where(
      and(
        eq(appointmentReminderSchedules.practiceId, practiceId),
        eq(appointmentReminderSchedules.id, scheduleId)
      )
    )
    .limit(1);
  if (!schedule) throw new NotFoundError('Reminder schedule not found');
  return schedule;
}

async function getAppointmentTemplate(practiceId: string, templateId: string) {
  const [template] = await db
    .select({
      id: templates.id,
      name: templates.name,
      channel: templates.channel,
      content: templates.content,
      status: templates.status,
    })
    .from(templates)
    .innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
    .where(
      and(
        eq(templates.id, templateId),
        eq(templateCategories.slug, 'appointment-reminders'),
        isNull(templates.deletedAt),
        or(eq(templates.practiceId, practiceId), eq(templates.isSystem, true))
      )
    )
    .limit(1);
  if (!template || template.status !== 'published') {
    throw new NotFoundError('Published appointment reminder template not found');
  }
  return template;
}

async function validateScheduleTemplate(practiceId: string, templateId: string, channel: 'sms' | 'email') {
  const template = await getAppointmentTemplate(practiceId, templateId);
  if (template.channel !== channel) {
    throw new AppError(400, 'Template channel must match the reminder schedule', 'TEMPLATE_CHANNEL_MISMATCH');
  }
}

async function getAppointmentContext(practiceId: string, appointmentId: string) {
  const [record] = await db
    .select({
      appointmentId: appointments.id,
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
      patientId: patients.id,
      patientStatus: patients.status,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      email: patients.email,
      phoneMobile: patients.phoneMobile,
      phoneHome: patients.phoneHome,
      birthDate: patients.dateOfBirth,
      practiceName: practices.name,
      practicePhone: practices.phone,
      practiceAddress: practices.address,
      timezone: practices.timezone,
    })
    .from(appointments)
    .innerJoin(
      patients,
      and(eq(appointments.patientId, patients.id), eq(appointments.practiceId, patients.practiceId))
    )
    .innerJoin(practices, eq(appointments.practiceId, practices.id))
    .where(and(eq(appointments.practiceId, practiceId), eq(appointments.id, appointmentId)))
    .limit(1);
  if (!record) throw new NotFoundError('Appointment not found');
  return record;
}

function validateLocalSendTime(localSendTime: string) {
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(localSendTime)) {
    throw new AppError(400, 'Local send time must use HH:mm format', 'INVALID_LOCAL_SEND_TIME');
  }
}
