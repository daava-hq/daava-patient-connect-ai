import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getOpenDentalRecalls, parseOpenDentalRecall } from './recalls';

describe('Open Dental recalls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches recall records through the read-only recalls endpoint', async () => {
    const records = [{ RecallNum: 12 }];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(records), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getOpenDentalRecalls('dev-key', 'customer-key')).resolves.toEqual(records);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.opendental.com/api/v1/recalls');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });

  it('normalizes Open Dental sentinel dates and boolean strings', () => {
    expect(parseOpenDentalRecall({
      RecallNum: 12,
      PatNum: 34,
      RecallTypeNum: 2,
      DateDue: '0001-01-01',
      DateScheduled: '2026-03-05',
      IsDisabled: 'false',
    })).toEqual({
      recallNum: 12,
      patientNum: 34,
      recallTypeNum: 2,
      dueDate: null,
      dateScheduled: '2026-03-05',
      isDisabled: false,
    });
  });

  it('rejects invalid recall dates and incomplete records', () => {
    expect(() => parseOpenDentalRecall({
      RecallNum: 12,
      PatNum: 34,
      RecallTypeNum: 2,
      DateDue: '2026-02-30',
      IsDisabled: 'false',
    })).toThrow('Open Dental recall date is invalid');

    expect(() => parseOpenDentalRecall({ RecallNum: 12 })).toThrow();
  });
});
