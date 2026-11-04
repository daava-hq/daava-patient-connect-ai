import { afterEach, describe, it, expect, vi } from 'vitest';
import { upsertPatient } from './patient-repository';

const { insertValues, conflictConfig } = vi.hoisted(() => ({
  insertValues: vi.fn(),
  conflictConfig: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: () => ({
      values: (value: Record<string, unknown>) => {
        insertValues(value);
        return {
          onConflictDoUpdate: (config: { set: Record<string, unknown> }) => {
            conflictConfig(config);
            return {
              returning: () => Promise.resolve([{ id: 'p-1', ...value, syncedAt: new Date() }]),
            };
          },
        };
      },
    }),
  },
}));

describe('Patient Repository & Upsert', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('defaults consent for available contact channels on new patients and preserves it on sync', async () => {
    const patientData = {
      practiceId: 'practice-123',
      opendentalPatientId: 1001,
      firstName: 'Alice',
      lastName: 'Smith',
      status: 'Patient',
      phoneMobile: '555-0101',
      email: 'alice@example.com',
    };

    const result = await upsertPatient(patientData);
    expect(result).toBeDefined();
    expect(result.firstName).toEqual('Alice');
    expect(result.opendentalPatientId).toEqual(1001);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ smsConsent: true, emailConsent: true })
    );
    expect(conflictConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.not.objectContaining({ smsConsent: expect.anything(), emailConsent: expect.anything() }),
      })
    );
  });

  it('only defaults consent to true when that channel has contact information', async () => {
    await upsertPatient({
      practiceId: 'practice-123',
      opendentalPatientId: 1002,
      firstName: 'Jordan',
      lastName: 'Lee',
      status: 'Patient',
      email: 'jordan@example.com',
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ smsConsent: false, emailConsent: true })
    );

    await upsertPatient({
      practiceId: 'practice-123',
      opendentalPatientId: 1003,
      firstName: 'Riley',
      lastName: 'Kim',
      status: 'Patient',
      phoneMobile: '555-0103',
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ smsConsent: true, emailConsent: false })
    );

    await upsertPatient({
      practiceId: 'practice-123',
      opendentalPatientId: 1005,
      firstName: 'Casey',
      lastName: 'Morgan',
      status: 'Patient',
      phoneMobile: '   ',
      email: ' ',
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ smsConsent: false, emailConsent: false })
    );
  });

  it('respects explicit consent values on insert even when contact details exist', async () => {
    await upsertPatient({
      practiceId: 'practice-123',
      opendentalPatientId: 1004,
      firstName: 'Jordan',
      lastName: 'Lee',
      status: 'Patient',
      phoneMobile: '555-0104',
      email: 'jordan@example.com',
      smsConsent: false,
      emailConsent: false,
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ smsConsent: false, emailConsent: false })
    );
  });
});
