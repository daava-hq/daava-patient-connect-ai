import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PaymentsPage from './page';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
const balance = {
  id: 'balance-1',
  patientName: 'Jordan Example',
  email: 'jordan@example.test',
  phoneMobile: null,
  balance: '125.50',
};

describe('PaymentsPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('displays typed balance data without claiming an unavailable payment link was sent', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [balance] }));
    vi.stubGlobal('fetch', fetchMock);

    render(<PaymentsPage />);

    expect(await screen.findByText('Jordan Example')).toBeTruthy();
    expect(screen.getByText('$125.50')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Patient Name' })).toBeTruthy();
    expect(screen.getByText(/Payment link delivery is not configured/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send payment link to Jordan Example' }).hasAttribute('disabled')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/payments/balances?practiceId=${practiceId}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('shows a load error and retries the request', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: 'Practice access denied' }, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ data: [balance] }));
    vi.stubGlobal('fetch', fetchMock);

    render(<PaymentsPage />);

    const error = await screen.findByRole('alert');
    expect(error.textContent).toContain('Practice access denied');
    fireEvent.click(within(error).getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('Jordan Example')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks the user to select a practice instead of implying there are no balances', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<PaymentsPage />);

    expect(await screen.findByRole('heading', { name: 'Select a practice' })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hides the previous practice balances while loading the newly selected practice', async () => {
    const nextPracticeId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
    const nextPracticeBalance = { ...balance, id: 'balance-2', patientName: 'New Practice Patient' };
    localStorage.setItem('selectedClinicId', practiceId);
    let resolveNextPractice: ((response: Response) => void) | undefined;
    const nextPracticeResponse = new Promise<Response>((resolve) => {
      resolveNextPractice = resolve;
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: [balance] }))
      .mockReturnValueOnce(nextPracticeResponse);
    vi.stubGlobal('fetch', fetchMock);

    render(<PaymentsPage />);

    expect(await screen.findByText('Jordan Example')).toBeTruthy();
    localStorage.setItem('selectedClinicId', nextPracticeId);
    act(() => window.dispatchEvent(new Event('practiceChanged')));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Jordan Example')).toBeNull();
    expect(screen.getByText('Loading outstanding balances...')).toBeTruthy();

    await act(async () => {
      resolveNextPractice?.(Response.json({ data: [nextPracticeBalance] }));
    });
    expect(await screen.findByText('New Practice Patient')).toBeTruthy();
  });
});
