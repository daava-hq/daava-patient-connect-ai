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

import NewTemplateEditorPage from './page';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
const category = { id: 'category-newsletters', slug: 'newsletters', name: 'Newsletters' };

describe('NewTemplateEditorPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('creates a template with the selected practice and category', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: { categories: [category], templates: [] } }))
      .mockResolvedValueOnce(Response.json({ data: { id: 'new-template' } }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<NewTemplateEditorPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'heading' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save & Publish' }));

    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith('/workspace/templates'));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/templates',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining(`"practiceId":"${practiceId}"`),
      }),
    );
    const request = fetchMock.mock.calls[1][1] as RequestInit;
    const payload = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(payload).toMatchObject({
      practiceId,
      categoryId: category.id,
      channel: 'email',
      status: 'published',
    });
  });
});
