import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ForbiddenError } from '@/lib/errors';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePracticeMembership: vi.fn() }));
vi.mock('@/lib/groups/group-repository', () => ({
  createGroup: vi.fn(),
  getPracticeGroups: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { createGroup, getPracticeGroups } from '@/lib/groups/group-repository';
import { GET, POST } from './route';

const practiceId = '93a17272-fc4e-4e84-a229-981477a39114';
const userId = '1822f16f-5e33-4a81-8c37-3a4e52569728';

afterEach(() => {
  vi.clearAllMocks();
});

describe('/api/groups', () => {
  it('returns the practice-scoped group list after membership is verified', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(requirePracticeMembership).mockResolvedValue({ practiceId, userId, id: 'membership', role: 'member' });
    vi.mocked(getPracticeGroups).mockResolvedValue({
      groups: [],
      total: 0,
      limit: 25,
      offset: 0,
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/groups?practiceId=${practiceId}&page=1&limit=25`),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { groups: [], total: 0, page: 1 },
    });
    expect(getPracticeGroups).toHaveBeenCalledWith(
      practiceId,
      { search: undefined, includeArchived: false, limit: 25, offset: 0 }
    );
  });

  it('requires membership in the requested practice before listing its groups', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(requirePracticeMembership).mockRejectedValue(new ForbiddenError());

    const response = await GET(
      new NextRequest(`http://localhost/api/groups?practiceId=${practiceId}`),
    );

    expect(response.status).toBe(403);
    expect(getPracticeGroups).not.toHaveBeenCalled();
  });

  it('rejects unsupported dynamic filter attributes', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId } } as never);

    const response = await POST(
      new NextRequest('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          practiceId,
          name: 'Unsupported criteria',
          groupType: 'dynamic',
          criteria: { diagnosis: 'not permitted' },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(requirePracticeMembership).not.toHaveBeenCalled();
    expect(createGroup).not.toHaveBeenCalled();
  });

  it('creates a dynamic group only after practice membership is verified', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(requirePracticeMembership).mockResolvedValue({ practiceId, userId, id: 'membership', role: 'member' });
    vi.mocked(createGroup).mockResolvedValue({
      id: '4b8cb22d-468e-4590-9c88-90ad1153306c',
      practiceId,
      name: 'Active adults',
      description: null,
      groupType: 'dynamic',
      criteria: { minAge: 18 },
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const response = await POST(
      new NextRequest('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          practiceId,
          name: 'Active adults',
          groupType: 'dynamic',
          criteria: { minAge: 18 },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(requirePracticeMembership).toHaveBeenCalledWith(userId, practiceId);
    expect(createGroup).toHaveBeenCalledWith(
      expect.objectContaining({ practiceId, groupType: 'dynamic', criteria: { minAge: 18 } }),
      [],
      userId,
    );
  });
});
