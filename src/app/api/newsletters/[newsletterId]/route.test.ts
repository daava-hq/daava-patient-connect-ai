import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  getCampaignById: vi.fn(),
  softDeleteCampaign: vi.fn(),
  ensurePracticeGroups: vi.fn(),
  getNewsletterDetails: vi.fn(),
  getCampaignStats: vi.fn(),
  updateNewsletterDraft: vi.fn(),
  getPublishedNewsletterTemplate: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePracticeMembership: mocks.requirePracticeMembership }));
vi.mock('@/lib/groups/group-repository', () => ({ ensurePracticeGroups: mocks.ensurePracticeGroups }));
vi.mock('@/lib/campaigns/campaign-service', () => ({
  getCampaignById: mocks.getCampaignById,
  getNewsletterDetails: mocks.getNewsletterDetails,
  softDeleteCampaign: mocks.softDeleteCampaign,
  updateNewsletterDraft: mocks.updateNewsletterDraft,
}));
vi.mock('@/lib/campaigns/recipient-tracking', () => ({ getCampaignStats: mocks.getCampaignStats }));
vi.mock('@/lib/templates/template-service', () => ({
  getPublishedNewsletterTemplate: mocks.getPublishedNewsletterTemplate,
}));

import { DELETE, GET, PATCH } from './route';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
const newsletterId = '39d598db-a09b-484a-9c31-b1909f3ab7b4';

describe('/api/newsletters/[newsletterId]', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates draft details without replacing its existing content snapshot', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.updateNewsletterDraft.mockResolvedValue({ id: newsletterId, status: 'draft' });

    const response = await PATCH(new NextRequest(`http://localhost/api/newsletters/${newsletterId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        practiceId,
        name: 'Updated newsletter name',
        audienceFilter: {},
      }),
    }), { params: { newsletterId } });

    expect(response.status).toBe(200);
    expect(mocks.updateNewsletterDraft).toHaveBeenCalledWith(expect.objectContaining({
      practiceId,
      campaignId: newsletterId,
      name: 'Updated newsletter name',
      content: undefined,
    }));
    expect(mocks.getPublishedNewsletterTemplate).not.toHaveBeenCalled();
  });

  it('returns campaign-specific report details and stats', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getNewsletterDetails.mockResolvedValue({
      campaign: { id: newsletterId, name: 'Spring update', status: 'cancelled' },
      content: {},
    });
    mocks.getCampaignStats.mockResolvedValue({ total: 4, sent: 2, clicked: 1 });

    const response = await GET(
      new NextRequest(`http://localhost/api/newsletters/${newsletterId}?practiceId=${practiceId}`),
      { params: { newsletterId } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        campaign: { id: newsletterId, name: 'Spring update' },
        stats: { total: 4, sent: 2, clicked: 1 },
      },
    });
  });

  it('soft-deletes a newsletter campaign', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getCampaignById.mockResolvedValue({ id: newsletterId, type: 'newsletter', status: 'cancelled' });
    mocks.softDeleteCampaign.mockResolvedValue(undefined);

    const response = await DELETE(
      new NextRequest(`http://localhost/api/newsletters/${newsletterId}?practiceId=${practiceId}`, { method: 'DELETE' }),
      { params: { newsletterId } },
    );

    expect(response.status).toBe(200);
    expect(mocks.softDeleteCampaign).toHaveBeenCalledWith(practiceId, newsletterId);
  });

  it('does not delete a non-newsletter campaign', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getCampaignById.mockResolvedValue({ id: newsletterId, type: 'group_announcement', status: 'cancelled' });

    const response = await DELETE(
      new NextRequest(`http://localhost/api/newsletters/${newsletterId}?practiceId=${practiceId}`, { method: 'DELETE' }),
      { params: { newsletterId } },
    );

    expect(response.status).toBe(404);
    expect(mocks.softDeleteCampaign).not.toHaveBeenCalled();
  });
});
