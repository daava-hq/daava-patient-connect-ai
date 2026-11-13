import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  showToast: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
}));

vi.mock('@/components/feedback/ToastProvider/ToastProvider', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

import TemplatesLibraryPage from './page';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
const categories = [
  { id: 'category-birthdays', slug: 'birthdays', name: 'Birthdays' },
  { id: 'category-recall', slug: 'recall', name: 'Recall' },
];
const templates = [
  {
    id: 'system-birthday',
    categoryId: 'category-birthdays',
    name: 'Birthday Greeting',
    description: 'A birthday email',
    channel: 'email',
    isSystem: true,
    content: { subject: 'Happy birthday', body: 'Hello {{patient.firstName}}!' },
  },
  {
    id: 'practice-recall',
    categoryId: 'category-recall',
    name: 'Recall Reminder',
    description: 'A practice SMS',
    channel: 'sms',
    isSystem: false,
    content: { body: 'Your visit is due, {{patient.firstName}}.' },
  },
];

function templatesResponse() {
  return Response.json({ data: { categories, templates } });
}

describe('TemplatesLibraryPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('loads templates, filters by search, and opens an accessible preview', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(templatesResponse()));

    render(<TemplatesLibraryPage />);

    expect(await screen.findByRole('heading', { name: 'Birthday Greeting' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Recall Reminder' })).toBeTruthy();
    expect(screen.getByText('System Template')).toBeTruthy();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search templates' }), {
      target: { value: 'recall' },
    });
    expect(screen.getByRole('heading', { name: 'Recall Reminder' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Birthday Greeting' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Preview Recall Reminder' }));
    expect(await screen.findByRole('dialog', { name: /SMS Preview: Recall Reminder/ })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('clones system templates using the selected practice and opens the clone editor', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(templatesResponse())
      .mockResolvedValueOnce(Response.json({ data: { id: 'cloned-template' } }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<TemplatesLibraryPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Clone' }));

    await waitFor(() => {
      expect(mocks.router.push).toHaveBeenCalledWith('/workspace/templates/cloned-template/edit');
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/templates/system-birthday/clone',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ practiceId }),
      }),
    );
  });

  it('shows a load error and retries the template request', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: 'Practice access denied' }, { status: 403 }))
      .mockResolvedValueOnce(templatesResponse());
    vi.stubGlobal('fetch', fetchMock);

    render(<TemplatesLibraryPage />);

    expect((await screen.findByRole('alert')).textContent).toContain('Practice access denied');
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('heading', { name: 'Birthday Greeting' })).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
