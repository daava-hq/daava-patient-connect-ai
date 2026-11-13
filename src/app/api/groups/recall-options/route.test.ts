import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  getRecallAudienceGroupOptions: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({
  requirePracticeMembership: mocks.requirePracticeMembership,
}));
vi.mock('@/lib/groups/group-repository', () => ({
  getRecallAudienceGroupOptions: mocks.getRecallAudienceGroupOptions,
}));

import { GET } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';

describe('GET /api/groups/recall-options', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns only authorized due-recall group options', async () => {
    const groups = [{ id: 'due-group', name: 'Due recalls', groupType: 'dynamic' }];
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getRecallAudienceGroupOptions.mockResolvedValue(groups);

    const response = await GET(
      new NextRequest(`http://localhost/api/groups/recall-options?practiceId=${practiceId}`),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: groups });
    expect(mocks.requirePracticeMembership).toHaveBeenCalledWith('member-id', practiceId);
    expect(mocks.getRecallAudienceGroupOptions).toHaveBeenCalledWith(practiceId);
  });

  it('rejects invalid practice identifiers before querying groups', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });

    const response = await GET(
      new NextRequest('http://localhost/api/groups/recall-options?practiceId=invalid'),
    );

    expect(response.status).toBe(400);
    expect(mocks.requirePracticeMembership).not.toHaveBeenCalled();
  });

  it('denies access when the user does not belong to the requested practice', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'outside-user' } });
    mocks.requirePracticeMembership.mockRejectedValue(new AppError(403, 'Access denied', 'FORBIDDEN'));

    const response = await GET(
      new NextRequest(`http://localhost/api/groups/recall-options?practiceId=${practiceId}`),
    );

    expect(response.status).toBe(403);
    expect(mocks.getRecallAudienceGroupOptions).not.toHaveBeenCalled();
  });
});
