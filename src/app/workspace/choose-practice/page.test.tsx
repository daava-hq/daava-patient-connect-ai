import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
}));

import ChoosePracticePage from './page';

const practice = {
  id: 'fbe39259-13b5-48ef-9ec8-1215a625865d',
  name: 'Riverside Dental',
  slug: 'riverside-dental',
  address: '100 Main Street',
  phone: '555-0100',
  organisationName: 'Riverside Group',
  role: 'owner',
};

describe('ChoosePracticePage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('renders authorized practices and selects one on click', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: [practice] })));
    const practiceChanged = vi.fn();
    window.addEventListener('practiceChanged', practiceChanged);

    render(<ChoosePracticePage />);

    expect(await screen.findByText('Riverside Dental')).toBeTruthy();
    expect(screen.getByText('Organisation: Riverside Group')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Riverside Dental/ }));

    expect(localStorage.getItem('selectedClinicId')).toBe(practice.id);
    expect(practiceChanged).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith('/workspace/dashboard');
    window.removeEventListener('practiceChanged', practiceChanged);
  });

  it('selects a practice with the keyboard and prevents Space from scrolling', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: [practice] })));

    render(<ChoosePracticePage />);

    const card = await screen.findByRole('button', { name: /Riverside Dental/ });
    expect(fireEvent.keyDown(card, { key: ' ' })).toBe(false);
    expect(localStorage.getItem('selectedClinicId')).toBe(practice.id);
    expect(mocks.router.push).toHaveBeenCalledWith('/workspace/dashboard');
  });

  it('shows an error and retries the practice request', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: 'Practice access unavailable' }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ data: [practice] }));
    vi.stubGlobal('fetch', fetchMock);

    render(<ChoosePracticePage />);

    const error = await screen.findByRole('alert');
    expect(within(error).getByText('Practice access unavailable')).toBeTruthy();
    fireEvent.click(within(error).getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('Riverside Dental')).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('shows an empty state when the account has no assigned practices', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: [] })));

    render(<ChoosePracticePage />);

    expect(await screen.findByRole('heading', { name: 'No practice locations assigned' })).toBeTruthy();
  });

  it('redirects expired sessions to sign in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 401 })));

    render(<ChoosePracticePage />);

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/login'));
  });
});
