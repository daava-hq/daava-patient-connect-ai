import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  confirmAppointmentFromEmail: vi.fn(),
}));

vi.mock('@/lib/appointment-reminders/reminder-service', () => ({
  confirmAppointmentFromEmail: mocks.confirmAppointmentFromEmail,
}));

import { POST } from './route';

describe('email appointment confirmation route', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid request bodies', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/appointment-reminders/confirm', {
        method: 'POST',
        body: JSON.stringify({ token: '', practiceId: 'untrusted' }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.confirmAppointmentFromEmail).not.toHaveBeenCalled();
  });

  it('uses the signed token and returns the confirmation result', async () => {
    mocks.confirmAppointmentFromEmail.mockResolvedValue({
      confirmed: true,
      alreadyConfirmed: false,
    });

    const response = await POST(
      new NextRequest('http://localhost/api/appointment-reminders/confirm', {
        method: 'POST',
        body: JSON.stringify({ token: 'signed-capability-token' }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.confirmAppointmentFromEmail).toHaveBeenCalledWith('signed-capability-token');
    await expect(response.json()).resolves.toMatchObject({
      data: { confirmed: true, alreadyConfirmed: false },
    });
  });

  it('returns typed validation and Open Dental errors', async () => {
    mocks.confirmAppointmentFromEmail.mockRejectedValueOnce(
      new AppError(400, 'This appointment confirmation link is invalid or expired')
    ).mockRejectedValueOnce(
      new AppError(502, 'Open Dental could not confirm this appointment. Please contact the practice.')
    );

    const invalidLink = await POST(
      new NextRequest('http://localhost/api/appointment-reminders/confirm', {
        method: 'POST',
        body: JSON.stringify({ token: 'invalid' }),
      })
    );
    const unavailable = await POST(
      new NextRequest('http://localhost/api/appointment-reminders/confirm', {
        method: 'POST',
        body: JSON.stringify({ token: 'valid-shaped-token' }),
      })
    );

    expect(invalidLink.status).toBe(400);
    expect(unavailable.status).toBe(502);
  });
});
