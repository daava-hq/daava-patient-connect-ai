import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  getBirthdayDashboard: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({
  requirePracticeMembership: mocks.requirePracticeMembership,
}));
vi.mock('@/lib/birthdays/birthday-service', () => ({
  getBirthdayDashboard: mocks.getBirthdayDashboard,
}));

import { GET } from './route';
import { AppError } from '@/lib/errors';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';

describe('GET /api/birthdays', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires an authenticated session', async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const response = await GET(new NextRequest(`http://localhost/api/birthdays?practiceId=${practiceId}`));
    expect(response.status).toBe(401);
  });

  it('validates the practice and enforces practice membership', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    const invalidResponse = await GET(new NextRequest('http://localhost/api/birthdays?practiceId=not-a-uuid'));
    expect(invalidResponse.status).toBe(400);

    mocks.requirePracticeMembership.mockRejectedValue(new AppError(403, 'Access denied', 'FORBIDDEN'));
    const deniedResponse = await GET(new NextRequest(`http://localhost/api/birthdays?practiceId=${practiceId}`));
    expect(deniedResponse.status).toBe(403);
    expect(mocks.getBirthdayDashboard).not.toHaveBeenCalled();
  });

  it('returns birthday data only after the requested practice is authorized', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getBirthdayDashboard.mockResolvedValue({ birthdays: [], timezone: 'America/New_York' });

    const response = await GET(
      new NextRequest(`http://localhost/api/birthdays?practiceId=${practiceId}&range=tomorrow`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.requirePracticeMembership).toHaveBeenCalledWith('user-id', practiceId);
    expect(mocks.getBirthdayDashboard).toHaveBeenCalledWith({
      practiceId,
      range: 'tomorrow',
      customStart: undefined,
      customEnd: undefined,
    });
    expect(body.data.timezone).toBe('America/New_York');
  });

  it('accepts custom date bounds for calendar month queries', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getBirthdayDashboard.mockResolvedValue({ birthdays: [], timezone: 'UTC' });

    const response = await GET(
      new NextRequest(`http://localhost/api/birthdays?practiceId=${practiceId}&range=custom&startDate=2026-03-01&endDate=2026-03-07`)
    );

    expect(response.status).toBe(200);
    expect(mocks.getBirthdayDashboard).toHaveBeenCalledWith({
      practiceId,
      range: 'custom',
      customStart: '2026-03-01',
      customEnd: '2026-03-07',
    });
  });
});
