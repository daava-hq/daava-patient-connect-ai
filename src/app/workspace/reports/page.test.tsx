import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReportsPage from './page';

describe('ReportsPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('states that centralized reports and exports are not yet available', () => {
    render(<ReportsPage />);

    expect(screen.getByRole('heading', { name: 'Engagement & Operations Reports' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Cross-Module Reports' })).toBeTruthy();
    expect(screen.getByText('Centralized reporting and CSV exports are not yet available.')).toBeTruthy();
    expect(screen.getByText(/once report data sources are connected/)).toBeTruthy();
  });
});
