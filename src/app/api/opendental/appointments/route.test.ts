import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOpenDentalAppointments: vi.fn(),
  getOpenDentalPatients: vi.fn(),
  getOpenDentalProviders: vi.fn(),
  getOpenDentalOperatories: vi.fn(),
  buildCalendarColumns: vi.fn(),
  fetchOpenDental: vi.fn(),
  decrypt: vi.fn(),
  select: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/opendental/appointments', () => ({
  getOpenDentalAppointments: mocks.getOpenDentalAppointments,
}));
vi.mock('@/lib/opendental/patients', () => ({
  getOpenDentalPatients: mocks.getOpenDentalPatients,
}));
vi.mock('@/lib/opendental/providers', () => ({
  getOpenDentalProviders: mocks.getOpenDentalProviders,
  getOpenDentalOperatories: mocks.getOpenDentalOperatories,
  buildCalendarColumns: mocks.buildCalendarColumns,
}));
vi.mock('@/lib/opendental/client', () => ({
  fetchOpenDental: mocks.fetchOpenDental,
}));
vi.mock('@/lib/opendental/crypto', () => ({ decrypt: mocks.decrypt }));
vi.mock('@/db', () => ({ db: { select: mocks.select } }));
vi.mock('@/db/schema/practices', () => ({ practices: { id: 'practice-id' } }));
vi.mock('@/db/schema/practice_credentials', () => ({
  practiceOpendentalCredentials: { practiceId: 'practice-id' },
}));
vi.mock('@/db/schema/patients', () => ({
  patients: {
    practiceId: 'patient-practice-id',
    opendentalPatientId: 'opendental-patient-id',
    smsConsent: 'sms-consent',
    emailConsent: 'email-consent',
  },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
}));

import { GET } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';

describe('Open Dental appointments route', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the locally stored consent flags with matching appointment patient details', async () => {
    const credentialsQuery = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([
        { developerKeyEnc: 'encrypted-developer-key', customerKeyEnc: 'encrypted-customer-key' },
      ]),
    };
    credentialsQuery.from.mockReturnValue(credentialsQuery);
    credentialsQuery.where.mockReturnValue(credentialsQuery);

    const consentQuery = {
      from: vi.fn(),
      where: vi.fn().mockResolvedValue([
        { opendentalPatientId: 84, emailConsent: true, smsConsent: false },
      ]),
    };
    consentQuery.from.mockReturnValue(consentQuery);
    mocks.select.mockReturnValueOnce(credentialsQuery).mockReturnValueOnce(consentQuery);

    mocks.decrypt.mockReturnValue('decrypted-key');
    mocks.getOpenDentalAppointments.mockResolvedValue([
      { AptNum: 135, PatNum: 84, AptDateTime: '2026-10-21 10:30:00' },
    ]);
    mocks.getOpenDentalProviders.mockResolvedValue([]);
    mocks.getOpenDentalOperatories.mockResolvedValue([]);
    mocks.getOpenDentalPatients.mockResolvedValue([
      {
        PatNum: 84,
        LName: 'Morgan',
        FName: 'Alex',
        Email: 'alex.morgan@example.com',
        WirelessPhone: '555-0101',
      },
    ]);
    mocks.buildCalendarColumns.mockReturnValue([]);
    mocks.fetchOpenDental.mockResolvedValue([]);

    const response = await GET(
      new NextRequest(`http://localhost/api/opendental/appointments?practiceId=${practiceId}`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].patientDetails).toMatchObject({
      Email: 'alex.morgan@example.com',
      WirelessPhone: '555-0101',
      emailConsent: true,
      smsConsent: false,
    });
    expect(consentQuery.where).toHaveBeenCalled();
  });
});
