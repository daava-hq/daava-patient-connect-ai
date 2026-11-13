import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  showToast: vi.fn(),
  templateId: 'practice-template',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
  useParams: () => ({ templateId: mocks.templateId }),
}));

vi.mock('@/components/feedback/ToastProvider/ToastProvider', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

import EditTemplateEditorPage from './page';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
const category = { id: 'category-newsletters', slug: 'newsletters', name: 'Newsletters' };
const template = {
  id: mocks.templateId,
  categoryId: category.id,
  name: 'Welcome email',
  description: 'Existing practice template',
  channel: 'email',
  templateType: 'email',
  content: {
    version: 1,
    subject: 'Welcome to our practice',
    sections: [
      {
        id: 'section-1',
        blocks: [{ id: 'block-1', type: 'heading', properties: { text: 'Welcome' } }],
      },
    ],
  },
};

describe('EditTemplateEditorPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('loads the selected practice template and saves changes through the update API', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: template }))
      .mockResolvedValueOnce(Response.json({ data: { categories: [category], templates: [template] } }))
      .mockResolvedValueOnce(Response.json({ data: { ...template, name: 'Updated welcome' } }));
    vi.stubGlobal('fetch', fetchMock);

    render(<EditTemplateEditorPage />);

    const nameInput = await screen.findByRole('textbox', { name: 'Template name' });
    fireEvent.change(nameInput, { target: { value: 'Updated welcome' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith('/workspace/templates'));
    const request = fetchMock.mock.calls[2][1] as RequestInit;
    const payload = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/templates/${template.id}`,
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(payload).toMatchObject({
      practiceId,
      categoryId: category.id,
      name: 'Updated welcome',
      status: 'published',
    });
    expect(payload).toHaveProperty('content.subject', 'Welcome to our practice');
  });
});
