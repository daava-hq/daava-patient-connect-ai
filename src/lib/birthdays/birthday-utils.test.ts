import { describe, expect, it } from 'vitest';
import {
  getBirthdayDateRange,
  getBirthdayDateKeys,
  getBirthdayInYear,
  getBirthdaySuppressionReason,
  getLocalDateParts,
  getNextBirthdayOccurrence,
} from './birthday-utils';
import { renderAppointmentTemplateContent } from '@/lib/appointment-reminders/reminder-utils';

describe('birthday utilities', () => {
  it('uses February 29 in leap years and February 28 in common years', () => {
    expect(getBirthdayInYear('2000-02-29', 2024)).toEqual({ year: 2024, month: 2, day: 29 });
    expect(getBirthdayInYear('2000-02-29', 2025)).toEqual({ year: 2025, month: 2, day: 28 });
    expect(getBirthdayInYear('2001-02-29', 2025)).toBeNull();
  });

  it('returns no schedule when birthdate is missing or invalid', () => {
    const input = {
      daysBefore: 0,
      localDeliveryTime: '09:00',
      timeZone: 'America/New_York',
      now: new Date('2026-01-01T12:00:00.000Z'),
    };
    expect(getNextBirthdayOccurrence({ ...input, dateOfBirth: null })).toBeNull();
    expect(getNextBirthdayOccurrence({ ...input, dateOfBirth: 'not-a-date' })).toBeNull();
  });

  it('suppresses missing birthdates, inactive patients, opt-outs, and missing destinations', () => {
    const eligible = {
      patientStatus: 'Patient',
      dateOfBirth: '1990-05-12',
      hasConsent: true,
      hasDestination: true,
    };
    expect(getBirthdaySuppressionReason({ ...eligible, dateOfBirth: null }))
      .toBe('Patient birthdate is unavailable');
    expect(getBirthdaySuppressionReason({ ...eligible, patientStatus: 'Inactive' }))
      .toBe('Patient is no longer active');
    expect(getBirthdaySuppressionReason({ ...eligible, hasConsent: false }))
      .toBe('Patient opted out');
    expect(getBirthdaySuppressionReason({ ...eligible, hasDestination: false }))
      .toBe('Patient has no contact for this channel');
    expect(getBirthdaySuppressionReason(eligible)).toBeNull();
  });

  it('uses the practice timezone to determine the birthday date boundary', () => {
    expect(getLocalDateParts(new Date('2026-11-09T01:00:00.000Z'), 'America/Los_Angeles'))
      .toEqual({ year: 2026, month: 11, day: 8 });
    const occurrence = getNextBirthdayOccurrence({
      dateOfBirth: '1990-11-09',
      daysBefore: 0,
      localDeliveryTime: '09:00',
      timeZone: 'America/Los_Angeles',
      now: new Date('2026-11-09T01:00:00.000Z'),
    });
    expect(occurrence?.birthdayYear).toBe(2026);
    expect(occurrence?.scheduledFor.toISOString()).toBe('2026-11-09T17:00:00.000Z');
  });

  it('schedules a birthday in the correct timezone across spring DST', () => {
    const occurrence = getNextBirthdayOccurrence({
      dateOfBirth: '1990-03-08',
      daysBefore: 0,
      localDeliveryTime: '09:00',
      timeZone: 'America/New_York',
      now: new Date('2026-03-08T04:30:00.000Z'),
    });
    expect(occurrence?.scheduledFor.toISOString()).toBe('2026-03-08T13:00:00.000Z');
  });

  it('keeps a due occurrence on the same local day and advances after the day has passed', () => {
    const occurrence = getNextBirthdayOccurrence({
      dateOfBirth: '1990-05-12',
      daysBefore: 0,
      localDeliveryTime: '09:00',
      timeZone: 'America/New_York',
      now: new Date('2026-05-12T14:00:00.000Z'),
    });
    expect(occurrence?.birthdayYear).toBe(2026);
    const nextYear = getNextBirthdayOccurrence({
      dateOfBirth: '1990-05-12',
      daysBefore: 0,
      localDeliveryTime: '09:00',
      timeZone: 'America/New_York',
      now: new Date('2026-05-13T14:00:00.000Z'),
    });
    expect(nextYear?.birthdayYear).toBe(2027);
  });

  it('calculates current practice-local filters for today, tomorrow, and this month', () => {
    const now = new Date('2026-11-09T01:00:00.000Z');
    expect(getBirthdayDateRange('today', now, 'America/Los_Angeles'))
      .toEqual({ start: { year: 2026, month: 11, day: 8 }, end: { year: 2026, month: 11, day: 8 } });
    expect(getBirthdayDateRange('tomorrow', now, 'America/Los_Angeles').start)
      .toEqual({ year: 2026, month: 11, day: 9 });
    expect(getBirthdayDateRange('thisMonth', now, 'America/Los_Angeles').end)
      .toEqual({ year: 2026, month: 11, day: 30 });
  });

  it('accepts a bounded custom date range and rejects invalid or oversized ranges', () => {
    const now = new Date('2026-11-09T12:00:00.000Z');
    expect(getBirthdayDateRange('custom', now, 'UTC', '2026-12-01', '2026-12-07'))
      .toEqual({
        start: { year: 2026, month: 12, day: 1 },
        end: { year: 2026, month: 12, day: 7 },
      });
    expect(() => getBirthdayDateRange('custom', now, 'UTC', '2026-02-30', '2026-03-01'))
      .toThrow('valid start and end dates');
    const oversizedRange = getBirthdayDateRange('custom', now, 'UTC', '2026-01-01', '2027-01-02');
    expect(() => getBirthdayDateKeys(oversizedRange.start, oversizedRange.end))
      .toThrow('cannot exceed 366 days');
  });

  it('renders birthday, patient, and practice template variables without including the birth year', () => {
    const rendered = renderAppointmentTemplateContent(
      {
        subject: 'Happy birthday, {{patient.firstName}}',
        body: '{{birthday.date}} from {{practice.name}} — {{birthday.offer}}',
      },
      {
        patient: {
          firstName: 'Taylor',
          lastName: 'Patient',
          fullName: 'Taylor Patient',
          email: '',
          phone: '',
          birthDate: '',
        },
        practice: { name: 'Smile Dental', phone: '', address: '' },
        appointment: { date: '', time: '', provider: '', status: '', confirmUrl: '' },
      },
      { 'birthday.date': 'May 12', 'birthday.offer': 'a free consultation' }
    );
    expect(rendered.subject).toBe('Happy birthday, Taylor');
    expect(rendered.body).toBe('May 12 from Smile Dental — a free consultation');
    expect(rendered.unresolved).toEqual([]);
    expect(rendered.body).not.toContain('1990');
  });
});
