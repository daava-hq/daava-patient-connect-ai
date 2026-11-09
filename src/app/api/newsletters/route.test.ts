import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ForbiddenError } from '@/lib/errors';
import { parseNewsletterDocument } from '@/lib/newsletters/newsletter-content';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  ensurePracticeGroups: vi.fn(),
  countAudience: vi.fn(),
  createNewsletterCampaign: vi.fn(),
  getPracticeCampaigns: vi.fn(),
  getNewsletterDashboardStats: vi.fn(),
  getPublishedNewsletterTemplate: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePracticeMembership: mocks.requirePracticeMembership }));
vi.mock('@/lib/groups/group-repository', () => ({ ensurePracticeGroups: mocks.ensurePracticeGroups }));
vi.mock('@/lib/campaigns/audience-service', () => ({ countAudience: mocks.countAudience }));
vi.mock('@/lib/campaigns/campaign-service', () => ({
  createNewsletterCampaign: mocks.createNewsletterCampaign,
  getPracticeCampaigns: mocks.getPracticeCampaigns,
  getNewsletterDashboardStats: mocks.getNewsletterDashboardStats,
}));
vi.mock('@/lib/templates/template-service', () => ({
  getPublishedNewsletterTemplate: mocks.getPublishedNewsletterTemplate,
}));

import { GET, POST } from './route';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
const validDraft = {
  practiceId,
  name: 'Monthly Smile Update',
  sourceTemplateId: '37c345c4-5c53-4d51-97dc-9653bbab1489',
};
const validTemplate = {
  content: {
    subject: 'News from {{practice.name}}',
    sections: [{ blocks: [{ type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}' } }] }],
  },
};

describe('/api/newsletters', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires an authenticated user to list newsletters', async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const response = await GET(new NextRequest(`http://localhost/api/newsletters?practiceId=${practiceId}`));
    expect(response.status).toBe(401);
  });

  it('rejects users without practice membership', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockRejectedValue(new ForbiddenError('Access denied'));
    const response = await GET(new NextRequest(`http://localhost/api/newsletters?practiceId=${practiceId}`));
    expect(response.status).toBe(403);
  });

  it('creates a consent-filtered newsletter draft for the authorized practice', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getPublishedNewsletterTemplate.mockResolvedValue(validTemplate);
    mocks.countAudience.mockResolvedValue(12);
    mocks.createNewsletterCampaign.mockResolvedValue({ id: 'campaign-id', status: 'draft' });

    const response = await POST(new NextRequest('http://localhost/api/newsletters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validDraft),
    }));

    expect(response.status).toBe(201);
    expect(mocks.countAudience).toHaveBeenCalledWith(practiceId, {
      patientStatuses: ['Patient'],
      consentEmail: true,
    });
    expect(mocks.createNewsletterCampaign).toHaveBeenCalledWith(expect.objectContaining({
      practiceId,
      content: parseNewsletterDocument(validTemplate.content),
      audienceFilter: { patientStatuses: ['Patient'], consentEmail: true },
    }));
  });

  it('rejects requests without a centralized template', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    const response = await POST(new NextRequest('http://localhost/api/newsletters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validDraft, sourceTemplateId: undefined }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.createNewsletterCampaign).not.toHaveBeenCalled();
  });

  it('does not accept client-supplied newsletter content', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    const response = await POST(new NextRequest('http://localhost/api/newsletters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validDraft, content: validTemplate.content }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.getPublishedNewsletterTemplate).not.toHaveBeenCalled();
    expect(mocks.createNewsletterCampaign).not.toHaveBeenCalled();
  });

  it('rejects invalid centralized template content before persisting a draft', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({ practiceId });
    mocks.getPublishedNewsletterTemplate.mockResolvedValue({
      content: {
        subject: 'News',
        sections: [{ blocks: [{ type: 'paragraph', properties: { text: '{{patient.dateOfBirth}}' } }] }],
      },
    });

    const response = await POST(new NextRequest('http://localhost/api/newsletters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validDraft),
    }));

    expect(response.status).toBe(400);
    expect(mocks.createNewsletterCampaign).not.toHaveBeenCalled();
  });
});
