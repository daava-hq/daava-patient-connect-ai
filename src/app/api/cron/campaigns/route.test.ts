import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);

  return {
    query,
    select: vi.fn(() => query),
    processScheduledCampaigns: vi.fn(),
    eq: vi.fn((column: string, value: string) => ({ column, value })),
  };
});

vi.mock('@/db', () => ({ db: { select: mocks.select } }));
vi.mock('@/db/schema/practices', () => ({
  practices: { id: 'practice.id', slug: 'practice.slug' },
}));
vi.mock('@/jobs/dispatch-campaign', () => ({
  processScheduledCampaigns: mocks.processScheduledCampaigns,
}));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));
vi.mock('drizzle-orm', () => ({ eq: mocks.eq }));

import { POST } from './route';

describe('campaign cron route', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('scopes sample mode to the reserved practice', async () => {
    const practiceId = 'sample-practice-id';
    vi.stubEnv('APPOINTMENT_REMINDERS_CRON_SECRET', 'cron-secret');
    vi.stubEnv('APP_ENVIRONMENT', 'local');
    mocks.query.limit.mockResolvedValue([{ id: practiceId }]);
    mocks.processScheduledCampaigns.mockResolvedValue({ processed: 1, failed: 0 });

    const response = await POST(
      new NextRequest('http://localhost/api/cron/campaigns?sampleData=true', {
        method: 'POST',
        headers: { authorization: 'Bearer cron-secret' },
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith('practice.slug', 'appointment-reminder-sample');
    expect(mocks.processScheduledCampaigns).toHaveBeenCalledWith(practiceId);
  });

  it('rejects sample mode outside local or dev', async () => {
    vi.stubEnv('APPOINTMENT_REMINDERS_CRON_SECRET', 'cron-secret');
    vi.stubEnv('APP_ENVIRONMENT', 'production');

    const response = await POST(
      new NextRequest('http://localhost/api/cron/campaigns?sampleData=true', {
        method: 'POST',
        headers: { authorization: 'Bearer cron-secret' },
      })
    );

    expect(response.status).toBe(404);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.processScheduledCampaigns).not.toHaveBeenCalled();
  });

  it('reports a missing sample practice instead of succeeding without processing', async () => {
    vi.stubEnv('APPOINTMENT_REMINDERS_CRON_SECRET', 'cron-secret');
    vi.stubEnv('APP_ENVIRONMENT', 'local');
    mocks.query.limit.mockResolvedValue([]);

    const response = await POST(
      new NextRequest('http://localhost/api/cron/campaigns?sampleData=true', {
        method: 'POST',
        headers: { authorization: 'Bearer cron-secret' },
      })
    );

    expect(response.status).toBe(404);
    expect(mocks.processScheduledCampaigns).not.toHaveBeenCalled();
  });

  it('continues to process all due campaigns when sample mode is not requested', async () => {
    vi.stubEnv('APPOINTMENT_REMINDERS_CRON_SECRET', 'cron-secret');
    mocks.processScheduledCampaigns.mockResolvedValue({ processed: 2, failed: 0 });

    const response = await POST(
      new NextRequest('http://localhost/api/cron/campaigns', {
        method: 'POST',
        headers: { authorization: 'Bearer cron-secret' },
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.processScheduledCampaigns).toHaveBeenCalledWith();
  });
});
