import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  ensurePracticeGroups: vi.fn(),
  updateNewsletterDraft: vi.fn(),
  getPublishedNewsletterTemplate: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePracticeMembership: mocks.requirePracticeMembership }));
vi.mock('@/lib/groups/group-repository', () => ({ ensurePracticeGroups: mocks.ensurePracticeGroups }));
vi.mock('@/lib/campaigns/campaign-service', () => ({
  getNewsletterDetails: vi.fn(),
  updateNewsletterDraft: mocks.updateNewsletterDraft,
}));
vi.mock('@/lib/campaigns/recipient-tracking', () => ({ getCampaignStats: vi.fn() }));
vi.mock('@/lib/templates/template-service', () => ({
  getPublishedNewsletterTemplate: mocks.getPublishedNewsletterTemplate,
}));

import { PATCH } from './route';

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
});
