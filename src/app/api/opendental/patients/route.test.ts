import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  getPracticePatients: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({
  requirePracticeMembership: mocks.requirePracticeMembership,
}));
vi.mock('@/lib/patients/patient-repository', () => ({
  getPracticePatients: mocks.getPracticePatients,
}));

import { GET } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';

describe('Patients route', () => {
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
    expect(mocks.getPracticePatients).not.toHaveBeenCalled();
  });

  it('returns practice patients and consent flags from the database', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({});
    mocks.getPracticePatients.mockResolvedValue({
      patients: [{
        opendentalPatientId: 101,
        firstName: 'Alex',
        lastName: 'Taylor',
        dateOfBirth: '1985-04-12',
        phoneHome: '555-0102',
        phoneMobile: '555-0101',
        email: 'alex@example.com',
        status: 'Patient',
        smsConsent: false,
        emailConsent: true,
      }],
      total: 1,
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/opendental/patients?practiceId=${practiceId}&limit=20`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      total: 1,
      data: [{
        PatNum: 101,
        FName: 'Alex',
        LName: 'Taylor',
        Birthdate: '1985-04-12',
        HmPhone: '555-0102',
        WirelessPhone: '555-0101',
        Email: 'alex@example.com',
        PatStatus: 'Patient',
        emailConsent: true,
        smsConsent: false,
      }],
    });
    expect(mocks.getPracticePatients).toHaveBeenCalledWith(practiceId, { limit: 20, offset: 0 });
    expect(mocks.requirePracticeMembership).toHaveBeenCalledWith('user-id', practiceId);
  });

  it('returns sample patients from the database', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({});
    mocks.getPracticePatients.mockResolvedValue({
      patients: [
        {
          opendentalPatientId: 8901,
          firstName: 'William',
          lastName: 'Clark',
          dateOfBirth: '1985-06-15',
          phoneHome: null,
          phoneMobile: null,
          email: 'prem@daava.ai',
          status: 'Patient',
          smsConsent: false,
          emailConsent: true,
        },
      ],
      total: 1,
    });
    const response = await GET(
      new NextRequest(`http://localhost/api/opendental/patients?practiceId=${practiceId}&limit=20`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      total: 1,
      data: [{
        PatNum: 8901,
        FName: 'William',
        LName: 'Clark',
        Email: 'prem@daava.ai',
        emailConsent: true,
      }],
    });
    expect(mocks.getPracticePatients).toHaveBeenCalledWith(practiceId, { limit: 20, offset: 0 });
  });
});
