import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ForbiddenError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeAdmin: vi.fn(),
  scheduleNewsletter: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePracticeAdmin: mocks.requirePracticeAdmin }));
vi.mock('@/lib/campaigns/campaign-service', () => ({ scheduleNewsletter: mocks.scheduleNewsletter }));

import { POST } from './route';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
const params = { newsletterId: '4a268ad3-6dd8-4249-bf44-eae847a9d647' };

describe('/api/newsletters/[newsletterId]/schedule', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires an authenticated user', async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const response = await POST(new NextRequest('http://localhost/api/newsletters/id/schedule', {
      method: 'POST',
      body: JSON.stringify({ practiceId, sendNow: true }),
    }), { params });
    expect(response.status).toBe(401);
  });

  it('requires practice admin authorization before scheduling', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });
    mocks.requirePracticeAdmin.mockRejectedValue(new ForbiddenError('Admin or Owner privileges required'));
    const response = await POST(new NextRequest('http://localhost/api/newsletters/id/schedule', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ practiceId, sendNow: true }),
    }), { params });
    expect(response.status).toBe(403);
    expect(mocks.scheduleNewsletter).not.toHaveBeenCalled();
  });

  it('queues an authorized send-now request for durable dispatch', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'admin-id' } });
    mocks.requirePracticeAdmin.mockResolvedValue({ practiceId, role: 'admin' });
    mocks.scheduleNewsletter.mockResolvedValue({ id: params.newsletterId, status: 'scheduled' });
    const response = await POST(new NextRequest('http://localhost/api/newsletters/id/schedule', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ practiceId, sendNow: true }),
    }), { params });
    expect(response.status).toBe(202);
    expect(mocks.scheduleNewsletter).toHaveBeenCalledWith(
      practiceId,
      params.newsletterId,
      expect.any(Date),
    );
  });
});
