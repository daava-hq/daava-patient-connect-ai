import { describe, it, expect, vi } from 'vitest';
import { requirePracticeMembership, requirePracticeAdmin } from './guards';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';

let mockMembers: any[] = [
  { id: 'm1', practiceId: 'practice-123', userId: 'user-123', role: 'admin' }
];

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mockMembers),
        }),
      }),
    }),
  },
}));

describe('requirePracticeMembership', () => {
  it('throws UnauthorizedError if userId is missing', async () => {
    await expect(requirePracticeMembership('', 'practice-123')).rejects.toThrow(UnauthorizedError);
  });

  it('returns membership if user belongs to the practice', async () => {
    mockMembers = [{ id: 'm1', practiceId: 'practice-123', userId: 'user-123', role: 'admin' }];
    const membership = await requirePracticeMembership('user-123', 'practice-123');
    expect(membership).toEqual({
      id: 'm1',
      practiceId: 'practice-123',
      userId: 'user-123',
      role: 'admin',
    });
  });

  it('throws ForbiddenError on cross-practice access attempt', async () => {
    mockMembers = []; // User is not member of practice-999
    await expect(requirePracticeMembership('user-123', 'practice-999')).rejects.toThrow(ForbiddenError);
  });
});

describe('requirePracticeAdmin', () => {
  it('allows owner or admin to pass', async () => {
    mockMembers = [{ id: 'm1', practiceId: 'practice-123', userId: 'user-123', role: 'owner' }];
    const membership = await requirePracticeAdmin('user-123', 'practice-123');
    expect(membership.role).toBe('owner');
  });

  it('rejects regular member with ForbiddenError', async () => {
    mockMembers = [{ id: 'm1', practiceId: 'practice-123', userId: 'user-123', role: 'member' }];
    await expect(requirePracticeAdmin('user-123', 'practice-123')).rejects.toThrow(ForbiddenError);
  });
});

