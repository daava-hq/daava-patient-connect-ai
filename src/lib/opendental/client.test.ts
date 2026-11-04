import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchOpenDental,
  encrypt,
  decrypt,
  OpenDentalAuthError,
  OpenDentalRateLimitError,
  confirmOpenDentalAppointment,
  getOpenDentalAppointment,
} from './index';

describe('Open Dental Crypto', () => {
  it('encrypts and decrypts correctly', () => {
    const original = 'my-secret-customer-key';
    const encrypted = encrypt(original);
    expect(encrypted).not.toEqual(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toEqual(original);
  });
});

describe('Open Dental HTTP Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully fetches data on 200 OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ PatNum: 1, LName: 'Smith', FName: 'John' }]),
      })
    );

    const result = await fetchOpenDental<Array<{ PatNum: number }>>('dev-key', 'cust-key', 'patients');
    expect(result).toEqual([{ PatNum: 1, LName: 'Smith', FName: 'John' }]);
  });

  it('throws OpenDentalAuthError on 401 Unauthorized', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })
    );

    await expect(fetchOpenDental('dev-key', 'cust-key', 'patients')).rejects.toThrow(OpenDentalAuthError);
  });

  it('confirms an appointment through the dedicated Open Dental endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      confirmOpenDentalAppointment('dev-key', 'cust-key', 12345)
    ).resolves.toBeUndefined();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.opendental.com/api/v1/appointments/12345/Confirm');
    expect(options).toMatchObject({
      method: 'PUT',
      headers: {
        Authorization: 'ODFHIR dev-key/cust-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirmVal: 'Confirmed' }),
    });
  });

  it('fetches a single appointment for confirmation eligibility revalidation', async () => {
    const appointment = {
      AptNum: 12345,
      PatNum: 67890,
      AptDateTime: '2026-11-15 09:00:00',
      AptStatus: 'Scheduled',
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(appointment), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getOpenDentalAppointment('dev-key', 'cust-key', 12345)
    ).resolves.toEqual(appointment);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.opendental.com/api/v1/appointments/12345'
    );
  });
});
