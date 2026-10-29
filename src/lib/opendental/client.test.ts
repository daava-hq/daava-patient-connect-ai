import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchOpenDental, encrypt, decrypt, OpenDentalAuthError, OpenDentalRateLimitError } from './index';

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
});
