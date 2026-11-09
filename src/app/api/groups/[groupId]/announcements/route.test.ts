import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePracticeMembership: vi.fn() }));
vi.mock('@/lib/campaigns/campaign-service', () => ({ createAnnouncementDraft: vi.fn() }));
vi.mock('@/lib/groups/group-repository', () => ({
  getGroupAnnouncementTemplate: vi.fn(),
  getGroupById: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { createAnnouncementDraft } from '@/lib/campaigns/campaign-service';
import { getGroupAnnouncementTemplate, getGroupById } from '@/lib/groups/group-repository';
import { POST } from './route';

const practiceId = '93a17272-fc4e-4e84-a229-981477a39114';
const groupId = '4b8cb22d-468e-4590-9c88-90ad1153306c';
const templateId = '729171c1-c444-4ed7-a1ba-f2b0c1a4116a';
const userId = '1822f16f-5e33-4a81-8c37-3a4e52569728';

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/groups/[groupId]/announcements', () => {
  it('creates a draft using a campaign-compatible template snapshot', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(requirePracticeMembership).mockResolvedValue({
      practiceId,
      userId,
      id: 'membership',
      role: 'member',
    });
    vi.mocked(getGroupById).mockResolvedValue({ id: groupId } as never);
    vi.mocked(getGroupAnnouncementTemplate).mockResolvedValue({
      id: templateId,
      name: 'Family Dental Care Program',
      channel: 'email',
      content: {
        subject: 'Caring for {{practice.name}}',
        blocks: [{ type: 'paragraph', text: 'Hello {{patient.firstName}}' }],
      },
    } as never);
    vi.mocked(createAnnouncementDraft).mockResolvedValue({
      id: 'campaign-id',
      practiceId,
      name: 'Spring announcement',
    } as never);

    const response = await POST(
      new NextRequest(`http://localhost/api/groups/${groupId}/announcements`, {
        method: 'POST',
        body: JSON.stringify({ practiceId, name: 'Spring announcement', templateId }),
      }),
      { params: { groupId } },
    );

    expect(response.status).toBe(201);
    expect(createAnnouncementDraft).toHaveBeenCalledWith(expect.objectContaining({
      practiceId,
      name: 'Spring announcement',
      groupId,
      template: expect.objectContaining({
        name: 'Family Dental Care Program',
        subject: 'Caring for {{practice.name}}',
        body: 'Hello {{patient.firstName}}',
        content: expect.objectContaining({
          subject: 'Caring for {{practice.name}}',
          sections: [expect.objectContaining({
            blocks: [expect.objectContaining({
              id: 'section-1-block-1',
              type: 'paragraph',
            })],
          })],
        }),
      }),
    }));
  });

  it('rejects selected templates without an email subject', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(requirePracticeMembership).mockResolvedValue({
      practiceId,
      userId,
      id: 'membership',
      role: 'member',
    });
    vi.mocked(getGroupById).mockResolvedValue({ id: groupId } as never);
    vi.mocked(getGroupAnnouncementTemplate).mockResolvedValue({
      id: templateId,
      name: 'Invalid template',
      channel: 'email',
      content: { blocks: [{ type: 'paragraph', text: 'Content' }] },
    } as never);

    const response = await POST(
      new NextRequest(`http://localhost/api/groups/${groupId}/announcements`, {
        method: 'POST',
        body: JSON.stringify({ practiceId, name: 'Spring announcement', templateId }),
      }),
      { params: { groupId } },
    );

    expect(response.status).toBe(400);
    expect(createAnnouncementDraft).not.toHaveBeenCalled();
  });

  it('does not create announcements for archived groups', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(requirePracticeMembership).mockResolvedValue({
      practiceId,
      userId,
      id: 'membership',
      role: 'member',
    });
    vi.mocked(getGroupById).mockResolvedValue({ id: groupId, archivedAt: new Date() } as never);

    const response = await POST(
      new NextRequest(`http://localhost/api/groups/${groupId}/announcements`, {
        method: 'POST',
        body: JSON.stringify({ practiceId, name: 'Spring announcement', templateId }),
      }),
      { params: { groupId } },
    );

    expect(response.status).toBe(404);
    expect(createAnnouncementDraft).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON without creating a campaign', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId } } as never);

    const response = await POST(
      new NextRequest(`http://localhost/api/groups/${groupId}/announcements`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
      { params: { groupId } },
    );

    expect(response.status).toBe(400);
    expect(createAnnouncementDraft).not.toHaveBeenCalled();
  });
});
