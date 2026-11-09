import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ForbiddenError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeAdmin: vi.fn(),
  scheduleGroupAnnouncement: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePracticeAdmin: mocks.requirePracticeAdmin }));
vi.mock('@/lib/campaigns/campaign-service', () => ({
  scheduleGroupAnnouncement: mocks.scheduleGroupAnnouncement,
}));

import { POST } from './route';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
const params = {
  groupId: '93a17272-fc4e-4e84-a229-981477a39114',
  campaignId: '4a268ad3-6dd8-4249-bf44-eae847a9d647',
};

describe('/api/groups/[groupId]/announcements/[campaignId]/schedule', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires an administrator before scheduling an announcement', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });
    mocks.requirePracticeAdmin.mockRejectedValue(new ForbiddenError('Admin or Owner privileges required'));

    const response = await POST(new NextRequest('http://localhost/api/groups/group/announcements/campaign/schedule', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ practiceId, sendNow: true }),
    }), { params });

    expect(response.status).toBe(403);
    expect(mocks.scheduleGroupAnnouncement).not.toHaveBeenCalled();
  });

  it('queues an authorized send-now request for durable dispatch', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'admin-id' } });
    mocks.requirePracticeAdmin.mockResolvedValue({ practiceId, role: 'admin' });
    mocks.scheduleGroupAnnouncement.mockResolvedValue({ id: params.campaignId, status: 'scheduled' });

    const response = await POST(new NextRequest('http://localhost/api/groups/group/announcements/campaign/schedule', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ practiceId, sendNow: true }),
    }), { params });

    expect(response.status).toBe(202);
    expect(mocks.scheduleGroupAnnouncement).toHaveBeenCalledWith(
      practiceId,
      params.groupId,
      params.campaignId,
      expect.any(Date),
    );
  });
});
