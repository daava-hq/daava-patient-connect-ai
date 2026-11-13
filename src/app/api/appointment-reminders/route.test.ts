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

import { GET, POST } from './route';

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

  it('passes selected groups to the schedule service', async () => {
    const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
    const groupId = '5f5297c3-1d15-4858-9d3e-80691372da91';
    mocks.getServerSession.mockResolvedValue({ user: { id: 'admin-id' } });
    mocks.requirePracticeAdmin.mockResolvedValue({ practiceId, role: 'admin' });
    mocks.createReminderSchedule.mockResolvedValue({ id: 'schedule-id', groupIds: [groupId] });

    const response = await POST(new NextRequest('http://localhost/api/appointment-reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practiceId,
        name: 'Group reminder',
        interval: '24_hours',
        channel: 'sms',
        localSendTime: '09:00',
        templateId: 'c52d0f0d-e50a-4da9-85da-f7c10a184e88',
        groupIds: [groupId],
      }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.createReminderSchedule).toHaveBeenCalledWith(
      practiceId,
      'admin-id',
      expect.objectContaining({ groupIds: [groupId] })
    );
  });

  it('rejects invalid group identifiers before creating a schedule', async () => {
    const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
    mocks.getServerSession.mockResolvedValue({ user: { id: 'admin-id' } });

    const response = await POST(new NextRequest('http://localhost/api/appointment-reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practiceId,
        name: 'Group reminder',
        interval: '24_hours',
        channel: 'sms',
        localSendTime: '09:00',
        templateId: 'c52d0f0d-e50a-4da9-85da-f7c10a184e88',
        groupIds: ['not-a-uuid'],
      }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.createReminderSchedule).not.toHaveBeenCalled();
  });
});
