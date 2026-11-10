import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pathname: '/',
  router: { replace: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => mocks.router,
}));

import PracticeRouteGate from './PracticeRouteGate';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';

describe('PracticeRouteGate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    mocks.router.replace.mockReset();
    mocks.pathname = '/';
  });

  it('routes an authenticated entry to the dashboard when the selected practice is available', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      Response.json({ data: [{ id: practiceId }] }),
    ));

    render(<PracticeRouteGate mode="entry" />);

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/workspace/dashboard'));
  });

  it('routes an authenticated entry without a selected practice to practice selection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      Response.json({ data: [{ id: practiceId }] }),
    ));

    render(<PracticeRouteGate mode="entry" />);

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/workspace/choose-practice'));
  });

  it('clears and rejects a selected practice the user can no longer access', async () => {
    localStorage.setItem('selectedClinicId', 'revoked-practice-id');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      Response.json({ data: [{ id: practiceId }] }),
    ));

    render(<PracticeRouteGate mode="workspace"><p>Private workspace</p></PracticeRouteGate>);

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/workspace/choose-practice'));
    expect(localStorage.getItem('selectedClinicId')).toBeNull();
    expect(screen.queryByText('Private workspace')).toBeNull();
  });

  it('renders the workspace after confirming the selected practice is available', async () => {
    mocks.pathname = '/workspace/dashboard';
    localStorage.setItem('selectedClinicId', practiceId);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      Response.json({ data: [{ id: practiceId }] }),
    ));

    render(<PracticeRouteGate mode="workspace"><p>Private workspace</p></PracticeRouteGate>);

    expect(await screen.findByText('Private workspace')).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it('routes unauthenticated workspace requests to login', async () => {
    mocks.pathname = '/workspace/dashboard';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      Response.json({ error: 'Unauthorized' }, { status: 401 }),
    ));

    render(<PracticeRouteGate mode="workspace"><p>Private workspace</p></PracticeRouteGate>);

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('Private workspace')).toBeNull();
  });

  it('shows a retry action when practice authorization cannot be checked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      Response.json({ error: 'Service unavailable' }, { status: 503 }),
    ));

    render(<PracticeRouteGate mode="entry" />);

    expect((await screen.findByRole('alert')).textContent).toContain('Service unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});
