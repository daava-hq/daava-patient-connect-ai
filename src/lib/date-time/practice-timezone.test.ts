import { describe, expect, it } from 'vitest';
import { fromPracticeInstant, toPracticeInstant } from './practice-timezone';

describe('practice timezone date-time conversion', () => {
  it('converts practice-local date-times to UTC instants', () => {
    expect(toPracticeInstant('2026-11-12T09:00', 'Asia/Kolkata')).toBe('2026-11-12T03:30:00.000Z');
  });

  it('formats UTC instants for datetime-local fields in the practice timezone', () => {
    expect(fromPracticeInstant('2026-11-12T03:30:00.000Z', 'Asia/Kolkata')).toBe('2026-11-12T09:00');
  });
});
