import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  countAudience: vi.fn(),
  resolveAudience: vi.fn(),
  ensurePracticeGroups: vi.fn(),
  ensureRecallAudienceGroups: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePracticeMembership: mocks.requirePracticeMembership }));
vi.mock('@/lib/campaigns/audience-service', () => ({
  countAudience: mocks.countAudience,
  resolveAudience: mocks.resolveAudience,
}));
vi.mock('@/lib/groups/group-repository', () => ({
  ensurePracticeGroups: mocks.ensurePracticeGroups,
  ensureRecallAudienceGroups: mocks.ensureRecallAudienceGroups,
}));

import { POST } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
const groupId = '4b8cb22d-468e-4590-9c88-90ad1153306c';

function request(body: unknown) {
  return new NextRequest('http://localhost/api/audience/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/audience/preview', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('applies Recall consent and group rules but returns only sample names', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.ensureRecallAudienceGroups.mockResolvedValue(undefined);
    mocks.countAudience.mockResolvedValue(1);
    mocks.resolveAudience.mockResolvedValue([{
      id: 'patient-id',
      firstName: 'Alex',
      lastName: 'Morgan',
      email: 'alex@example.test',
      phoneMobile: '5550100',
      dateOfBirth: '1980-01-01',
    }]);

    const response = await POST(request({
      practiceId,
      type: 'recall',
      channel: 'email',
      filter: { groupIds: [groupId], consentEmail: false },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.ensureRecallAudienceGroups).toHaveBeenCalledWith(practiceId, [groupId]);
    expect(mocks.countAudience).toHaveBeenCalledWith(practiceId, expect.objectContaining({
      groupIds: [groupId],
      patientStatuses: ['Patient'],
      consentEmail: true,
      destinationChannel: 'email',
    }));
    expect(body.data.preview).toEqual([{ firstName: 'Alex', lastName: 'Morgan' }]);
    expect(JSON.stringify(body)).not.toContain('alex@example.test');
    expect(JSON.stringify(body)).not.toContain('5550100');
    expect(JSON.stringify(body)).not.toContain('1980-01-01');
  });

  it('rejects Recall audience preview without a due-recall group or channel', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'member-id' } });

    const response = await POST(request({ practiceId, type: 'recall' }));

    expect(response.status).toBe(400);
    expect(mocks.requirePracticeMembership).not.toHaveBeenCalled();
    expect(mocks.resolveAudience).not.toHaveBeenCalled();
  });

  it('blocks membership from another practice before resolving any audience', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'outside-user' } });
    mocks.requirePracticeMembership.mockRejectedValue(new AppError(403, 'Access denied', 'FORBIDDEN'));

    const response = await POST(request({
      practiceId,
      type: 'recall',
      channel: 'sms',
      filter: { groupIds: [groupId] },
    }));

    expect(response.status).toBe(403);
    expect(mocks.resolveAudience).not.toHaveBeenCalled();
  });
});
