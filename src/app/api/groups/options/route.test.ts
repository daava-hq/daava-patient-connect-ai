import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  getPracticeGroupOptions: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({
  requirePracticeMembership: mocks.requirePracticeMembership,
}));
vi.mock('@/lib/groups/group-repository', () => ({
  getPracticeGroupOptions: mocks.getPracticeGroupOptions,
}));

import { GET } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';

describe('/api/groups/options', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns only group options after practice membership is verified', async () => {
    const groups = [{ id: 'group-id', name: 'Recall patients', groupType: 'dynamic' }];
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getPracticeGroupOptions.mockResolvedValue(groups);

    const response = await GET(
      new NextRequest(`http://localhost/api/groups/options?practiceId=${practiceId}`)
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: groups });
    expect(mocks.requirePracticeMembership).toHaveBeenCalledWith('member-id', practiceId);
    expect(mocks.getPracticeGroupOptions).toHaveBeenCalledWith(practiceId);
  });

  it('denies access to groups from a practice the user does not belong to', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });
    mocks.requirePracticeMembership.mockRejectedValue(new AppError(403, 'Access denied', 'FORBIDDEN'));

    const response = await GET(
      new NextRequest(`http://localhost/api/groups/options?practiceId=${practiceId}`)
    );

    expect(response.status).toBe(403);
    expect(mocks.getPracticeGroupOptions).not.toHaveBeenCalled();
  });
});
