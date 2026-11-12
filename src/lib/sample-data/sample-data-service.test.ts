import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({
  db: {
    select: mocks.select,
    transaction: mocks.transaction,
  },
}));
vi.mock('@/lib/env', () => ({
  env: { APP_ENVIRONMENT: 'local' },
}));

import { birthdayCampaigns, birthdayMessageOccurrences } from '@/db/schema/birthday_engagement';
import { campaigns } from '@/db/schema/campaigns';
import { resetSamplePracticeData } from './sample-data-service';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
const stopAfterBirthdayDisable = new Error('Stopped after birthday campaign update');

interface BirthdayOccurrenceRow {
  id: string;
  status?: string;
}

interface SelectQuery {
  from(table: unknown): SelectQuery;
  where(): SelectQuery;
  for(_lock: 'update'): Promise<BirthdayOccurrenceRow[]>;
}

function createTransaction(processingBirthday = false) {
  let birthdayCampaignUpdate: unknown;
  const tx = {
    select: vi.fn(() => {
      let selectedTable: unknown;
      const query: SelectQuery = {
        from: (table) => {
          selectedTable = table;
          return query;
        },
        where: () => query,
        for: async () => {
          if (selectedTable === campaigns) return [];
          if (selectedTable === birthdayCampaigns) return [{ id: 'birthday-campaign-id' }];
          if (selectedTable === birthdayMessageOccurrences && processingBirthday) {
            return [{ id: 'birthday-occurrence-id', status: 'processing' }];
          }
          return [];
        },
      };
      return query;
    }),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: unknown) => {
        if (table === birthdayCampaigns) birthdayCampaignUpdate = values;
        return {
          where: vi.fn(async () => {
            if (table === birthdayCampaigns) throw stopAfterBirthdayDisable;
          }),
        };
      }),
    })),
    getBirthdayCampaignUpdate: () => birthdayCampaignUpdate,
  };
  return tx;
}

describe('resetSamplePracticeData', () => {
  beforeEach(() => {
    const practiceQuery = {
      from: vi.fn(),
      innerJoin: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
    };
    practiceQuery.from.mockReturnValue(practiceQuery);
    practiceQuery.innerJoin.mockReturnValue(practiceQuery);
    practiceQuery.where.mockReturnValue(practiceQuery);
    practiceQuery.limit.mockResolvedValue([{ id: practiceId, timezone: 'Asia/Kolkata' }]);
    mocks.select.mockReturnValue(practiceQuery);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('turns off enabled birthday campaigns before resetting sample data', async () => {
    const tx = createTransaction();
    mocks.transaction.mockImplementation((callback) => callback(tx));

    await expect(resetSamplePracticeData(practiceId)).rejects.toBe(stopAfterBirthdayDisable);

    expect(tx.getBirthdayCampaignUpdate()).toMatchObject({ enabled: false });
  });

  it('does not reset while a birthday message is processing', async () => {
    const tx = createTransaction(true);
    mocks.transaction.mockImplementation((callback) => callback(tx));

    await expect(resetSamplePracticeData(practiceId)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Wait for birthday messages to finish processing before resetting sample data.',
    });

    expect(tx.update).not.toHaveBeenCalled();
  });
});
