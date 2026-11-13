import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  getCampaignById: vi.fn(),
  updateCampaign: vi.fn(),
  updateRecallCampaignDraft: vi.fn(),
  transitionCampaign: vi.fn(),
  softDeleteCampaign: vi.fn(),
  getCampaignStats: vi.fn(),
  ensurePracticeGroups: vi.fn(),
  ensureRecallAudienceGroups: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({
  requirePracticeMembership: mocks.requirePracticeMembership,
  requirePracticeAdmin: vi.fn(),
}));
vi.mock('@/lib/campaigns/campaign-service', () => ({
  getCampaignById: mocks.getCampaignById,
  updateCampaign: mocks.updateCampaign,
  updateRecallCampaignDraft: mocks.updateRecallCampaignDraft,
  transitionCampaign: mocks.transitionCampaign,
  softDeleteCampaign: mocks.softDeleteCampaign,
}));
vi.mock('@/lib/campaigns/recipient-tracking', () => ({
  getCampaignStats: mocks.getCampaignStats,
}));
vi.mock('@/lib/groups/group-repository', () => ({
  ensurePracticeGroups: mocks.ensurePracticeGroups,
  ensureRecallAudienceGroups: mocks.ensureRecallAudienceGroups,
}));

import { PATCH } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
const campaignId = 'acd01036-a724-4f4a-b339-18b5d6efc30f';
const groupId = '4b8cb22d-468e-4590-9c88-90ad1153306c';

function request(body: unknown) {
  return new NextRequest(`http://localhost/api/campaigns/${campaignId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function recallDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: campaignId,
    practiceId,
    name: 'Recall follow-up',
    type: 'recall',
    channel: 'sms',
    status: 'draft',
    audienceFilter: { groupIds: [groupId], consentSms: true },
    sourceTemplateId: 'b22dd235-6f67-4b2d-87d1-f45bc492bcf0',
    ...overrides,
  };
}

describe('PATCH /api/campaigns/[campaignId]', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates Recall draft fields and aligns audience consent to the selected channel', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getCampaignById.mockResolvedValue(recallDraft());
    mocks.ensureRecallAudienceGroups.mockResolvedValue(undefined);
    mocks.updateRecallCampaignDraft.mockResolvedValue(recallDraft({ channel: 'email' }));

    const response = await PATCH(request({
      practiceId,
      name: 'Recall email follow-up',
      channel: 'email',
      audienceFilter: { groupIds: [groupId], consentEmail: true },
    }), { params: { campaignId } });

    expect(response.status).toBe(200);
    expect(mocks.ensureRecallAudienceGroups).toHaveBeenCalledWith(practiceId, [groupId]);
    expect(mocks.updateRecallCampaignDraft).toHaveBeenCalledWith({
      practiceId,
      campaignId,
      name: 'Recall email follow-up',
      channel: 'email',
      audienceFilter: {
        groupIds: [groupId],
        consentEmail: true,
        patientStatuses: ['Patient'],
        destinationChannel: 'email',
      },
    });
  });

  it('updates channel-only changes using the saved audience and switches consent filters', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getCampaignById.mockResolvedValue(recallDraft());
    mocks.ensureRecallAudienceGroups.mockResolvedValue(undefined);
    mocks.updateRecallCampaignDraft.mockResolvedValue(recallDraft({ channel: 'email' }));

    const response = await PATCH(request({ practiceId, channel: 'email' }), { params: { campaignId } });

    expect(response.status).toBe(200);
    expect(mocks.updateRecallCampaignDraft).toHaveBeenCalledWith({
      practiceId,
      campaignId,
      channel: 'email',
      audienceFilter: {
        groupIds: [groupId],
        consentEmail: true,
        patientStatuses: ['Patient'],
        destinationChannel: 'email',
      },
    });
  });

  it('does not allow changing a non-Recall campaign channel', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getCampaignById.mockResolvedValue(recallDraft({ type: 'reminder' }));

    const response = await PATCH(request({ practiceId, channel: 'email' }), { params: { campaignId } });

    expect(response.status).toBe(400);
    expect(mocks.updateRecallCampaignDraft).not.toHaveBeenCalled();
    expect(mocks.updateCampaign).not.toHaveBeenCalled();
  });

  it('rejects users without membership in the campaign practice', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'outside-user' } });
    mocks.requirePracticeMembership.mockRejectedValue(new AppError(403, 'Access denied', 'FORBIDDEN'));

    const response = await PATCH(request({ practiceId, channel: 'email' }), { params: { campaignId } });

    expect(response.status).toBe(403);
    expect(mocks.getCampaignById).not.toHaveBeenCalled();
    expect(mocks.updateRecallCampaignDraft).not.toHaveBeenCalled();
    expect(mocks.updateCampaign).not.toHaveBeenCalled();
  });
});
