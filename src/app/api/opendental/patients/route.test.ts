import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  getOpenDentalPatients: vi.fn(),
  decrypt: vi.fn(),
  upsertPatient: vi.fn(),
  select: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({
  requirePracticeMembership: mocks.requirePracticeMembership,
}));
vi.mock('@/lib/opendental/patients', () => ({
  getOpenDentalPatients: mocks.getOpenDentalPatients,
}));
vi.mock('@/lib/opendental/crypto', () => ({ decrypt: mocks.decrypt }));
vi.mock('@/lib/patients/patient-repository', () => ({
  upsertPatient: mocks.upsertPatient,
}));
vi.mock('@/db', () => ({ db: { select: mocks.select } }));

import { GET } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';

describe('Open Dental patients route', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires an authenticated user', async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await GET(
      new NextRequest(`http://localhost/api/opendental/patients?practiceId=${practiceId}`)
    );

    expect(response.status).toBe(401);
    expect(mocks.requirePracticeMembership).not.toHaveBeenCalled();
  });

  it('denies access when the user is not a member of the requested practice', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockRejectedValue(
      new AppError(403, 'Practice membership required', 'FORBIDDEN')
    );

    const response = await GET(
      new NextRequest(`http://localhost/api/opendental/patients?practiceId=${practiceId}`)
    );

    expect(response.status).toBe(403);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it('includes the persisted consent flags in each patient result', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({});
    mocks.decrypt.mockReturnValue('decrypted-key');
    mocks.getOpenDentalPatients.mockResolvedValue([
      {
        PatNum: 101,
        FName: 'Alex',
        LName: 'Taylor',
        Email: 'alex@example.com',
        WirelessPhone: '555-0101',
      },
    ]);
    mocks.upsertPatient.mockResolvedValue({ smsConsent: false, emailConsent: true });

    const credentialsQuery = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([
        { developerKeyEnc: 'encrypted-developer-key', customerKeyEnc: 'encrypted-customer-key' },
      ]),
    };
    credentialsQuery.from.mockReturnValue(credentialsQuery);
    credentialsQuery.where.mockReturnValue(credentialsQuery);

    const countQuery = {
      from: vi.fn(),
      where: vi.fn().mockResolvedValue([{ count: 1 }]),
    };
    countQuery.from.mockReturnValue(countQuery);
    mocks.select.mockReturnValueOnce(credentialsQuery).mockReturnValueOnce(countQuery);

    const response = await GET(
      new NextRequest(`http://localhost/api/opendental/patients?practiceId=${practiceId}&limit=20`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0]).toMatchObject({ emailConsent: true, smsConsent: false });
    expect(mocks.requirePracticeMembership).toHaveBeenCalledWith('user-id', practiceId);
  });
});
