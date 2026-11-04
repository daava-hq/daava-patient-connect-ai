import { describe, it, expect } from 'vitest';
import {
  buildAppointmentTemplateContext,
  calculateReminderTime,
  getReminderSuppressionReason,
  isEligibleAppointment,
  isRenderedAppointmentTemplateValid,
  renderAppointmentTemplateContent,
} from './reminder-utils';

describe('Appointment Reminders Test Data & Scenarios', () => {
  const practiceTimezone = 'America/New_York';
  const practiceInfo = {
    name: 'Riversbend Dental',
    phone: '(555) 100-2000',
    address: '123 River Road, Suite A',
  };

  const emailTemplateContent = {
    version: 1,
    subject: 'Your upcoming appointment at {{practice.name}}',
    sections: [
      {
        id: 'sec-1',
        blocks: [
          {
            id: 'b-1',
            type: 'paragraph',
            properties: {
              text: 'Dear {{patient.firstName}}, your visit is confirmed for {{appointment.date}} at {{appointment.time}}.',
            },
          },
          {
            id: 'b-2',
            type: 'paragraph',
            properties: {
              text: 'Location: {{practice.name}}, {{practice.address}}. Call {{practice.phone}} with questions.',
            },
          },
        ],
      },
    ],
  };

  const smsTemplateContent = {
    version: 1,
    sections: [
      {
        id: 'sec-1',
        blocks: [
          {
            id: 'b-1',
            type: 'paragraph',
            properties: {
              text: 'Hi {{patient.firstName}}, reminder of your visit at {{practice.name}} on {{appointment.date}} at {{appointment.time}}. Call {{practice.phone}} to reschedule.',
            },
          },
        ],
      },
    ],
  };

  it('Scenario 1: Email Happy Path - patient is eligible, template renders without unresolved variables', () => {
    const scheduledAt = new Date('2026-11-10T14:30:00.000Z');
    const patient = {
      firstName: 'Sarah',
      lastName: 'Jenkins',
      email: 'sarah.jenkins@example.com',
      phone: '(555) 234-5678',
      birthDate: '1985-06-15',
    };

    expect(isEligibleAppointment('Scheduled', 'Patient')).toBe(true);

    const suppressionReason = getReminderSuppressionReason({
      appointmentStatus: 'Scheduled',
      patientStatus: 'Patient',
      hasConsent: true,
      hasDestination: Boolean(patient.email),
    });
    expect(suppressionReason).toBeNull();

    const reminderTime = calculateReminderTime(scheduledAt, '24_hours', practiceTimezone, '09:00');
    expect(reminderTime.getTime()).toBe(scheduledAt.getTime() - 24 * 60 * 60 * 1000);

    const context = buildAppointmentTemplateContext({
      patient,
      practice: practiceInfo,
      appointment: { scheduledAt, providerName: null, status: 'Scheduled' },
      timeZone: practiceTimezone,
    });

    const rendered = renderAppointmentTemplateContent(emailTemplateContent, context);
    expect(rendered.unresolved).toHaveLength(0);
    expect(rendered.subject).toBe('Your upcoming appointment at Riversbend Dental');
    expect(rendered.body).toContain('Dear Sarah, your visit is confirmed');
    expect(isRenderedAppointmentTemplateValid(rendered, 'email')).toBe(true);
  });

  it('Scenario 2: SMS Happy Path - patient is eligible, 3-day SMS reminder renders correctly', () => {
    const scheduledAt = new Date('2026-11-12T15:00:00.000Z');
    const patient = {
      firstName: 'Michael',
      lastName: 'Chen',
      email: 'michael.chen@example.com',
      phone: '(555) 345-6789',
      birthDate: '1990-08-20',
    };

    expect(isEligibleAppointment('Scheduled', 'Patient')).toBe(true);

    const suppressionReason = getReminderSuppressionReason({
      appointmentStatus: 'Scheduled',
      patientStatus: 'Patient',
      hasConsent: true,
      hasDestination: Boolean(patient.phone),
    });
    expect(suppressionReason).toBeNull();

    const reminderTime = calculateReminderTime(scheduledAt, '3_days', practiceTimezone, '09:00');
    expect(reminderTime.toISOString()).toBe('2026-11-09T15:00:00.000Z');

    const context = buildAppointmentTemplateContext({
      patient,
      practice: practiceInfo,
      appointment: { scheduledAt, providerName: null, status: 'Scheduled' },
      timeZone: practiceTimezone,
    });

    const rendered = renderAppointmentTemplateContent(smsTemplateContent, context);
    expect(rendered.unresolved).toHaveLength(0);
    expect(rendered.body).toContain('Hi Michael, reminder of your visit at Riversbend Dental');
    expect(isRenderedAppointmentTemplateValid(rendered, 'sms')).toBe(true);
  });

  it('Scenario 3: SMS Consent Opt-Out - suppressed with explicit reason', () => {
    const suppressionReason = getReminderSuppressionReason({
      appointmentStatus: 'Scheduled',
      patientStatus: 'Patient',
      hasConsent: false,
      hasDestination: true,
    });
    expect(suppressionReason).toBe('Patient has opted out of this channel');
  });

  it('Scenario 4: Email Consent Opt-Out - suppressed with explicit reason', () => {
    const suppressionReason = getReminderSuppressionReason({
      appointmentStatus: 'Scheduled',
      patientStatus: 'Patient',
      hasConsent: false,
      hasDestination: true,
    });
    expect(suppressionReason).toBe('Patient has opted out of this channel');
  });

  it('Scenario 5: Missing Contact Info - suppressed when destination is missing', () => {
    const suppressionReason = getReminderSuppressionReason({
      appointmentStatus: 'Scheduled',
      patientStatus: 'Patient',
      hasConsent: true,
      hasDestination: false,
    });
    expect(suppressionReason).toBe('Patient has no contact for this channel');
  });

  it('Scenario 6: Ineligible Patient Status - Prospective patients are rejected', () => {
    expect(isEligibleAppointment('Scheduled', 'Prospective')).toBe(false);
    expect(isEligibleAppointment('Scheduled', 'Inactive')).toBe(false);

    const suppressionReason = getReminderSuppressionReason({
      appointmentStatus: 'Scheduled',
      patientStatus: 'Prospective',
      hasConsent: true,
      hasDestination: true,
    });
    expect(suppressionReason).toBe('Appointment or patient is no longer eligible');
  });

  it('Scenario 7: Non-Scheduled Appointment Status - Broken or Complete are rejected', () => {
    expect(isEligibleAppointment('Broken', 'Patient')).toBe(false);
    expect(isEligibleAppointment('Complete', 'Patient')).toBe(false);
    expect(isEligibleAppointment('Planned', 'Patient')).toBe(false);

    const suppressionReason = getReminderSuppressionReason({
      appointmentStatus: 'Broken',
      patientStatus: 'Patient',
      hasConsent: true,
      hasDestination: true,
    });
    expect(suppressionReason).toBe('Appointment or patient is no longer eligible');
  });

  it('Scenario 8: Same-Day Send Time - schedules at specified local send time in practice timezone', () => {
    const appointmentAt = new Date('2026-11-05T19:00:00.000Z'); // 2:00 PM EST (UTC-5)
    const reminderAt = calculateReminderTime(
      appointmentAt,
      'same_day',
      'America/New_York',
      '08:00'
    );

    // 8:00 AM EST on 2026-11-05 is 13:00:00.000Z
    expect(reminderAt.toISOString()).toBe('2026-11-05T13:00:00.000Z');
  });

  it('Scenario 9: Template validation catches unresolvable provider or website variables', () => {
    const invalidTemplate = {
      subject: 'Visit with {{appointment.provider}}',
      body: 'Visit us at {{practice.website}} with {{appointment.provider}}',
    };

    const context = buildAppointmentTemplateContext({
      patient: { firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com', phone: null, birthDate: null },
      practice: { name: 'Riversbend Dental', phone: '555-1234', address: '123 Main' },
      appointment: { scheduledAt: new Date('2026-11-10T14:00:00Z'), providerName: null, status: 'Scheduled' },
      timeZone: practiceTimezone,
    });

    const rendered = renderAppointmentTemplateContent(invalidTemplate, context);
    expect(rendered.unresolved).toContain('appointment.provider');
    expect(rendered.unresolved).toContain('practice.website');
    expect(isRenderedAppointmentTemplateValid(rendered, 'email')).toBe(false);
  });
});
