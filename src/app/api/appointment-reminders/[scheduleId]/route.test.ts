import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeAdmin: vi.fn(),
  deleteReminderSchedule: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePracticeAdmin: mocks.requirePracticeAdmin }));
vi.mock('@/lib/appointment-reminders/reminder-service', () => ({
  deleteReminderSchedule: mocks.deleteReminderSchedule,
}));

import { DELETE } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
const scheduleId = '956c3673-2b9d-4c86-9c4b-7f6d605b3412';
const requestUrl = `http://localhost/api/appointment-reminders/${scheduleId}`;

describe('appointment reminder schedule delete route', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires an authenticated user', async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest(requestUrl, {
        method: 'DELETE',
        body: JSON.stringify({ practiceId }),
      }),
      { params: { scheduleId } }
    );

    expect(response.status).toBe(401);
    expect(mocks.deleteReminderSchedule).not.toHaveBeenCalled();
  });

  it('validates the practice and schedule identifiers', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });

    const invalidPracticeResponse = await DELETE(
      new NextRequest(requestUrl, { method: 'DELETE', body: JSON.stringify({ practiceId: 'invalid' }) }),
      { params: { scheduleId } }
    );
    const invalidScheduleResponse = await DELETE(
      new NextRequest(requestUrl, { method: 'DELETE', body: JSON.stringify({ practiceId }) }),
      { params: { scheduleId: 'invalid' } }
    );

    expect(invalidPracticeResponse.status).toBe(400);
    expect(invalidScheduleResponse.status).toBe(400);
    expect(mocks.deleteReminderSchedule).not.toHaveBeenCalled();
  });

  it('requires admin access to the selected practice', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeAdmin.mockRejectedValue(new AppError(403, 'Practice admin required', 'FORBIDDEN'));

    const response = await DELETE(
      new NextRequest(requestUrl, {
        method: 'DELETE',
        body: JSON.stringify({ practiceId }),
      }),
      { params: { scheduleId } }
    );

    expect(response.status).toBe(403);
    expect(mocks.deleteReminderSchedule).not.toHaveBeenCalled();
  });

  it('deletes a schedule scoped to the authorized practice', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeAdmin.mockResolvedValue(undefined);
    mocks.deleteReminderSchedule.mockResolvedValue({ id: scheduleId });

    const response = await DELETE(
      new NextRequest(requestUrl, {
        method: 'DELETE',
        body: JSON.stringify({ practiceId }),
      }),
      { params: { scheduleId } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.requirePracticeAdmin).toHaveBeenCalledWith('user-id', practiceId);
    expect(mocks.deleteReminderSchedule).toHaveBeenCalledWith(practiceId, scheduleId);
    expect(body.data).toEqual({ id: scheduleId });
  });
});
