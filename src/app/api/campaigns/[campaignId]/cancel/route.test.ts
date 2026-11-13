import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeAdmin: vi.fn(),
  getCampaignById: vi.fn(),
  transitionCampaign: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePracticeAdmin: mocks.requirePracticeAdmin }));
vi.mock('@/lib/campaigns/campaign-service', () => ({
  getCampaignById: mocks.getCampaignById,
  transitionCampaign: mocks.transitionCampaign,
}));

import { POST } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
const campaignId = 'acd01036-a724-4f4a-b339-18b5d6efc30f';

function request(body: unknown) {
  return new NextRequest(`http://localhost/api/campaigns/${campaignId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/campaigns/[campaignId]/cancel', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('requires admin access and cancels only a Recall campaign in the authorized practice', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'admin-id' } });
    mocks.requirePracticeAdmin.mockResolvedValue({ practiceId, role: 'admin' });
    mocks.getCampaignById.mockResolvedValue({ id: campaignId, type: 'recall', status: 'scheduled' });
    mocks.transitionCampaign.mockResolvedValue({ id: campaignId, status: 'cancelled' });

    const response = await POST(request({ practiceId }), { params: { campaignId } });

    expect(response.status).toBe(200);
    expect(mocks.getCampaignById).toHaveBeenCalledWith(practiceId, campaignId);
    expect(mocks.transitionCampaign).toHaveBeenCalledWith(practiceId, campaignId, 'cancelled');
  });

  it('does not transition another campaign type', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'admin-id' } });
    mocks.requirePracticeAdmin.mockResolvedValue({ practiceId, role: 'admin' });
    mocks.getCampaignById.mockResolvedValue({ id: campaignId, type: 'newsletter', status: 'scheduled' });

    const response = await POST(request({ practiceId }), { params: { campaignId } });

    expect(response.status).toBe(404);
    expect(mocks.transitionCampaign).not.toHaveBeenCalled();
  });

  it('returns an authorization error without cancelling', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });
    mocks.requirePracticeAdmin.mockRejectedValue(new AppError(403, 'Practice admin required', 'FORBIDDEN'));

    const response = await POST(request({ practiceId }), { params: { campaignId } });

    expect(response.status).toBe(403);
    expect(mocks.getCampaignById).not.toHaveBeenCalled();
  });
});
