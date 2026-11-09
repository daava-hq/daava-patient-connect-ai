import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ForbiddenError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  getGroupAnnouncementDetails: vi.fn(),
  getCampaignStats: vi.fn(),
  getGroupById: vi.fn(),
  getGroupAnnouncementTemplate: vi.fn(),
  updateGroupAnnouncementDraft: vi.fn(),
  softDeleteCampaign: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePracticeMembership: mocks.requirePracticeMembership }));
vi.mock('@/lib/campaigns/campaign-service', () => ({
  getGroupAnnouncementDetails: mocks.getGroupAnnouncementDetails,
  softDeleteCampaign: mocks.softDeleteCampaign,
  updateGroupAnnouncementDraft: mocks.updateGroupAnnouncementDraft,
}));
vi.mock('@/lib/campaigns/recipient-tracking', () => ({ getCampaignStats: mocks.getCampaignStats }));
vi.mock('@/lib/groups/group-repository', () => ({
  getGroupAnnouncementTemplate: mocks.getGroupAnnouncementTemplate,
  getGroupById: mocks.getGroupById,
}));

import { GET, PATCH, DELETE } from './route';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
const groupId = '93a17272-fc4e-4e84-a229-981477a39114';
const campaignId = '4a268ad3-6dd8-4249-bf44-eae847a9d647';
const params = { groupId, campaignId };

function announcementRequest(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/groups/${groupId}/announcements/${campaignId}${method === 'DELETE' ? `?practiceId=${practiceId}` : ''}`, {
    method,
    ...(body === undefined ? {} : {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
}

describe('/api/groups/[groupId]/announcements/[campaignId]', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a campaign report for the matching practice group', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getGroupAnnouncementDetails.mockResolvedValue({ campaign: { id: campaignId }, content: {} });
    mocks.getCampaignStats.mockResolvedValue({ total: 3, sent: 2 });

    const response = await GET(
      new NextRequest(`http://localhost/api/groups/${groupId}/announcements/${campaignId}?practiceId=${practiceId}`),
      { params },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { campaign: { id: campaignId }, stats: { total: 3, sent: 2 } },
    });
  });

  it('rejects users without practice membership before loading an announcement', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'outside-user' } });
    mocks.requirePracticeMembership.mockRejectedValue(new ForbiddenError('Access denied'));

    const response = await GET(
      new NextRequest(`http://localhost/api/groups/${groupId}/announcements/${campaignId}?practiceId=${practiceId}`),
      { params },
    );

    expect(response.status).toBe(403);
    expect(mocks.getGroupAnnouncementDetails).not.toHaveBeenCalled();
  });

  it('updates draft metadata without replacing the saved template snapshot', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getGroupById.mockResolvedValue({ id: groupId, archivedAt: null });
    mocks.getGroupAnnouncementDetails.mockResolvedValue({ campaign: { id: campaignId }, content: {} });
    mocks.updateGroupAnnouncementDraft.mockResolvedValue({ id: campaignId, status: 'draft' });

    const response = await PATCH(announcementRequest('PATCH', {
      practiceId,
      name: 'Updated announcement',
    }), { params });

    expect(response.status).toBe(200);
    expect(mocks.updateGroupAnnouncementDraft).toHaveBeenCalledWith({
      practiceId,
      groupId,
      campaignId,
      name: 'Updated announcement',
      content: undefined,
    });
    expect(mocks.getGroupAnnouncementTemplate).not.toHaveBeenCalled();
  });

  it('soft-deletes only a draft associated with this group', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getGroupAnnouncementDetails.mockResolvedValue({ campaign: { id: campaignId } });
    mocks.softDeleteCampaign.mockResolvedValue(undefined);

    const response = await DELETE(announcementRequest('DELETE'), { params });

    expect(response.status).toBe(200);
    expect(mocks.softDeleteCampaign).toHaveBeenCalledWith(practiceId, campaignId);
  });
});
