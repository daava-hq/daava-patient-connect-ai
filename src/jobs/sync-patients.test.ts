import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  dbUpdate: vi.fn(),
  decrypt: vi.fn(),
  getOpenDentalPatients: vi.fn(),
  upsertPatient: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({
  db: {
    select: mocks.dbSelect,
    update: mocks.dbUpdate,
  },
}));
vi.mock('@/db/schema/practice_credentials', () => ({
  practiceOpendentalCredentials: { practiceId: 'practiceId' },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));
vi.mock('@/lib/opendental', () => ({
  decrypt: mocks.decrypt,
  getOpenDentalPatients: mocks.getOpenDentalPatients,
}));
vi.mock('@/lib/patients/patient-repository', () => ({
  upsertPatient: mocks.upsertPatient,
}));
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

import { runPatientSync } from './sync-patients';

describe('runPatientSync', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses the patient upsert path so new synced rows get contact-based consent defaults', async () => {
    const credentialsQuery = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([
        { developerKeyEnc: 'encrypted-developer-key', customerKeyEnc: 'encrypted-customer-key' },
      ]),
    };
    credentialsQuery.from.mockReturnValue(credentialsQuery);
    credentialsQuery.where.mockReturnValue(credentialsQuery);
    mocks.dbSelect.mockReturnValue(credentialsQuery);

    const updateQuery = {
      set: vi.fn(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    updateQuery.set.mockReturnValue(updateQuery);
    mocks.dbUpdate.mockReturnValue(updateQuery);

    mocks.decrypt.mockReturnValue('decrypted-key');
    mocks.getOpenDentalPatients.mockResolvedValue([
      {
        PatNum: 101,
        FName: 'Alex',
        LName: 'Taylor',
        Email: 'alex@example.com',
        WirelessPhone: '555-0101',
      },
    ]);

    const result = await runPatientSync('practice-123');

    expect(result).toMatchObject({ success: true, count: 1 });
    expect(mocks.upsertPatient).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceId: 'practice-123',
        opendentalPatientId: 101,
        email: 'alex@example.com',
        phoneMobile: '555-0101',
      })
    );
    expect(mocks.upsertPatient.mock.calls[0][0]).not.toHaveProperty('smsConsent');
    expect(mocks.upsertPatient.mock.calls[0][0]).not.toHaveProperty('emailConsent');
  });
});
