import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  requirePracticeAdmin: vi.fn(),
  getReminderDashboard: vi.fn(),
  createReminderSchedule: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({
  requirePracticeMembership: mocks.requirePracticeMembership,
  requirePracticeAdmin: mocks.requirePracticeAdmin,
}));
vi.mock('@/lib/appointment-reminders/reminder-service', () => ({
  getReminderDashboard: mocks.getReminderDashboard,
  createReminderSchedule: mocks.createReminderSchedule,
}));

import { GET } from './route';

describe('appointment reminder dashboard route', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('denies access when the signed-in user is not a member of the requested practice', async () => {
    const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockRejectedValue(
      new AppError(403, 'Practice membership required', 'FORBIDDEN')
    );

    const response = await GET(
      new NextRequest(`http://localhost/api/appointment-reminders?practiceId=${practiceId}`)
    );

    expect(response.status).toBe(403);
    expect(mocks.getReminderDashboard).not.toHaveBeenCalled();
  });
});
