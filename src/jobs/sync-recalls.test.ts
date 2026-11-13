import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  dbTransaction: vi.fn(),
  decrypt: vi.fn(),
  getOpenDentalRecalls: vi.fn(),
  parseOpenDentalRecall: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({
  db: {
    select: mocks.dbSelect,
    transaction: mocks.dbTransaction,
  },
}));
vi.mock('@/db/schema/opendental_recalls', () => ({
  opendentalRecalls: { practiceId: 'practiceId' },
}));
vi.mock('@/db/schema/patients', () => ({ patients: { practiceId: 'practiceId' } }));
vi.mock('@/db/schema/practice_credentials', () => ({
  practiceOpendentalCredentials: { practiceId: 'practiceId' },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));
vi.mock('@/lib/opendental', () => ({
  decrypt: mocks.decrypt,
  getOpenDentalRecalls: mocks.getOpenDentalRecalls,
  parseOpenDentalRecall: mocks.parseOpenDentalRecall,
}));
vi.mock('@/lib/logger', () => ({
  logError: mocks.logError,
  logInfo: mocks.logInfo,
}));

import { runRecallSync } from './sync-recalls';

function selectQuery(rows: unknown[], withLimit = false) {
  const builder = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(withLimit ? builder : Promise.resolve(rows));
  if (withLimit) builder.limit.mockResolvedValue(rows);
  return builder;
}

function transactionMock() {
  const deleteBuilder = { where: vi.fn().mockResolvedValue(undefined) };
  const insertBuilder = { values: vi.fn().mockResolvedValue(undefined) };
  const updateBuilder = {
    set: vi.fn(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  updateBuilder.set.mockReturnValue(updateBuilder);
  const tx = {
    delete: vi.fn().mockReturnValue(deleteBuilder),
    insert: vi.fn().mockReturnValue(insertBuilder),
    update: vi.fn().mockReturnValue(updateBuilder),
  };
  mocks.dbTransaction.mockImplementation(async (callback) => callback(tx));
  return { tx, insertBuilder };
}

describe('runRecallSync', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('replaces the practice recall snapshot and skips records without a synchronized patient', async () => {
    mocks.dbSelect
      .mockReturnValueOnce(selectQuery([{
        developerKeyEnc: 'encrypted-developer-key',
        customerKeyEnc: 'encrypted-customer-key',
      }], true))
      .mockReturnValueOnce(selectQuery([{ id: 'patient-1', opendentalPatientId: 101 }]));
    mocks.decrypt.mockReturnValue('decrypted-key');
    mocks.getOpenDentalRecalls.mockResolvedValue([{ RecallNum: 11 }, { RecallNum: 12 }]);
    mocks.parseOpenDentalRecall
      .mockReturnValueOnce({
        recallNum: 11,
        patientNum: 101,
        recallTypeNum: 2,
        dueDate: '2026-03-01',
        dateScheduled: null,
        isDisabled: false,
      })
      .mockReturnValueOnce({
        recallNum: 12,
        patientNum: 999,
        recallTypeNum: 2,
        dueDate: '2026-03-01',
        dateScheduled: null,
        isDisabled: false,
      });
    const { tx, insertBuilder } = transactionMock();

    await expect(runRecallSync('practice-1')).resolves.toEqual({
      success: true,
      count: 1,
      skippedCount: 1,
    });
    expect(mocks.getOpenDentalRecalls).toHaveBeenCalledWith('decrypted-key', 'decrypted-key');
    expect(tx.delete).toHaveBeenCalledTimes(1);
    expect(insertBuilder.values).toHaveBeenCalledWith([
      expect.objectContaining({
        practiceId: 'practice-1',
        patientId: 'patient-1',
        opendentalRecallId: 11,
        recallTypeNum: 2,
        dueDate: '2026-03-01',
      }),
    ]);
  });

  it('does not contact Open Dental when credentials are missing', async () => {
    mocks.dbSelect.mockReturnValueOnce(selectQuery([], true));

    await expect(runRecallSync('practice-1')).resolves.toMatchObject({
      success: false,
      count: 0,
      error: 'Open Dental credentials not configured for this practice',
    });
    expect(mocks.getOpenDentalRecalls).not.toHaveBeenCalled();
  });
});
