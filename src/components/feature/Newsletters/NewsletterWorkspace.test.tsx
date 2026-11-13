import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback/ToastProvider/ToastProvider';
import NewsletterWorkspace from './NewsletterWorkspace';

const campaignId = '39d598db-a09b-484a-9c31-b1909f3ab7b4';
const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';

describe('NewsletterWorkspace', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('shows the selected newsletter report and allows deleting a cancelled newsletter', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    let deleted = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/newsletters?')) {
        return Response.json({
          data: {
            campaigns: deleted ? [] : [{
              id: campaignId,
              name: 'Spring newsletter',
              status: 'cancelled',
              scheduledAt: null,
              createdAt: '2026-03-01T10:00:00.000Z',
              totalRecipients: 2,
              sentCount: 0,
              deliveredCount: 0,
              bouncedCount: 0,
              failedCount: 0,
            }],
            total: deleted ? 0 : 1,
            stats: { campaigns: deleted ? {} : { cancelled: 1 }, recipients: {}, events: {} },
          },
        });
      }
      if (url.startsWith('/api/templates?')) return Response.json({ data: { categories: [], templates: [] } });
      if (url.startsWith('/api/groups?')) return Response.json({ data: { groups: [] } });
      if (url === `/api/practices/${practiceId}`) {
        return Response.json({ data: { timezone: 'America/New_York' } });
      }
      if (url === `/api/newsletters/${campaignId}?practiceId=${practiceId}` && init?.method !== 'DELETE') {
        return Response.json({
          data: {
            campaign: { name: 'Spring newsletter', status: 'cancelled', scheduledAt: null },
            stats: { total: 2, sent: 0, delivered: 0, bounced: 0, failed: 0, skipped: 2, opened: 0, clicked: 1 },
          },
        });
      }
      if (url.startsWith(`/api/campaigns/${campaignId}/recipients?`)) {
        return Response.json({
          data: [{ recipientId: 'recipient-1', status: 'skipped', updatedAt: '2026-03-01T10:00:00.000Z' }],
        });
      }
      if (url === `/api/newsletters/${campaignId}?practiceId=${practiceId}` && init?.method === 'DELETE') {
        deleted = true;
        return Response.json({ success: true });
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ToastProvider>
        <NewsletterWorkspace />
      </ToastProvider>,
    );

    await screen.findByText('Spring newsletter');
    const dashboardMetrics = screen.getByRole('region', { name: 'Newsletter statistics' });
    expect(within(dashboardMetrics).getByText('Newsletters')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    const report = await screen.findByRole('dialog', { name: 'Spring newsletter' });
    expect(report.textContent).toContain('Status: cancelled');
    expect(report.textContent).toContain('Recipient activity');
    expect(report.textContent).toContain('recipient-1');
    const reportMetrics = within(report).getByRole('group', { name: 'Newsletter report metrics' });
    expect(within(reportMetrics).getByText('Recipients')).toBeTruthy();
    expect(within(reportMetrics).getByText('Skipped')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Spring newsletter' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/newsletters/${campaignId}?practiceId=${practiceId}`,
        { method: 'DELETE' },
      );
    });
    await screen.findByText('No newsletters yet');
  });

  it('shows the practice timezone beside the newsletter schedule field', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/newsletters?')) {
        return Response.json({
          data: { campaigns: [], total: 0, stats: { campaigns: {}, recipients: {}, events: {} } },
        });
      }
      if (url.startsWith('/api/templates?')) return Response.json({ data: { categories: [], templates: [] } });
      if (url.startsWith('/api/groups?')) return Response.json({ data: { groups: [] } });
      if (url === `/api/practices/${practiceId}`) {
        return Response.json({ data: { timezone: 'America/Los_Angeles' } });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ToastProvider>
        <NewsletterWorkspace />
      </ToastProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'New newsletter' }));

    expect(await screen.findByLabelText('Schedule date and time (America/Los_Angeles)')).toBeTruthy();
  });
});
