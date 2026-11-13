import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  createCampaign: vi.fn(),
  createRecallCampaignDraft: vi.fn(),
  getPracticeCampaigns: vi.fn(),
  ensurePracticeGroups: vi.fn(),
  ensureRecallAudienceGroups: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({
  requirePracticeMembership: mocks.requirePracticeMembership,
}));
vi.mock('@/lib/campaigns/campaign-service', () => ({
  createCampaign: mocks.createCampaign,
  createRecallCampaignDraft: mocks.createRecallCampaignDraft,
  getPracticeCampaigns: mocks.getPracticeCampaigns,
}));
vi.mock('@/lib/groups/group-repository', () => ({
  ensurePracticeGroups: mocks.ensurePracticeGroups,
  ensureRecallAudienceGroups: mocks.ensureRecallAudienceGroups,
}));

import { POST } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
const groupId = '4b8cb22d-468e-4590-9c88-90ad1153306c';
const sourceTemplateId = 'b22dd235-6f67-4b2d-87d1-f45bc492bcf0';

function request(body: unknown) {
  return new NextRequest('http://localhost/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/campaigns recall audience', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires a due-recall group before creating a Recall campaign', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'owner-id' } });

    const response = await POST(request({
      practiceId,
      name: 'Recall follow-up',
      type: 'recall',
      channel: 'sms',
    }));

    expect(response.status).toBe(400);
    expect(mocks.requirePracticeMembership).not.toHaveBeenCalled();
    expect(mocks.createCampaign).not.toHaveBeenCalled();
  });

  it('validates the due-recall group and creates a snapshot from the selected Recall template', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'owner-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.ensureRecallAudienceGroups.mockResolvedValue(undefined);
    mocks.createCampaign.mockResolvedValue({ id: 'campaign-id' });

    const response = await POST(request({
      practiceId,
      name: 'Recall follow-up',
      type: 'recall',
      channel: 'sms',
      sourceTemplateId,
      audienceFilter: { groupIds: [groupId], consentSms: false },
    }));

    expect(response.status).toBe(201);
    expect(mocks.ensureRecallAudienceGroups).toHaveBeenCalledWith(practiceId, [groupId]);
    expect(mocks.createRecallCampaignDraft).toHaveBeenCalledWith(expect.objectContaining({
      practiceId,
      sourceTemplateId,
      name: 'Recall follow-up',
      audienceFilter: {
        groupIds: [groupId],
        consentSms: false,
      },
    }));
    expect(mocks.createCampaign).not.toHaveBeenCalled();
  });

  it('uses email consent for a Recall campaign with the email channel', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'owner-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.ensureRecallAudienceGroups.mockResolvedValue(undefined);
    mocks.createCampaign.mockResolvedValue({ id: 'campaign-id' });

    const response = await POST(request({
      practiceId,
      name: 'Recall email follow-up',
      type: 'recall',
      channel: 'email',
      sourceTemplateId,
      audienceFilter: { groupIds: [groupId], consentSms: false },
    }));

    expect(response.status).toBe(201);
    expect(mocks.createRecallCampaignDraft).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'email',
      audienceFilter: {
        groupIds: [groupId],
        consentSms: false,
      },
    }));
  });

  it('rejects a user who is not a member of the requested practice', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'outside-user' } });
    mocks.requirePracticeMembership.mockRejectedValue(new AppError(403, 'Access denied', 'FORBIDDEN'));

    const response = await POST(request({
      practiceId,
      name: 'Recall follow-up',
      type: 'recall',
      channel: 'sms',
      sourceTemplateId,
      audienceFilter: { groupIds: [groupId] },
    }));

    expect(response.status).toBe(403);
    expect(mocks.ensureRecallAudienceGroups).not.toHaveBeenCalled();
    expect(mocks.createCampaign).not.toHaveBeenCalled();
  });
});
