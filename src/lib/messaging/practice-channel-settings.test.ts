import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db';
import { isPracticeChannelEnabled } from './practice-channel-settings';

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({ db: { select: vi.fn() } }));

describe('isPracticeChannelEnabled', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the configured state for the requested channel', async () => {
    const query = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ emailEnabled: true, smsEnabled: false }]),
    };
    vi.mocked(db.select).mockReturnValue(query as never);

    await expect(isPracticeChannelEnabled('practice-1', 'email')).resolves.toBe(true);
    await expect(isPracticeChannelEnabled('practice-1', 'sms')).resolves.toBe(false);
  });

  it('fails closed when the practice does not exist', async () => {
    const query = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.select).mockReturnValue(query as never);

    await expect(isPracticeChannelEnabled('missing-practice', 'email')).resolves.toBe(false);
  });
});
