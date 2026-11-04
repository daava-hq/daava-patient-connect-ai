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
  };
});

vi.mock('@/db', () => ({ db: { selectDistinct: mocks.selectDistinct } }));
vi.mock('@/db/schema/appointment_reminders', () => ({
  appointmentReminderSchedules: { practiceId: 'schedule.practiceId', enabled: 'schedule.enabled' },
}));
vi.mock('@/db/schema/practices', () => ({
  practices: { id: 'practice.id', slug: 'practice.slug' },
}));
vi.mock('@/jobs/appointment-reminders', () => ({ run: mocks.run }));
vi.mock('@/lib/env', () => ({ env: { APP_ENVIRONMENT: 'local' } }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn() }));

import { POST } from './route';

describe('appointment reminder cron route', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns the aggregated due reminder dispatch counts', async () => {
    const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
    vi.stubEnv('APPOINTMENT_REMINDERS_CRON_SECRET', 'cron-secret');
    mocks.query.where.mockResolvedValue([{ practiceId }]);
    mocks.run.mockResolvedValue({
      upserted: 6,
      processed: 6,
      sent: 6,
      failed: 0,
      skipped: 0,
    });

    const response = await POST(
      new NextRequest('http://localhost/api/cron/appointment-reminders?sampleData=true', {
        method: 'POST',
        headers: { authorization: 'Bearer cron-secret' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.run).toHaveBeenCalledWith(practiceId);
    expect(body.data).toEqual({
      practicesProcessed: 1,
      practiceFailures: 0,
      reminders: { upserted: 6, processed: 6, sent: 6, failed: 0, skipped: 0 },
    });
  });
});
