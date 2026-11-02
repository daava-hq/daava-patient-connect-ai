import { describe, expect, it } from 'vitest';
import {
  buildAppointmentTemplateContext,
  calculateReminderTime,
  getReminderSuppressionReason,
  isEligibleAppointment,
  isRenderedAppointmentTemplateValid,
  isProviderSendAccepted,
  renderAppointmentTemplateContent,
  sendReminderWithAdapter,
} from './reminder-utils';

describe('appointment reminder utilities', () => {
  it('calculates fixed reminder intervals before the appointment instant', () => {
    const appointmentAt = new Date('2026-11-15T16:30:00.000Z');

    expect(calculateReminderTime(appointmentAt, '7_days', 'America/Los_Angeles', '09:00').toISOString())
      .toBe('2026-11-08T16:30:00.000Z');
    expect(calculateReminderTime(appointmentAt, '3_days', 'America/Los_Angeles', '09:00').toISOString())
      .toBe('2026-11-12T16:30:00.000Z');
    expect(calculateReminderTime(appointmentAt, '24_hours', 'America/Los_Angeles', '09:00').toISOString())
      .toBe('2026-11-14T16:30:00.000Z');
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

  it('keeps 7-day intervals at the same local appointment time when daylight saving changes', () => {
    const appointmentAt = new Date('2026-03-09T16:30:00.000Z');
    const reminderAt = calculateReminderTime(
      appointmentAt,
      '7_days',
      'America/Los_Angeles',
      '09:00'
    );

    expect(reminderAt.toISOString()).toBe('2026-03-02T17:30:00.000Z');
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
});
