import { describe, expect, it } from 'vitest';
import {
  buildAppointmentTemplateContext,
  calculateReminderTime,
  getSampleAppointmentTimes,
  getReminderSuppressionReason,
  isEligibleAppointment,
  isRenderedAppointmentTemplateValid,
  isAppointmentDateTimeMatch,
  isProviderSendAccepted,
  renderAppointmentTemplateContent,
  sendReminderWithAdapter,
} from './reminder-utils';

describe('appointment reminder utilities', () => {
  it('creates ten sample appointment times across five days at two appointments per day', () => {
    const now = new Date('2026-11-05T14:49:00.000Z');
    const times = getSampleAppointmentTimes(
      now,
      'America/New_York',
      10
    );
    const localSlots = times.map((time) => new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(time));

    expect(localSlots).toEqual([
      '2026-11-13, 09:00',
      '2026-11-13, 10:00',
      '2026-11-14, 09:00',
      '2026-11-14, 10:00',
      '2026-11-15, 09:00',
      '2026-11-15, 10:00',
      '2026-11-16, 09:00',
      '2026-11-16, 10:00',
      '2026-11-17, 09:00',
      '2026-11-17, 10:00',
    ]);
    expect(times.every((time) => time.getTime() > now.getTime())).toBe(true);
    expect(times.every((time) =>
      calculateReminderTime(time, '7_days', 'America/New_York', '09:00').getTime() > now.getTime()
    )).toBe(true);
  });

  it('uses the configured local send time for calendar-day intervals and elapsed time for 24 hours', () => {
    const appointmentAt = new Date('2026-11-15T16:30:00.000Z');

    expect(calculateReminderTime(appointmentAt, '7_days', 'America/Los_Angeles', '09:00').toISOString())
      .toBe('2026-11-08T17:00:00.000Z');
    expect(calculateReminderTime(appointmentAt, '3_days', 'America/Los_Angeles', '09:00').toISOString())
      .toBe('2026-11-12T17:00:00.000Z');
    expect(calculateReminderTime(appointmentAt, '24_hours', 'America/Los_Angeles', '09:00').toISOString())
      .toBe('2026-11-14T16:30:00.000Z');
  });

  it('uses the configured send time even when appointments have different local times', () => {
    const appointmentAtNine = new Date('2026-11-13T14:00:00.000Z');
    const appointmentAtTen = new Date('2026-11-13T15:00:00.000Z');
    for (const interval of ['7_days', '3_days'] as const) {
      const reminderAtNine = calculateReminderTime(
        appointmentAtNine,
        interval,
        'America/New_York',
        '09:00'
      );
      const reminderAtTen = calculateReminderTime(
        appointmentAtTen,
        interval,
        'America/New_York',
        '09:00'
      );

      expect(reminderAtNine.toISOString()).toBe(
        interval === '7_days' ? '2026-11-06T14:00:00.000Z' : '2026-11-10T14:00:00.000Z'
      );
      expect(reminderAtTen).toEqual(reminderAtNine);
    }
  });

  it('schedules same-day reminders at the configured practice-local time across DST', () => {
    const appointmentAt = new Date('2026-03-08T16:30:00.000Z');
    const reminderAt = calculateReminderTime(
      appointmentAt,
      'same_day',
      'America/Los_Angeles',
      '09:00'
    );

    expect(reminderAt.toISOString()).toBe('2026-03-08T16:00:00.000Z');
  });

  it('schedules an appointment received for today immediately', () => {
    const now = new Date('2026-11-04T15:00:00.000Z');
    const appointmentAt = new Date('2026-11-04T17:00:00.000Z');

    expect(calculateReminderTime(appointmentAt, 'same_day', 'America/New_York', '09:00', now))
      .toEqual(now);
  });

  it('moves a nonexistent spring-forward send time forward by the DST gap', () => {
    const appointmentAt = new Date('2026-03-08T19:00:00.000Z');
    const reminderAt = calculateReminderTime(
      appointmentAt,
      'same_day',
      'America/Los_Angeles',
      '02:30'
    );

    expect(reminderAt.toISOString()).toBe('2026-03-08T10:30:00.000Z');
  });

  it('uses the first occurrence of an ambiguous fall-back send time', () => {
    const appointmentAt = new Date('2026-11-01T20:00:00.000Z');
    const reminderAt = calculateReminderTime(
      appointmentAt,
      'same_day',
      'America/Los_Angeles',
      '01:30'
    );

    expect(reminderAt.toISOString()).toBe('2026-11-01T08:30:00.000Z');
  });

  it('uses the configured send time across daylight-saving boundaries', () => {
    const appointmentAt = new Date('2026-03-09T16:30:00.000Z');
    const reminderAt = calculateReminderTime(
      appointmentAt,
      '7_days',
      'America/Los_Angeles',
      '09:00'
    );

    expect(reminderAt.toISOString()).toBe('2026-03-02T17:00:00.000Z');
  });

  it('requires an active patient and a scheduled appointment', () => {
    expect(isEligibleAppointment('Scheduled', 'Patient')).toBe(true);
    expect(isEligibleAppointment('Broken', 'Patient')).toBe(false);
    expect(isEligibleAppointment('Scheduled', 'Inactive')).toBe(false);
  });

  it('suppresses canceled appointments, opt-outs, and recipients without contact details', () => {
    const recipient = {
      appointmentStatus: 'Scheduled',
      patientStatus: 'Patient',
      hasConsent: true,
      hasDestination: true,
    };

    expect(getReminderSuppressionReason({ ...recipient, appointmentStatus: 'Broken' }))
      .toBe('Appointment or patient is no longer eligible');
    expect(getReminderSuppressionReason({ ...recipient, hasConsent: false }))
      .toBe('Patient has opted out of this channel');
    expect(getReminderSuppressionReason({ ...recipient, hasDestination: false }))
      .toBe('Patient has no contact for this channel');
    expect(getReminderSuppressionReason(recipient)).toBeNull();
  });

  it('accepts only successful provider responses with a provider message id', () => {
    expect(isProviderSendAccepted({ success: true, providerMessageId: 'message-1' })).toBe(true);
    expect(isProviderSendAccepted({ success: true })).toBe(false);
    expect(isProviderSendAccepted({ success: false, providerMessageId: 'message-1' })).toBe(false);
  });

  it('records provider exceptions as generic failures without exposing provider details', async () => {
    const outcome = await sendReminderWithAdapter(
      { send: async () => { throw new Error('recipient data from provider'); } },
      { to: 'patient@example.test', body: 'Reminder', idempotencyKey: 'occurrence-1' }
    );

    expect(outcome).toEqual({
      accepted: false,
      failureReason: 'Messaging provider request failed',
    });
  });

  it('requires an email subject and a non-empty body before dispatch', () => {
    expect(isRenderedAppointmentTemplateValid(
      { subject: '', body: 'Your visit is tomorrow', unresolved: [] },
      'email'
    )).toBe(false);
    expect(isRenderedAppointmentTemplateValid(
      { subject: 'Appointment reminder', body: 'Your visit is tomorrow', unresolved: [] },
      'email'
    )).toBe(true);
    expect(isRenderedAppointmentTemplateValid(
      { subject: '', body: 'Your visit is tomorrow', unresolved: [] },
      'sms'
    )).toBe(true);
  });

  it('builds practice-local appointment context and reports missing required template values', () => {
    const context = buildAppointmentTemplateContext({
      patient: {
        firstName: 'Sam',
        lastName: 'Patient',
        email: null,
        phone: null,
        birthDate: null,
      },
      practice: { name: 'North Dental', phone: '555-0100', address: null },
      appointment: {
        scheduledAt: new Date('2026-11-15T16:30:00.000Z'),
        providerName: null,
        status: 'Scheduled',
      },
      timeZone: 'America/Los_Angeles',
    });
    const result = renderAppointmentTemplateContent(
      {
        subject: 'Visit at {{practice.name}}',
        body: 'Hello {{patient.firstName}}, your visit is {{appointment.date}} at {{appointment.time}} with {{appointment.provider}}.',
      },
      context
    );

    expect(result.subject).toBe('Visit at North Dental');
    expect(result.body).toContain('November 15, 2026 at 8:30 AM');
    expect(result.unresolved).toEqual(['appointment.provider']);
  });

  it('renders confirmation buttons as escaped HTML links with a plain-text alternative', () => {
    const context = buildAppointmentTemplateContext({
      patient: {
        firstName: '<Sam>',
        lastName: 'Patient',
        email: null,
        phone: null,
        birthDate: null,
      },
      practice: { name: 'North Dental', phone: '555-0100', address: null },
      appointment: {
        scheduledAt: new Date('2026-11-15T16:30:00.000Z'),
        providerName: null,
        status: 'Scheduled',
        confirmUrl: 'https://patient.example.test/appointment-confirmation?token=signed-token',
      },
      timeZone: 'America/Los_Angeles',
    });

    const rendered = renderAppointmentTemplateContent({
      subject: 'Confirm your visit',
      sections: [{
        blocks: [
          { type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}' } },
          {
            type: 'button',
            properties: { text: 'Confirm Appointment', url: '{{appointment.confirmUrl}}' },
          },
        ],
      }],
    }, context);

    expect(rendered.body).toContain('Hello <Sam>');
    expect(rendered.body).toContain('https://patient.example.test/appointment-confirmation?token=signed-token');
    expect(rendered.html).toContain('href="https://patient.example.test/appointment-confirmation?token=signed-token"');
    expect(rendered.html).toContain('Confirm Appointment');
    expect(rendered.html).toContain('Hello &lt;Sam&gt;');
    expect(rendered.unresolved).toEqual([]);
  });

  it('revalidates Open Dental appointment date and time in the practice timezone', () => {
    const scheduledAt = new Date('2026-11-15T14:00:00.000Z');

    expect(isAppointmentDateTimeMatch(
      scheduledAt,
      '2026-11-15 09:00:00',
      'America/New_York'
    )).toBe(true);
    expect(isAppointmentDateTimeMatch(
      scheduledAt,
      '2026-11-15T14:00:00Z',
      'America/New_York'
    )).toBe(true);
    expect(isAppointmentDateTimeMatch(
      scheduledAt,
      '2026-11-15 10:00:00',
      'America/New_York'
    )).toBe(false);
    expect(isAppointmentDateTimeMatch(
      scheduledAt,
      'not-a-date',
      'America/New_York'
    )).toBe(false);
  });

  it('does not render a button for non-HTTP confirmation URLs', () => {
    const context = buildAppointmentTemplateContext({
      patient: { firstName: 'Sam', lastName: 'Patient', email: null, phone: null, birthDate: null },
      practice: { name: 'North Dental', phone: null, address: null },
      appointment: {
        scheduledAt: new Date('2026-11-15T16:30:00.000Z'),
        providerName: null,
        status: 'Scheduled',
        confirmUrl: 'javascript:alert(1)',
      },
      timeZone: 'America/Los_Angeles',
    });
    const rendered = renderAppointmentTemplateContent({
      sections: [{
        blocks: [{
          type: 'button',
          properties: { text: 'Confirm Appointment', url: '{{appointment.confirmUrl}}' },
        }],
      }],
    }, context);

    expect(rendered.html).not.toContain('javascript:');
    expect(rendered.html).not.toContain('<a ');
  });
});
