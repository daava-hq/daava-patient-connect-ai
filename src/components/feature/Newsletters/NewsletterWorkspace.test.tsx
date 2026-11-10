import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    expect(screen.getAllByText('Newsletters').some((element) => element.closest('article')?.querySelector('svg'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    const report = await screen.findByRole('dialog', { name: 'Spring newsletter' });
    expect(report.textContent).toContain('Status: cancelled');
    expect(report.textContent).toContain('Recipient activity');
    expect(report.textContent).toContain('recipient-1');
    expect(report.textContent).toContain('Skipped');
    expect(report.querySelectorAll('svg').length).toBeGreaterThanOrEqual(8);

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
});
