import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EmailMessagePreview from './EmailMessagePreview';

describe('EmailMessagePreview', () => {
  it('renders email HTML in a sandboxed frame', () => {
    const html = '<div><h1>Appointment reminder</h1><a href="https://example.test">Confirm</a></div>';
    render(<EmailMessagePreview html={html} />);

    const frame = screen.getByTitle('Rendered email message preview');
    expect(frame.getAttribute('srcdoc')).toBe(html);
    expect(frame.getAttribute('sandbox')).toBe('');
  });
});
