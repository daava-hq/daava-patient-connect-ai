import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
}));

vi.mock('@/components/feedback/ToastProvider/ToastProvider', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

import ProfilePage from './page';

const user = {
  id: 'user-1',
  name: 'Jordan Example',
  email: 'jordan@example.com',
  role: 'member',
  createdAt: '2026-03-15T12:00:00.000Z',
  updatedAt: '2026-03-15T12:00:00.000Z',
};

const practice = {
  practiceId: 'practice-1',
  practiceName: 'Riverside Dental',
  practiceSlug: 'riverside-dental',
  organisationName: 'Riverside Group',
  role: 'owner',
  joinedAt: '2026-03-15T12:00:00.000Z',
};

describe('ProfilePage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders account and assigned practice details from the profile response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      Response.json({ data: { user, practices: [practice] } }),
    ));

    render(<ProfilePage />);

    expect(await screen.findByText('Jordan Example')).toBeTruthy();
    expect(screen.getByText('jordan@example.com')).toBeTruthy();
    expect(screen.getByText('Assigned Practices (1)')).toBeTruthy();
    expect(screen.getByText('Riverside Dental')).toBeTruthy();
    expect(screen.getByText('Organisation: Riverside Group')).toBeTruthy();
  });

  it('shows a shared error state when the profile cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      Response.json({ error: 'Unauthorized' }, { status: 401 }),
    ));

    render(<ProfilePage />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Profile unavailable' })).toBeTruthy();
    expect(screen.getByText('Profile details could not be found.')).toBeTruthy();
  });
});
