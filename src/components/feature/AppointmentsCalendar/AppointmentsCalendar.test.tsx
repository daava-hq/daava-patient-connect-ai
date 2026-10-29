import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppointmentsCalendar from './AppointmentsCalendar';

describe('AppointmentsCalendar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders today date by default without clinic parameter, and shows hover details', async () => {
    let capturedUrl = '';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        if (url.includes('/api/opendental/appointments')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                data: [
                  {
                    AptNum: 135,
                    PatNum: 84,
                    patientName: 'Morgan, Alex',
                    IsNewPatient: 'true',
                    AptDateTime: '2026-10-21 10:30:00',
                    Op: 5,
                    ProvNum: 1,
                    ProvHyg: 2,
                    provAbbr: 'RDH Tina',
                    Pattern: '//XX//',
                    ProcDescript: 'Ex',
                    AptStatus: 'Scheduled',
                    confirmed: 'Unconfirmed',
                    durationMinutes: 30,
                    diseases: [
                      'High Blood Pressure',
                      'Artificial Joint',
                      'Breathing Problems',
                      'Anemia',
                      'Artificial Heart Valve',
                      'Asthma',
                    ],
                    patientDetails: {
                      PatNum: 84,
                      LName: 'Morgan',
                      FName: 'Alex',
                      PatStatus: 'Prospective',
                      Birthdate: '1978-11-05',
                      HmPhone: '(513)494-6021',
                      WkPhone: '',
                      WirelessPhone: '(513)494-6020',
                    },
                  },
                ],
                columns: [
                  {
                    id: 'provider-1-operatory-1',
                    name: 'Dr. Brian Albert',
                    shortName: 'B. Albert',
                    providerNum: 1,
                    operatoryNum: 1,
                    operatoryName: 'Dr. Brian Albert',
                    role: 'Doctor',
                  },
                  {
                    id: 'provider-3-operatory-2',
                    name: 'Dr. Sarah Lexington',
                    shortName: 'S. Lexington',
                    providerNum: 3,
                    operatoryNum: 2,
                    operatoryName: 'Dr. Sarah Lexington',
                    role: 'Doctor',
                  },
                  {
                    id: 'operatory-3',
                    name: 'Doctor Overflow',
                    shortName: 'Doctor Overflow',
                    providerNum: 0,
                    operatoryNum: 3,
                    operatoryName: 'Doctor Overflow',
                    role: 'Doctor',
                  },
                  {
                    id: 'provider-2-operatory-5',
                    name: 'Tina Jones',
                    shortName: 'Tina',
                    providerNum: 2,
                    operatoryNum: 5,
                    operatoryName: 'Tina',
                    role: 'Hygienist',
                  },
                  {
                    id: 'provider-4-operatory-6',
                    name: 'Bruce Bently',
                    shortName: 'Bruce',
                    providerNum: 4,
                    operatoryNum: 6,
                    operatoryName: 'Bruce',
                    role: 'Hygienist',
                  },
                ],
              }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
      })
    );

    render(<AppointmentsCalendar />);

    // Verify API call did NOT include clinic=harrisonburg
    expect(capturedUrl).not.toContain('clinic=');
    expect(capturedUrl).toContain('date=');

    // Page title and TIME header
    expect(screen.getByText('Appointment Calendar')).toBeDefined();
    expect(screen.getByText('TIME')).toBeDefined();

    // Verify operatory/provider column headers
    expect(screen.getByText('B. Albert')).toBeDefined();
    expect(screen.getByText('Dr. Brian Albert')).toBeDefined();
    expect(screen.getByText('S. Lexington')).toBeDefined();
    expect(screen.getByText('Dr. Sarah Lexington')).toBeDefined();
    expect(screen.getByText('Doctor Overflow')).toBeDefined();
    expect(screen.getByText('Tina')).toBeDefined();
    expect(screen.getByText('Bruce')).toBeDefined();

    // Wait for appointment card to render
    await waitFor(() => {
      expect(screen.getByText('NP-Morgan, Alex')).toBeDefined();
      expect(screen.getByText('30 min · Scheduled')).toBeDefined();
      expect(screen.getByText('Ex')).toBeDefined();
    });

    const card = screen.getByText('NP-Morgan, Alex').closest('[role="button"]')!;

    // Hover on card: triggers hover popover
    fireEvent.mouseEnter(card);

    // Verify hover popover details from screenshot
    expect(screen.getByText('Patient Picture')).toBeDefined();
    expect(screen.getByText('Unavailable')).toBeDefined();
    expect(screen.getByText('Wednesday, 10/21/2026')).toBeDefined();
    expect(screen.getByText('10:30 AM')).toBeDefined();
    expect(screen.getByText('30 Min')).toBeDefined();
    expect(screen.getByText('RDH Tina')).toBeDefined();
    expect(screen.getByText('Production: $0.00')).toBeDefined();
    expect(screen.getAllByText('Unconfirmed').length).toBeGreaterThanOrEqual(1);

    // Verify medical alerts
    expect(screen.getByText('High Blood Pressure')).toBeDefined();
    expect(screen.getByText('Artificial Joint')).toBeDefined();
    expect(screen.getByText('Breathing Problems')).toBeDefined();
    expect(screen.getByText('Anemia')).toBeDefined();
    expect(screen.getByText('Artificial Heart Valve')).toBeDefined();
    expect(screen.getByText('Asthma')).toBeDefined();

    // Verify patient bottom details
    expect(screen.getByText('84')).toBeDefined();
    expect(screen.getByText('Prospective')).toBeDefined();
    expect(screen.getByText('Age: 47')).toBeDefined();
    expect(screen.getByText('Hm: (513)494-6021')).toBeDefined();
    expect(screen.getByText('Cell: (513)494-6020')).toBeDefined();
    expect(screen.getByText('Confirm Method: —')).toBeDefined();
    expect(screen.getByText('Contact Method: —')).toBeDefined();
    expect(screen.getByText('Recall Method: —')).toBeDefined();

    // Mouse leave hides the popover
    fireEvent.mouseLeave(card);
    expect(screen.queryByText('Production: $0.00')).toBeNull();
  });
});
