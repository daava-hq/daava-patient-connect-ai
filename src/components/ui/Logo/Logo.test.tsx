import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Logo from './Logo';

describe('Logo', () => {
  it('renders Patient Connect wordmark', () => {
    render(<Logo />);
    expect(screen.getByText('Patient Connect')).toBeDefined();
    expect(screen.getByText('PC')).toBeDefined();
  });
});
