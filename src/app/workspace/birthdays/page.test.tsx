import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback/ToastProvider/ToastProvider';
import BirthdaysPage from './page';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
const dashboard = {
  timezone: 'UTC',
  selectedRange: { start: '2026-03-01', end: '2026-03-07' },
  metrics: { today: 0, tomorrow: 0, next7Days: 0, thisMonth: 0, patientsMissingBirthdate: 0 },
  birthdays: [],
  todayBirthdays: [],
  upcomingBirthdays: [],
  campaigns: [],
  history: [],
  scheduledMessages: [],
  report: {},
};

const birthdayEmailTemplate = {
  id: 'template-email',
  name: 'Birthday email',
  channel: 'email' as const,
  content: {},
  variables: [],
  status: 'published',
  isSystem: true,
};

function createFetchMock(
  templates: typeof birthdayEmailTemplate[] = [],
  campaigns: Array<Record<string, unknown>> = [],
  previewResult?: { subject: string; body: string; unresolved: string[] },
  scheduledMessages: Array<Record<string, unknown>> = [],
  groupOptions: Array<{ id: string; name: string; groupType: 'static' | 'dynamic' }> = [],
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/birthdays?')) {
      return Response.json({ data: { ...dashboard, campaigns, scheduledMessages } });
    }
    if (url.startsWith('/api/groups/options?')) {
      return Response.json({ data: groupOptions });
    }
    if (url.startsWith('/api/birthdays/campaigns?')) {
      return Response.json({ data: { templates } });
    }
    if (url === '/api/birthdays/campaigns' && init?.method === 'POST') {
      return Response.json({ data: { id: 'new-campaign', enabled: false } }, { status: 201 });
    }
    if (url === '/api/birthdays/preview' && previewResult) {
      return Response.json({ data: previewResult });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
}

describe('BirthdaysPage range selection', () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('selectedClinicId', practiceId);
    fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('keeps fixed range selection across overview and calendar while hiding custom controls', async () => {
    render(
      <ToastProvider>
        <BirthdaysPage />
      </ToastProvider>,
    );

    await screen.findByText('Upcoming birthdays');
    const metrics = screen.getByRole('region', { name: 'Birthday metrics' });
    expect(within(metrics).getByText('Today')).toBeDefined();
    expect(within(metrics).getByText('Next 7 days')).toBeDefined();
    const rangeSelect = screen.getByLabelText('Show') as HTMLSelectElement;
    expect(rangeSelect.value).toBe('next7');
    expect(screen.getByRole('tab', { name: 'Calendar' })).toBeDefined();
    expect(screen.queryByRole('option', { name: 'Custom range' })).toBeNull();
    expect(screen.queryByLabelText('From')).toBeNull();
    expect(screen.queryByLabelText('To')).toBeNull();

    fireEvent.change(rangeSelect, { target: { value: 'thisMonth' } });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('range=thisMonth'));
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
    expect(await screen.findByText('Monthly birthday calendar')).toBeDefined();
    expect(screen.queryByLabelText('Show')).toBeNull();
    expect(screen.queryByRole('option', { name: 'Custom range' })).toBeNull();
    expect(screen.queryByLabelText('From')).toBeNull();
    expect(screen.queryByLabelText('To')).toBeNull();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('range=custom&startDate='));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('range=custom&startDate='));
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Campaign settings' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('range=thisMonth'));
    });
    expect((screen.getByLabelText('Show') as HTMLSelectElement).value).toBe('thisMonth');
  });

  it('shows scheduled deliveries after campaign settings', async () => {
    fetchMock = createFetchMock(
      [],
      [{
        id: 'campaign-1',
        name: 'Birthday Greeting',
        channel: 'email',
        templateId: 'template-email',
        daysBefore: 2,
        localDeliveryTime: '09:00',
        offerText: null,
        eligibilityRules: {},
        enabled: true,
        templateName: 'Birthday email',
        templateStatus: 'published',
      }],
      undefined,
      [{
        id: 'occurrence-1',
        campaignName: 'Birthday Greeting',
        channel: 'email',
        firstName: 'Avery',
        lastName: 'Example',
        birthdayDate: '2026-03-04',
        scheduledFor: '2026-03-02T09:00:00.000Z',
        status: 'scheduled',
      }],
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ToastProvider>
        <BirthdaysPage />
      </ToastProvider>,
    );

    await screen.findByText('Upcoming birthdays');
    const tabNames = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabNames.indexOf('Scheduled messages')).toBe(tabNames.indexOf('Campaign settings') + 1);
    fireEvent.click(screen.getByRole('tab', { name: 'Scheduled messages' }));

    expect(await screen.findByRole('heading', { name: 'Scheduled birthday messages' })).toBeDefined();
    expect(screen.getByText('Avery Example')).toBeDefined();
    expect(screen.getByText('Birthday Greeting')).toBeDefined();
    expect(screen.getByText('March 4')).toBeDefined();
    expect(screen.getByText('EMAIL')).toBeDefined();
    expect(screen.getByText('Scheduled')).toBeDefined();
    expect(screen.getByText(/Mar 2, 2026/)).toBeDefined();
  });

  it('shows the persisted delivery status for a scheduled birthday message', async () => {
    fetchMock = createFetchMock(
      [],
      [],
      undefined,
      [{
        id: 'occurrence-sent',
        campaignName: 'Birthday Greeting',
        channel: 'email',
        firstName: 'Avery',
        lastName: 'Example',
        birthdayDate: '2026-03-04',
        scheduledFor: '2026-03-02T09:00:00.000Z',
        status: 'sent',
      }],
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ToastProvider>
        <BirthdaysPage />
      </ToastProvider>,
    );

    await screen.findByText('Upcoming birthdays');
    fireEvent.click(screen.getByRole('tab', { name: 'Scheduled messages' }));

    expect(await screen.findByText('sent')).toBeDefined();
    expect(screen.queryByText('Scheduled')).toBeNull();
  });

  it('lets campaign creators select a channel-compatible birthday template from a picker', async () => {
    fetchMock = createFetchMock([birthdayEmailTemplate]);
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ToastProvider>
        <BirthdaysPage />
      </ToastProvider>,
    );

    await screen.findByText('Upcoming birthdays');
    fireEvent.click(screen.getByRole('button', { name: 'New campaign' }));
    expect(screen.getByLabelText('Local delivery time (UTC)')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Channel'), { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose template' }));

    const picker = await screen.findByRole('dialog', { name: 'Birthday templates' });
    expect(screen.getByText('Only published EMAIL templates from the Birthdays category are listed.')).toBeDefined();
    expect(within(picker).getByText('Birthday email')).toBeDefined();
    fireEvent.click(within(picker).getByRole('button', { name: 'Select' }));

    expect(await screen.findByText('Birthday email')).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Birthday templates' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Save campaign' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('saves the selected reusable group audience with the campaign', async () => {
    fetchMock = createFetchMock([birthdayEmailTemplate], [], undefined, [], [
      { id: 'group-1', name: 'New patients', groupType: 'static' },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ToastProvider>
        <BirthdaysPage />
      </ToastProvider>,
    );

    await screen.findByText('Upcoming birthdays');
    fireEvent.click(screen.getByRole('button', { name: 'New campaign' }));
    fireEvent.change(screen.getByLabelText('Campaign name'), { target: { value: 'Group birthday campaign' } });
    fireEvent.change(screen.getByLabelText('Channel'), { target: { value: 'email' } });
    fireEvent.click(await screen.findByRole('checkbox', { name: /New patients/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose template' }));
    const picker = await screen.findByRole('dialog', { name: 'Birthday templates' });
    fireEvent.click(within(picker).getByRole('button', { name: 'Select' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save campaign' }));

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(([input]) => String(input) === '/api/birthdays/campaigns');
      expect(request).toBeDefined();
      const payload = JSON.parse(String(request?.[1]?.body));
      expect(payload.eligibilityRules.groupIds).toEqual(['group-1']);
    });
  });

  it('lets campaign editors replace a template without closing the editor', async () => {
    const campaign = {
      id: 'campaign-1',
      name: 'Birthday email campaign',
      channel: 'email' as const,
      templateId: 'old-template',
      daysBefore: 1,
      localDeliveryTime: '09:00',
      offerText: null,
      eligibilityRules: {},
      enabled: false,
      templateName: 'Old birthday email',
      templateStatus: 'published',
    };
    fetchMock = createFetchMock([birthdayEmailTemplate], [campaign]);
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ToastProvider>
        <BirthdaysPage />
      </ToastProvider>,
    );

    await screen.findByText('Upcoming birthdays');
    fireEvent.click(screen.getByRole('tab', { name: 'Campaign settings' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Birthday email campaign' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose template' }));

    const picker = await screen.findByRole('dialog', { name: 'Birthday templates' });
    fireEvent.click(within(picker).getByRole('button', { name: 'Select' }));

    expect(await screen.findByRole('heading', { name: 'Edit birthday campaign' })).toBeDefined();
    expect(screen.getByText('Birthday email')).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Birthday templates' })).toBeNull();
  });

  it('shows a birthday message preview in a modal above the campaign editor', async () => {
    const campaign = {
      id: 'campaign-1',
      name: 'Birthday email campaign',
      channel: 'email' as const,
      templateId: birthdayEmailTemplate.id,
      daysBefore: 1,
      localDeliveryTime: '09:00',
      offerText: null,
      eligibilityRules: {},
      enabled: false,
      templateName: birthdayEmailTemplate.name,
      templateStatus: 'published',
    };
    fetchMock = createFetchMock([birthdayEmailTemplate], [campaign], {
      subject: 'Happy birthday, Taylor!',
      body: 'We hope you have a wonderful birthday.',
      unresolved: [],
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ToastProvider>
        <BirthdaysPage />
      </ToastProvider>,
    );

    await screen.findByText('Upcoming birthdays');
    fireEvent.click(screen.getByRole('tab', { name: 'Campaign settings' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Birthday email campaign' }));
    const editor = screen.getByRole('dialog', { name: 'Edit birthday campaign' });
    fireEvent.click(within(editor).getByRole('button', { name: 'Preview message' }));

    const previewDialog = await screen.findByRole('dialog', { name: 'Birthday message preview' });
    expect(within(previewDialog).getByText('Happy birthday, Taylor!')).toBeTruthy();
    expect(within(previewDialog).getByText('We hope you have a wonderful birthday.')).toBeTruthy();

    fireEvent.click(within(previewDialog).getByRole('button', { name: 'Close message preview' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Edit birthday campaign' })).toBeTruthy();
      expect(screen.queryByRole('dialog', { name: 'Birthday message preview' })).toBeNull();
    });
  });
});
