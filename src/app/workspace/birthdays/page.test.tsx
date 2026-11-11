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
) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/birthdays?')) return Response.json({ data: { ...dashboard, campaigns } });
    if (url.startsWith('/api/birthdays/campaigns?')) {
      return Response.json({ data: { templates } });
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
});
