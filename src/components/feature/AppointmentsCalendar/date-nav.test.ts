import { describe, it, expect } from 'vitest';

function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

describe('Date navigation helper logic', () => {
  it('shifts date correctly without timezone shift issues', () => {
    const start = '2026-10-27';
    const dPrev = parseDateLocal(start);
    dPrev.setDate(dPrev.getDate() - 1);
    expect(formatDateLocal(dPrev)).toBe('2026-10-26');

    const dNext = parseDateLocal(start);
    dNext.setDate(dNext.getDate() + 1);
    expect(formatDateLocal(dNext)).toBe('2026-10-28');
  });
});
