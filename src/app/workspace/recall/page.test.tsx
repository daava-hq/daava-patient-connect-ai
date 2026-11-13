import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RecallPage from './page';

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock('@/components/feedback/ToastProvider/ToastProvider', () => ({
  useToast: () => ({ showToast }),
}));

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
const groupId = 'ec4656f1-b33a-4da5-8ac1-c4b19e65a093';
const smsTemplateId = 'fa551008-3ac9-424d-a597-36e109387c68';
const emailTemplateId = '789d4bac-af3c-47b6-9e80-f65b38179822';
interface TestCampaign {
  id: string;
  name: string;
  type: string;
  channel: string;
  status: string;
  scheduledAt: string | null;
  sourceTemplateId: string;
  audienceFilter: { groupIds: string[]; consentSms: boolean };
  sentCount: number;
  deliveredCount: number;
  totalRecipients: number;
  createdAt: string;
}

const campaign: TestCampaign = {
  id: 'campaign-1',
  name: '6-Month Hygiene Recall',
  type: 'recall',
  channel: 'sms',
  status: 'draft',
  scheduledAt: null,
  sourceTemplateId: smsTemplateId,
  audienceFilter: { groupIds: [groupId], consentSms: true },
  sentCount: 0,
  deliveredCount: 0,
  totalRecipients: 0,
  createdAt: '2026-03-15T12:00:00.000Z',
};

const templates = [
  {
    id: smsTemplateId,
    categoryId: 'recall-category',
    name: 'Recall SMS',
    description: 'SMS reminder',
    templateType: 'sms',
    channel: 'sms',
    status: 'published',
    isSystem: true,
    content: { body: 'Hi {{patient.firstName}}, your recall is due on {{recall.dueDate}}.' },
  },
  {
    id: emailTemplateId,
    categoryId: 'recall-category',
    name: 'Recall Email',
    description: 'Email reminder',
    templateType: 'newsletter',
    channel: 'email',
    status: 'published',
    isSystem: true,
    content: {
      subject: 'Recall for {{patient.firstName}}',
      sections: [{
        blocks: [{ type: 'paragraph', properties: { text: 'Your recall is due on {{recall.dueDate}}.' } }],
      }],
    },
  },
];

function setupFetch(initialCampaigns: TestCampaign[] = []) {
  let campaigns = [...initialCampaigns];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url.startsWith('/api/campaigns?')) {
      return Response.json({ data: { campaigns, total: campaigns.length } });
    }
    if (url.startsWith('/api/templates?')) {
      return Response.json({
        data: {
          categories: [{ id: 'recall-category', slug: 'recall' }],
          templates,
        },
      });
    }
    if (url.startsWith('/api/practices/')) {
      return Response.json({ data: { timezone: 'America/New_York' } });
    }
    if (url.startsWith('/api/groups/recall-options?')) {
      return Response.json({
        data: [{ id: groupId, name: 'Due recalls', groupType: 'dynamic', memberCount: 4 }],
      });
    }
    if (url === '/api/audience/preview' && method === 'POST') {
      return Response.json({
        data: { count: 2, preview: [{ firstName: 'Alex', lastName: 'Morgan' }] },
      });
    }
    if (url.endsWith('/recipients?practiceId=' + practiceId + '&limit=50')) {
      return Response.json({ data: [] });
    }
    if (url.includes('/api/campaigns/') && url.includes('?practiceId=') && method === 'GET') {
      const campaignId = url.split('/api/campaigns/')[1].split('?')[0];
      const item = campaigns.find((candidate) => candidate.id === campaignId) ?? campaign;
      return Response.json({
        data: {
          ...item,
          stats: { total: 3, sent: 2, delivered: 1, bounced: 0, failed: 1, skipped: 0 },
        },
      });
    }
    if (url === '/api/campaigns' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const created = {
        ...campaign,
        id: 'campaign-created',
        name: String(body.name),
        channel: String(body.channel),
        sourceTemplateId: String(body.sourceTemplateId),
      };
      campaigns = [...campaigns, created];
      return Response.json({ data: created }, { status: 201 });
    }
    if (url.startsWith('/api/campaigns/') && method === 'PATCH') {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const updated: TestCampaign = {
        ...campaign,
        id: campaign.id,
        name: typeof body.name === 'string' ? body.name : campaign.name,
        channel: typeof body.channel === 'string' ? body.channel : campaign.channel,
      };
      campaigns = campaigns.map((item) => item.id === campaign.id ? updated : item);
      return Response.json({ data: updated });
    }
    if (url.endsWith('/schedule') && method === 'POST') {
      return Response.json({ data: { ...campaign, status: 'scheduled' } }, { status: 202 });
    }
    if (url.endsWith('/cancel') && method === 'POST') {
      return Response.json({ data: { ...campaign, status: 'cancelled' } });
    }
    if (url.includes('/api/campaigns/') && method === 'DELETE') {
      return Response.json({ success: true });
    }
    if (url.startsWith('/api/campaigns/') && method === 'GET') {
      return Response.json({
        data: {
          ...campaign,
          stats: { total: 3, sent: 2, delivered: 1, bounced: 0, failed: 1, skipped: 0 },
        },
      });
    }
    return Response.json({ error: `Unexpected request: ${method} ${url}` }, { status: 500 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function openNewDraft() {
  await screen.findByRole('heading', { name: 'No recall campaigns yet' });
  fireEvent.click(screen.getByRole('button', { name: 'New Recall Campaign' }));
  return screen.findByRole('dialog', { name: 'Create Recall Campaign' });
}

async function chooseTemplate(dialog: HTMLElement, templateName: string) {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Select template' }));
  const picker = await screen.findByRole('dialog', { name: /Recall templates/ });
  fireEvent.click(within(picker).getByRole('button', { name: /^Select$/ }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /Recall templates/ })).toBeNull());
  expect(within(dialog).getByText(templateName)).toBeTruthy();
}

describe('RecallPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('requires an explicit channel and supports published template preview and audience preview', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = setupFetch();
    render(<RecallPage />);

    const dialog = await openNewDraft();
    const channel = within(dialog).getByRole('combobox', { name: 'Channel' }) as HTMLSelectElement;
    expect(channel.value).toBe('');
    expect(within(dialog).getByRole('button', { name: 'Save draft' }).hasAttribute('disabled')).toBe(true);

    fireEvent.change(channel, { target: { value: 'sms' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Campaign Name' }), {
      target: { value: 'Recall Follow-up' },
    });
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: /Due recalls/ }));
    await chooseTemplate(dialog, 'Recall SMS');
    expect(within(dialog).getByText(/Hi Alex, your recall is due on June 15, 2026/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Preview audience' }));
    expect(await within(dialog).findByText('2 eligible SMS recipients')).toBeTruthy();
    expect(within(dialog).getByText('Sample: Alex Morgan')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/audience/preview', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        practiceId,
        type: 'recall',
        channel: 'sms',
        filter: { groupIds: [groupId] },
      }),
    }));
  });

  it('creates a Recall draft with the selected published template and due-recall audience', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = setupFetch();
    render(<RecallPage />);

    const dialog = await openNewDraft();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Campaign Name' }), {
      target: { value: 'Recall Follow-up' },
    });
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Channel' }), {
      target: { value: 'sms' },
    });
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: /Due recalls/ }));
    await chooseTemplate(dialog, 'Recall SMS');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Recall campaign created successfully', 'success'));
    const saveCall = fetchMock.mock.calls.find(([url, init]) => String(url) === '/api/campaigns' && init?.method === 'POST');
    expect(JSON.parse(String(saveCall?.[1]?.body))).toEqual({
      practiceId,
      name: 'Recall Follow-up',
      type: 'recall',
      channel: 'sms',
      sourceTemplateId: smsTemplateId,
      audienceFilter: { groupIds: [groupId], consentSms: true },
    });
  });

  it('edits an existing Recall draft and preserves its selected template', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = setupFetch([campaign]);
    render(<RecallPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit 6-Month Hygiene Recall' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Recall Campaign' });
    expect(within(dialog).getByText('Recall SMS')).toBeTruthy();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Campaign Name' }), {
      target: { value: 'Recall Follow-up' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Recall campaign updated successfully', 'success'));
    const updateCall = fetchMock.mock.calls.find(([url, init]) =>
      String(url) === `/api/campaigns/${campaign.id}` && init?.method === 'PATCH'
    );
    expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
      practiceId,
      name: 'Recall Follow-up',
      channel: 'sms',
      sourceTemplateId: smsTemplateId,
      audienceFilter: { groupIds: [groupId], consentSms: true },
    });
  });

  it('queues an explicit send-now request after audience preview and confirmation', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = setupFetch();
    render(<RecallPage />);

    const dialog = await openNewDraft();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Campaign Name' }), {
      target: { value: 'Recall Today' },
    });
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Channel' }), {
      target: { value: 'sms' },
    });
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: /Due recalls/ }));
    await chooseTemplate(dialog, 'Recall SMS');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send now' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Recall campaign queued for dispatch', 'success'));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('2 eligible text recipients'));
    expect(fetchMock).toHaveBeenCalledWith('/api/campaigns/campaign-created/schedule', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ practiceId, sendNow: true }),
    }));
  });

  it('shows report metrics and scheduled-campaign cancellation controls', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const scheduled = { ...campaign, status: 'scheduled', scheduledAt: '2026-08-15T15:00:00.000Z' };
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = setupFetch([scheduled]);
    render(<RecallPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'View report for 6-Month Hygiene Recall' }));
    expect(await screen.findByText('Sent / accepted')).toBeTruthy();
    expect(screen.getByText('2', { selector: 'strong' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close Recall report' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel 6-Month Hygiene Recall' }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Recall campaign cancelled', 'success'));
    expect(confirm).toHaveBeenCalledWith('Cancel this scheduled Recall campaign?');
    expect(fetchMock).toHaveBeenCalledWith(`/api/campaigns/${campaign.id}/cancel`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ practiceId }),
    }));
  });
});
