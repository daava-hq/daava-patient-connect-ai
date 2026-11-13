import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  getPublishedRecallTemplate: vi.fn(),
  ensureRecallAudienceGroups: vi.fn(),
  resolveAudience: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({ db: { select: mocks.select } }));
vi.mock('@/lib/templates/template-service', () => ({
  getPublishedRecallTemplate: mocks.getPublishedRecallTemplate,
}));
vi.mock('@/lib/groups/group-repository', () => ({
  ensureRecallAudienceGroups: mocks.ensureRecallAudienceGroups,
}));
vi.mock('./audience-service', () => ({ resolveAudience: mocks.resolveAudience }));

import { scheduleRecallCampaign } from './campaign-service';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
const campaignId = 'a4d5c28c-6e15-4f4f-9f4f-4e78bd704fa6';
const sourceTemplateId = 'fa551008-3ac9-424d-a597-36e109387c68';

describe('scheduleRecallCampaign', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a draft whose source Recall template is no longer published', async () => {
    const campaign = {
      id: campaignId,
      practiceId,
      type: 'recall',
      status: 'draft',
      channel: 'sms',
      templateId: '23ec9ad5-4e51-46d8-9d8b-5521a575f3a5',
      sourceTemplateId,
      audienceFilter: { groupIds: [] },
    };
    mocks.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [campaign],
        }),
      }),
    });
    mocks.getPublishedRecallTemplate.mockResolvedValue(null);

    await expect(scheduleRecallCampaign(
      practiceId,
      campaignId,
      new Date(Date.now() + 60_000),
    )).rejects.toThrow('Select a published Recall template before scheduling');

    expect(mocks.getPublishedRecallTemplate).toHaveBeenCalledWith(
      practiceId,
      sourceTemplateId,
      'sms',
    );
    expect(mocks.ensureRecallAudienceGroups).not.toHaveBeenCalled();
  });
});
