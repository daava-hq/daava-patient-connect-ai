import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConnectPage from './page';

describe('ConnectPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the messaging setup state instead of implying a live inbox is available', () => {
    render(<ConnectPage />);

    expect(screen.getByRole('heading', { name: 'Connect Two-Way Messaging' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Two-Way SMS Inbox' })).toBeTruthy();
    expect(screen.getByText(/messaging provider and incoming webhook are configured/)).toBeTruthy();
    expect(screen.getByText(/Patient conversations and direct messages will appear here/)).toBeTruthy();
  });
});
