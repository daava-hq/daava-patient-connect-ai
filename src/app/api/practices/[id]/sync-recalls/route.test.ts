import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  runRecallSync: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({
  requirePracticeMembership: mocks.requirePracticeMembership,
}));
vi.mock('@/jobs/sync-recalls', () => ({ runRecallSync: mocks.runRecallSync }));

import { POST } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';

describe('POST /api/practices/[id]/sync-recalls', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires an authenticated session', async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await POST(
      new NextRequest(`http://localhost/api/practices/${practiceId}/sync-recalls`),
      { params: { id: practiceId } },
    );

    expect(response.status).toBe(401);
    expect(mocks.requirePracticeMembership).not.toHaveBeenCalled();
  });

  it('requires owner authorization for the verified practice', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ role: 'member' });

    const response = await POST(
      new NextRequest(`http://localhost/api/practices/${practiceId}/sync-recalls`),
      { params: { id: practiceId } },
    );

    expect(response.status).toBe(403);
    expect(mocks.requirePracticeMembership).toHaveBeenCalledWith('member-id', practiceId);
    expect(mocks.runRecallSync).not.toHaveBeenCalled();
  });

  it('runs the recall sync only after practice membership and owner checks pass', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'owner-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ role: 'owner' });
    mocks.runRecallSync.mockResolvedValue({ success: true, count: 4, skippedCount: 1 });

    const response = await POST(
      new NextRequest(`http://localhost/api/practices/${practiceId}/sync-recalls`),
      { params: { id: practiceId } },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { count: 4, skippedCount: 1 },
    });
    expect(mocks.runRecallSync).toHaveBeenCalledWith(practiceId);
  });

  it('returns the membership error without exposing another practice data', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'outside-user' } });
    mocks.requirePracticeMembership.mockRejectedValue(new AppError(403, 'Access denied', 'FORBIDDEN'));

    const response = await POST(
      new NextRequest(`http://localhost/api/practices/${practiceId}/sync-recalls`),
      { params: { id: practiceId } },
    );

    expect(response.status).toBe(403);
    expect(mocks.runRecallSync).not.toHaveBeenCalled();
  });
});
