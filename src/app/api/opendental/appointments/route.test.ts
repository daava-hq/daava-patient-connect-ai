import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePracticeMembership: vi.fn(),
  getOpenDentalAppointments: vi.fn(),
  getOpenDentalPatients: vi.fn(),
  getOpenDentalProviders: vi.fn(),
  getOpenDentalOperatories: vi.fn(),
  buildCalendarColumns: vi.fn(),
  fetchOpenDental: vi.fn(),
  decrypt: vi.fn(),
  select: vi.fn(),
  getNextPracticeAppointmentDate: vi.fn(),
  getPracticeAppointments: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth/options', () => ({ authOptions: {} }));
vi.mock('@/lib/auth/guards', () => ({
  requirePracticeMembership: mocks.requirePracticeMembership,
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
vi.mock('@/db/schema/practices', () => ({
  practices: { id: 'practice-id', slug: 'practice-slug' },
}));
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
vi.mock('@/lib/appointments/appointment-repository', () => ({
  getNextPracticeAppointmentDate: mocks.getNextPracticeAppointmentDate,
  getPracticeAppointments: mocks.getPracticeAppointments,
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
}));

import { GET } from './route';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';

function mockPracticeLookup(slug = 'ordinary-practice') {
  const practiceQuery = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue([{ slug }]),
  };
  practiceQuery.from.mockReturnValue(practiceQuery);
  practiceQuery.where.mockReturnValue(practiceQuery);
  mocks.select.mockReturnValueOnce(practiceQuery);
}

describe('Open Dental appointments route', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the locally stored consent flags with matching appointment patient details', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({});
    mockPracticeLookup();
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
      new NextRequest(`http://localhost/api/opendental/appointments?practiceId=${practiceId}&date=2026-10-21`)
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

  it('returns local appointment and patient records when Open Dental credentials are missing', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({});
    mockPracticeLookup('appointment-reminder-sample');
    mocks.getPracticeAppointments.mockResolvedValue({
      appointments: [{
        opendentalApptId: 7801,
        patientOpendentalId: 8901,
        scheduledAt: new Date('2026-11-13T14:00:00.000Z'),
        practiceTimezone: 'America/New_York',
        status: 'Scheduled',
        description: 'Sample data: Routine dental cleaning',
        confirmationStatus: null,
        patientFirstName: 'William',
        patientLastName: 'Clark',
        patientStatus: 'Patient',
        patientDateOfBirth: '1985-06-15',
        patientPhoneHome: null,
        patientPhoneMobile: null,
        patientEmail: 'prem@daava.ai',
        patientSmsConsent: false,
        patientEmailConsent: true,
      }],
      total: 1,
    });

    const credentialsQuery = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([]),
    };
    credentialsQuery.from.mockReturnValue(credentialsQuery);
    credentialsQuery.where.mockReturnValue(credentialsQuery);
    mocks.select.mockReturnValueOnce(credentialsQuery);

    const response = await GET(
      new NextRequest(`http://localhost/api/opendental/appointments?practiceId=${practiceId}&date=2026-11-13`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject([{
      AptNum: 7801,
      PatNum: 8901,
      AptDateTime: '2026-11-13 09:00:00',
      patientName: 'Clark, William',
      patientDetails: {
        Email: 'prem@daava.ai',
        emailConsent: true,
      },
    }]);
    expect(mocks.getPracticeAppointments).toHaveBeenCalledWith(practiceId, {
      date: '2026-11-13',
      limit: 500,
      offset: 0,
    });
    expect(mocks.getOpenDentalAppointments).not.toHaveBeenCalled();
  });

  it('uses local sample appointments even when Open Dental credentials exist for the sample practice', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({});
    mockPracticeLookup('appointment-reminder-sample');
    const credentialsQuery = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([
        { developerKeyEnc: 'encrypted-developer-key', customerKeyEnc: 'encrypted-customer-key' },
      ]),
    };
    credentialsQuery.from.mockReturnValue(credentialsQuery);
    credentialsQuery.where.mockReturnValue(credentialsQuery);
    mocks.select.mockReturnValueOnce(credentialsQuery);
    mocks.getPracticeAppointments.mockResolvedValue({ appointments: [], total: 0 });
    mocks.getNextPracticeAppointmentDate.mockResolvedValue('2026-11-13');

    const response = await GET(
      new NextRequest(`http://localhost/api/opendental/appointments?practiceId=${practiceId}&date=2026-11-05`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ data: [], nextAppointmentDate: '2026-11-13' });
    expect(mocks.getOpenDentalAppointments).not.toHaveBeenCalled();
  });

  it('includes the next local appointment date when the requested day is empty', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-id' } });
    mocks.requirePracticeMembership.mockResolvedValue({});
    mockPracticeLookup();
    mocks.getPracticeAppointments.mockResolvedValue({ appointments: [], total: 0 });
    mocks.getNextPracticeAppointmentDate.mockResolvedValue('2026-11-12');

    const credentialsQuery = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([]),
    };
    credentialsQuery.from.mockReturnValue(credentialsQuery);
    credentialsQuery.where.mockReturnValue(credentialsQuery);
    mocks.select.mockReturnValueOnce(credentialsQuery);

    const response = await GET(
      new NextRequest(`http://localhost/api/opendental/appointments?practiceId=${practiceId}&date=2026-11-05`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ data: [], nextAppointmentDate: '2026-11-12' });
    expect(mocks.getNextPracticeAppointmentDate).toHaveBeenCalledWith(practiceId);
  });
});
