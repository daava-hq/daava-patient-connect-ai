import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeAdmin: vi.fn(),
  resetSampleAppointmentReminderData: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({
  requirePracticeAdmin: mocks.requirePracticeAdmin,
}));
vi.mock('@/lib/appointment-reminders/reminder-service', () => ({
  resetSampleAppointmentReminderData: mocks.resetSampleAppointmentReminderData,
}));

import { POST } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';

describe('sample appointment reminder reset route', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires an authenticated user', async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await POST(
      new NextRequest('http://localhost/api/appointment-reminders/sample-data/reset', {
        method: 'POST',
        body: JSON.stringify({ practiceId }),
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.resetSampleAppointmentReminderData).not.toHaveBeenCalled();
  });

  it('denies users without admin access to the selected practice', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeAdmin.mockRejectedValue(
      new AppError(403, 'Practice admin required', 'FORBIDDEN')
    );

    const response = await POST(
      new NextRequest('http://localhost/api/appointment-reminders/sample-data/reset', {
        method: 'POST',
        body: JSON.stringify({ practiceId }),
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.resetSampleAppointmentReminderData).not.toHaveBeenCalled();
  });

  it('rejects invalid practice IDs', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });

    const response = await POST(
      new NextRequest('http://localhost/api/appointment-reminders/sample-data/reset', {
        method: 'POST',
        body: JSON.stringify({ practiceId: 'not-a-uuid' }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.resetSampleAppointmentReminderData).not.toHaveBeenCalled();
  });

  it('resets the sample data for an authorized admin', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeAdmin.mockResolvedValue(undefined);
    mocks.resetSampleAppointmentReminderData.mockResolvedValue({
      deletedReminders: 6,
      resetPatients: 10,
      resetAppointments: 10,
    });

    const response = await POST(
      new NextRequest('http://localhost/api/appointment-reminders/sample-data/reset', {
        method: 'POST',
        body: JSON.stringify({ practiceId }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.requirePracticeAdmin).toHaveBeenCalledWith('user-id', practiceId);
    expect(body.data).toMatchObject({
      deletedReminders: 6,
      resetPatients: 10,
      resetAppointments: 10,
    });
  });
});
