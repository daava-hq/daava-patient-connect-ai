import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  getTemplateById: vi.fn(),
  updateTemplate: vi.fn(),
  archiveTemplate: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePracticeMembership: mocks.requirePracticeMembership }));
vi.mock('@/lib/templates/template-service', () => ({
  getTemplateById: mocks.getTemplateById,
  updateTemplate: mocks.updateTemplate,
  archiveTemplate: mocks.archiveTemplate,
}));

import { PATCH } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
const templateId = '956c3673-2b9d-4c86-9c4b-7f6d605b3412';
const requestUrl = `http://localhost/api/templates/${templateId}`;

describe('template update route', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not allow changing a template channel after creation', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue(undefined);
    mocks.getTemplateById.mockResolvedValue({
      id: templateId,
      practiceId,
      channel: 'sms',
      content: { body: 'Appointment reminder' },
      isSystem: false,
    });

    const response = await PATCH(
      new NextRequest(requestUrl, {
        method: 'PATCH',
        body: JSON.stringify({ practiceId, channel: 'email' }),
      }),
      { params: { templateId } }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Template channel cannot be changed after creation',
    });
    expect(mocks.updateTemplate).not.toHaveBeenCalled();
  });

  it('allows edits that keep the template channel unchanged', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue(undefined);
    mocks.getTemplateById.mockResolvedValue({
      id: templateId,
      practiceId,
      channel: 'sms',
      content: { body: 'Old message' },
      isSystem: false,
    });
    mocks.updateTemplate.mockResolvedValue({ id: templateId, channel: 'sms' });

    const response = await PATCH(
      new NextRequest(requestUrl, {
        method: 'PATCH',
        body: JSON.stringify({
          practiceId,
          channel: 'sms',
          content: { body: 'Updated message' },
        }),
      }),
      { params: { templateId } }
    );

    expect(response.status).toBe(200);
    expect(mocks.updateTemplate).toHaveBeenCalledWith(
      practiceId,
      templateId,
      { channel: 'sms', content: { body: 'Updated message' } },
      'user-id'
    );
  });
});
