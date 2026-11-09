import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ForbiddenError } from '@/lib/errors';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePracticeMembership: vi.fn() }));
vi.mock('@/lib/groups/group-repository', () => ({
  addGroupMembers: vi.fn(),
  getGroupMembers: vi.fn(),
  removeGroupMembers: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { addGroupMembers, getGroupMembers } from '@/lib/groups/group-repository';
import { GET, POST } from './route';

const practiceId = '93a17272-fc4e-4e84-a229-981477a39114';
const groupId = '4b8cb22d-468e-4590-9c88-90ad1153306c';
const patientId = '383167da-f647-4808-917c-b2adf60bd9ca';
const userId = '1822f16f-5e33-4a81-8c37-3a4e52569728';
const context = { params: { groupId } };

afterEach(() => {
  vi.clearAllMocks();
});

describe('/api/groups/[groupId]/members', () => {
  it('blocks users without membership in the group practice', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(requirePracticeMembership).mockRejectedValue(new ForbiddenError());

    const response = await GET(
      new NextRequest(`http://localhost/api/groups/${groupId}/members?practiceId=${practiceId}`),
      context,
    );

    expect(response.status).toBe(403);
    expect(getGroupMembers).not.toHaveBeenCalled();
  });

  it('only adds selected members after the requested practice has been authorized', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(requirePracticeMembership).mockResolvedValue({ practiceId, userId, id: 'membership', role: 'member' });
    vi.mocked(addGroupMembers).mockResolvedValue(1);

    const response = await POST(
      new NextRequest(`http://localhost/api/groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ practiceId, patientIds: [patientId, patientId] }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(requirePracticeMembership).toHaveBeenCalledWith(userId, practiceId);
    expect(addGroupMembers).toHaveBeenCalledWith(practiceId, groupId, [patientId, patientId], userId);
  });
});
