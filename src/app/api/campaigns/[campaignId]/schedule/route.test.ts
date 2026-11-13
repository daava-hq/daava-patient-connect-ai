import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeAdmin: vi.fn(),
  scheduleRecallCampaign: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePracticeAdmin: mocks.requirePracticeAdmin }));
vi.mock('@/lib/campaigns/campaign-service', () => ({
  scheduleRecallCampaign: mocks.scheduleRecallCampaign,
}));

import { POST } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
const campaignId = 'acd01036-a724-4f4a-b339-18b5d6efc30f';

function request(body: unknown) {
  return new NextRequest(`http://localhost/api/campaigns/${campaignId}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/campaigns/[campaignId]/schedule', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('requires an authenticated practice administrator', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });
    mocks.requirePracticeAdmin.mockRejectedValue(new AppError(403, 'Practice admin required', 'FORBIDDEN'));

    const response = await POST(request({ practiceId, sendNow: true }), { params: { campaignId } });

    expect(response.status).toBe(403);
    expect(mocks.scheduleRecallCampaign).not.toHaveBeenCalled();
  });

  it('queues send-now through the durable campaign scheduler', async () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    mocks.getServerSession.mockResolvedValue({ user: { id: 'admin-id' } });
    mocks.requirePracticeAdmin.mockResolvedValue({ practiceId, role: 'admin' });
    mocks.scheduleRecallCampaign.mockResolvedValue({ id: campaignId, status: 'scheduled' });

    const response = await POST(request({ practiceId, sendNow: true }), { params: { campaignId } });

    expect(response.status).toBe(202);
    expect(mocks.requirePracticeAdmin).toHaveBeenCalledWith('admin-id', practiceId);
    expect(mocks.scheduleRecallCampaign).toHaveBeenCalledWith(
      practiceId,
      campaignId,
      new Date(now + 5000),
    );
  });

  it('rejects a request without a schedule time or send-now intent', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'admin-id' } });

    const response = await POST(request({ practiceId }), { params: { campaignId } });

    expect(response.status).toBe(400);
    expect(mocks.requirePracticeAdmin).not.toHaveBeenCalled();
  });
});
