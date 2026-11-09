import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  requirePracticeAdmin: vi.fn(),
  getBirthdayCampaigns: vi.fn(),
  getBirthdayTemplateOptions: vi.fn(),
  createBirthdayCampaign: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({
  requirePracticeMembership: mocks.requirePracticeMembership,
  requirePracticeAdmin: mocks.requirePracticeAdmin,
}));
vi.mock('@/lib/birthdays/birthday-service', () => ({
  getBirthdayCampaigns: mocks.getBirthdayCampaigns,
  getBirthdayTemplateOptions: mocks.getBirthdayTemplateOptions,
  createBirthdayCampaign: mocks.createBirthdayCampaign,
}));

import { GET, POST } from './route';
import { AppError } from '@/lib/errors';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
const templateId = 'c52d0f0d-e50a-4da9-85da-f7c10a184e88';

describe('/api/birthdays/campaigns', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('limits campaign configuration to practice administrators', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });
    mocks.requirePracticeAdmin.mockRejectedValue(new AppError(403, 'Admin or Owner privileges required', 'FORBIDDEN'));
    const response = await POST(new NextRequest('http://localhost/api/birthdays/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practiceId,
        name: 'Birthday greetings',
        channel: 'sms',
        templateId,
        daysBefore: 0,
        localDeliveryTime: '09:00',
        enabled: true,
      }),
    }));
    expect(response.status).toBe(403);
    expect(mocks.createBirthdayCampaign).not.toHaveBeenCalled();
  });

  it('does not enable campaigns unless the administrator explicitly requests it', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'admin-id' } });
    mocks.requirePracticeAdmin.mockResolvedValue({ practiceId, role: 'admin' });
    mocks.createBirthdayCampaign.mockResolvedValue({ id: 'campaign-id', enabled: false });
    const response = await POST(new NextRequest('http://localhost/api/birthdays/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practiceId,
        name: 'Birthday greetings',
        channel: 'sms',
        templateId,
        daysBefore: 0,
        localDeliveryTime: '09:00',
      }),
    }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(mocks.createBirthdayCampaign).toHaveBeenCalledWith(
      practiceId,
      'admin-id',
      expect.objectContaining({ enabled: false })
    );
    expect(body.data.enabled).toBe(false);
  });

  it('validates campaign channel and time before creating configuration', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'admin-id' } });
    const response = await POST(new NextRequest('http://localhost/api/birthdays/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practiceId,
        name: 'Birthday greetings',
        channel: 'push',
        templateId,
        daysBefore: 0,
        localDeliveryTime: '25:65',
      }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.requirePracticeAdmin).not.toHaveBeenCalled();
  });

  it('requires practice membership before returning campaign or template choices', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });
    mocks.requirePracticeMembership.mockRejectedValue(new AppError(403, 'Access denied', 'FORBIDDEN'));
    const response = await GET(new NextRequest(`http://localhost/api/birthdays/campaigns?practiceId=${practiceId}`));
    expect(response.status).toBe(403);
    expect(mocks.getBirthdayCampaigns).not.toHaveBeenCalled();
    expect(mocks.getBirthdayTemplateOptions).not.toHaveBeenCalled();
  });
});
