import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReferralsPage from './page';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
const referral = {
  id: 'referral-1',
  patientId: 'patient-1',
  patientName: 'Jordan Example',
  referredTo: 'Apex Oral Surgery',
  referrerName: 'Dr. Morgan',
  status: 'Pending',
  createdAt: '2026-03-15T12:00:00.000Z',
};

describe('ReferralsPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('renders referral data from the practice-scoped API response', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [referral] }));
    vi.stubGlobal('fetch', fetchMock);

    render(<ReferralsPage />);

    expect(await screen.findByText('Jordan Example')).toBeTruthy();
    expect(screen.getByText('Apex Oral Surgery')).toBeTruthy();
    expect(screen.getByText('Dr. Morgan')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Patient Name' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/referrals?practiceId=${practiceId}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('shows a load error and retries fetching referrals', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: 'Practice access denied' }, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ data: [referral] }));
    vi.stubGlobal('fetch', fetchMock);

    render(<ReferralsPage />);

    const error = await screen.findByRole('alert');
    expect(error.textContent).toContain('Practice access denied');
    fireEvent.click(within(error).getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('Jordan Example')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks the user to select a practice instead of fetching unscoped referrals', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<ReferralsPage />);

    expect(await screen.findByRole('heading', { name: 'Select a practice' })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hides the previous practice referrals while loading the newly selected practice', async () => {
    const nextPracticeId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
    const nextPracticeReferral = { ...referral, id: 'referral-2', patientName: 'New Practice Patient' };
    localStorage.setItem('selectedClinicId', practiceId);
    let resolveNextPractice: ((response: Response) => void) | undefined;
    const nextPracticeResponse = new Promise<Response>((resolve) => {
      resolveNextPractice = resolve;
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: [referral] }))
      .mockReturnValueOnce(nextPracticeResponse);
    vi.stubGlobal('fetch', fetchMock);

    render(<ReferralsPage />);

    expect(await screen.findByText('Jordan Example')).toBeTruthy();
    localStorage.setItem('selectedClinicId', nextPracticeId);
    act(() => window.dispatchEvent(new Event('practiceChanged')));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Jordan Example')).toBeNull();
    expect(screen.getByText('Loading referrals...')).toBeTruthy();

    await act(async () => {
      resolveNextPractice?.(Response.json({ data: [nextPracticeReferral] }));
    });
    expect(await screen.findByText('New Practice Patient')).toBeTruthy();
  });

  it('shows the empty state when the selected practice has no referral records', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: [] })));

    render(<ReferralsPage />);

    expect(await screen.findByRole('heading', { name: 'No referral records yet' })).toBeTruthy();
  });
});
