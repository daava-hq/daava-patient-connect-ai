import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { appointmentReminders } from './appointment_reminders';

describe('appointment reminder occurrence schema', () => {
  it('enforces one occurrence per appointment, schedule, channel, and patient', () => {
    const config = getTableConfig(appointmentReminders);
    const occurrenceConstraint = config.uniqueConstraints.find(
      (constraint) => constraint.getName() === 'uq_appointment_reminder_occurrence'
    );

    expect(occurrenceConstraint?.columns.map((column) => column.name)).toEqual([
      'appointment_id',
      'schedule_id',
      'channel',
      'patient_id',
    ]);
  });
});
