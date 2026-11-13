import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SurveysPage from './page';

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock('@/components/feedback/ToastProvider/ToastProvider', () => ({
  useToast: () => ({ showToast }),
}));

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
const survey = {
  id: 'survey-1',
  title: 'Post-Visit Satisfaction',
  description: 'Tell us about your visit.',
  createdAt: '2026-03-15T12:00:00.000Z',
};

describe('SurveysPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('renders survey records from the practice-scoped API response', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [survey] }));
    vi.stubGlobal('fetch', fetchMock);

    render(<SurveysPage />);

    expect(await screen.findByText('Post-Visit Satisfaction')).toBeTruthy();
    expect(screen.getByText('Tell us about your visit.')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Survey Title' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/surveys?practiceId=${practiceId}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('shows a load error and retries fetching surveys', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: 'Practice access denied' }, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ data: [survey] }));
    vi.stubGlobal('fetch', fetchMock);

    render(<SurveysPage />);

    const error = await screen.findByRole('alert');
    expect(error.textContent).toContain('Practice access denied');
    fireEvent.click(within(error).getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('Post-Visit Satisfaction')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks the user to select a practice instead of fetching unscoped surveys', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<SurveysPage />);

    expect(await screen.findByRole('heading', { name: 'Select a practice' })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'New Survey' }).hasAttribute('disabled')).toBe(true);
  });

  it('hides the previous practice surveys while loading the newly selected practice', async () => {
    const nextPracticeId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
    const nextPracticeSurvey = { ...survey, id: 'survey-2', title: 'New Practice Survey' };
    localStorage.setItem('selectedClinicId', practiceId);
    let resolveNextPractice: ((response: Response) => void) | undefined;
    const nextPracticeResponse = new Promise<Response>((resolve) => {
      resolveNextPractice = resolve;
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: [survey] }))
      .mockReturnValueOnce(nextPracticeResponse);
    vi.stubGlobal('fetch', fetchMock);

    render(<SurveysPage />);

    expect(await screen.findByText('Post-Visit Satisfaction')).toBeTruthy();
    localStorage.setItem('selectedClinicId', nextPracticeId);
    act(() => window.dispatchEvent(new Event('practiceChanged')));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Post-Visit Satisfaction')).toBeNull();
    expect(screen.getByText('Loading surveys...')).toBeTruthy();

    await act(async () => {
      resolveNextPractice?.(Response.json({ data: [nextPracticeSurvey] }));
    });
    expect(await screen.findByText('New Practice Survey')).toBeTruthy();
  });

  it('creates a survey with the existing title and description payload and refreshes the list', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const createdSurvey = { ...survey, id: 'survey-2', title: 'New Patient Survey' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: [] }))
      .mockResolvedValueOnce(Response.json({ data: { id: 'survey-2' } }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ data: [createdSurvey] }));
    vi.stubGlobal('fetch', fetchMock);

    render(<SurveysPage />);

    await screen.findByRole('heading', { name: 'No surveys created yet' });
    fireEvent.click(screen.getByRole('button', { name: 'New Survey' }));
    const dialog = screen.getByRole('dialog', { name: 'Create Patient Survey' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Survey Title' }), {
      target: { value: 'New Patient Survey' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Description' }), {
      target: { value: 'A new survey description.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Survey' }));

    expect(await screen.findByText('New Patient Survey')).toBeTruthy();
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/surveys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practiceId,
        title: 'New Patient Survey',
        description: 'A new survey description.',
      }),
    });
    expect(showToast).toHaveBeenCalledWith('Survey created successfully', 'success');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the form open and reports a create failure', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ data: [] }))
      .mockResolvedValueOnce(Response.json({ error: 'Survey creation is not permitted' }, { status: 403 })));

    render(<SurveysPage />);

    await screen.findByRole('heading', { name: 'No surveys created yet' });
    fireEvent.click(screen.getByRole('button', { name: 'New Survey' }));
    const dialog = screen.getByRole('dialog', { name: 'Create Patient Survey' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Survey Title' }), {
      target: { value: 'New Patient Survey' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Survey' }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Survey creation is not permitted', 'error');
    });
    expect(screen.getByRole('dialog', { name: 'Create Patient Survey' })).toBeTruthy();
  });

  it('traps keyboard focus and closes the create dialog with Escape', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: [] })));

    render(<SurveysPage />);

    await screen.findByRole('heading', { name: 'No surveys created yet' });
    const trigger = screen.getByRole('button', { name: 'New Survey' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Create Patient Survey' });
    expect(document.activeElement).toBe(within(dialog).getByRole('textbox', { name: 'Survey Title' }));

    const submitButton = within(dialog).getByRole('button', { name: 'Create Survey' });
    submitButton.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close create survey dialog' }));

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});
