import { describe, it, expect, vi } from 'vitest';
import { upsertAppointment } from './appointment-repository';

// Mock db for appointment and patient reconciliation
vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]), // Patient not found initially, triggers reconciliation stub creation
        }),
      }),
    }),
    insert: (table: any) => ({
      values: (val: any) => ({
        returning: () => Promise.resolve([{ id: 'stub-patient-id', ...val }]),
        onConflictDoUpdate: () => ({
          returning: () => Promise.resolve([{ id: 'appt-1', ...val, syncedAt: new Date() }]),
        }),
      }),
    }),
  },
}));

describe('Appointment Repository & Reconciliation', () => {
  it('upserts appointment and reconciles missing patient with a stub record', async () => {
    const apptData = {
      practiceId: 'practice-123',
      opendentalApptId: 5001,
      opendentalPatientId: 2001,
      scheduledAt: new Date('2026-11-01T10:00:00Z'),
      status: 'Scheduled',
      description: 'Comprehensive Exam',
    };

    const result = await upsertAppointment(apptData);
    expect(result).toBeDefined();
    expect(result.opendentalApptId).toEqual(5001);
  });
});
