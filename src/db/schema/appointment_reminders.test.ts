import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { appointmentReminderSchedules, appointmentReminders } from './appointment_reminders';

describe('appointment reminder occurrence schema', () => {
  it('does not keep legacy group_ids storage for reminder schedules', () => {
    const scheduleConfig = getTableConfig(appointmentReminderSchedules);
    const groupIdsColumn = scheduleConfig.columns.find((column) => column.name === 'group_ids');

    expect(groupIdsColumn).toBeUndefined();
  });

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
