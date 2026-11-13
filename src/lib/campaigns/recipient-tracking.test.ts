import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({ db: { select: mocks.select } }));

import { campaignRecipients } from '@/db/schema/campaign_recipients';
import { getCampaignRecipientHistory } from './recipient-tracking';

describe('getCampaignRecipientHistory', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns delivery status without patient, provider, or raw error details', async () => {
    const records = [{
      recipientId: '4a2d850d-1505-4db4-b0aa-0bd83ad7793e',
      status: 'delivered',
      retryCount: 0,
      updatedAt: new Date('2026-06-15T12:00:00.000Z'),
    }];
    mocks.select.mockReturnValue({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              offset: async () => records,
            }),
          }),
        }),
      }),
    });

    await expect(getCampaignRecipientHistory('campaign-id', 50, 0)).resolves.toEqual(records);
    expect(mocks.select).toHaveBeenCalledWith({
      recipientId: campaignRecipients.id,
      status: campaignRecipients.status,
      retryCount: campaignRecipients.retryCount,
      updatedAt: campaignRecipients.updatedAt,
    });
  });
});
