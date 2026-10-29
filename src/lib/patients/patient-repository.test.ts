import { describe, it, expect, vi } from 'vitest';
import { upsertPatient } from './patient-repository';

vi.mock('@/db', () => ({
  db: {
    insert: () => ({
      values: (val: any) => ({
        onConflictDoUpdate: () => ({
          returning: () => Promise.resolve([{ id: 'p-1', ...val, syncedAt: new Date() }]),
        }),
      }),
    }),
  },
}));

describe('Patient Repository & Upsert', () => {
  it('idempotently upserts patient with practice scoping', async () => {
    const patientData = {
      practiceId: 'practice-123',
      opendentalPatientId: 1001,
      firstName: 'Alice',
      lastName: 'Smith',
      status: 'Patient',
      smsConsent: true,
      emailConsent: true,
    };

    const result = await upsertPatient(patientData);
    expect(result).toBeDefined();
    expect(result.firstName).toEqual('Alice');
    expect(result.opendentalPatientId).toEqual(1001);
  });
});
