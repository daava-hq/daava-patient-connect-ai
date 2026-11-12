import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
  };
  query.from.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);

  return {
    query,
    selectDistinct: vi.fn(() => query),
    run: vi.fn(),
    eq: vi.fn((column: string, value: string | boolean) => ({ column, value })),
  };
});

vi.mock('@/db', () => ({ db: { selectDistinct: mocks.selectDistinct } }));
vi.mock('@/db/schema/birthday_engagement', () => ({
  birthdayCampaigns: { practiceId: 'campaign.practiceId', enabled: 'campaign.enabled', deletedAt: 'campaign.deletedAt' },
}));
vi.mock('@/db/schema/practices', () => ({
  practices: { id: 'practice.id', slug: 'practice.slug' },
}));
vi.mock('@/jobs/birthday-engagement', () => ({ run: mocks.run }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  eq: mocks.eq,
  isNull: vi.fn((column: string) => ({ isNull: column })),
}));

import { POST } from './route';

describe('birthday cron route', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('only processes the sample practice in local sample mode', async () => {
    const practiceId = 'sample-practice-id';
    vi.stubEnv('APPOINTMENT_REMINDERS_CRON_SECRET', 'cron-secret');
    vi.stubEnv('APP_ENVIRONMENT', 'local');
    mocks.query.where.mockResolvedValue([{ practiceId }]);
    mocks.run.mockResolvedValue({
      materialized: 1,
      processed: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
    });

    const response = await POST(
      new NextRequest('http://localhost/api/cron/birthdays?sampleData=true', {
        method: 'POST',
        headers: { authorization: 'Bearer cron-secret' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith('practice.slug', 'appointment-reminder-sample');
    expect(mocks.run).toHaveBeenCalledWith(practiceId);
    expect(body.data.practicesProcessed).toBe(1);
  });

  it('rejects sample mode outside local or dev', async () => {
    vi.stubEnv('APPOINTMENT_REMINDERS_CRON_SECRET', 'cron-secret');
    vi.stubEnv('APP_ENVIRONMENT', 'production');

    const response = await POST(
      new NextRequest('http://localhost/api/cron/birthdays?sampleData=true', {
        method: 'POST',
        headers: { authorization: 'Bearer cron-secret' },
      })
    );

    expect(response.status).toBe(404);
    expect(mocks.selectDistinct).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
