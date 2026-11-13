import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { appointmentReminderSchedules, appointmentReminders } from './appointment_reminders';

describe('appointment reminder occurrence schema', () => {
  it('defaults reminder schedule audiences to no group restriction', () => {
    const scheduleConfig = getTableConfig(appointmentReminderSchedules);
    const groupIdsColumn = scheduleConfig.columns.find((column) => column.name === 'group_ids');

    expect(groupIdsColumn).toBeDefined();
    expect(groupIdsColumn?.notNull).toBe(true);
    expect(groupIdsColumn?.default).toBeDefined();
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
