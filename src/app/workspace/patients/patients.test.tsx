import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PatientsPage from './page';
import { formatDob } from '@/lib/patients/patient-utils';

describe('formatDob helper', () => {
  it('returns em-dash for undefined or empty string', () => {
    expect(formatDob(undefined)).toBe('—');
    expect(formatDob('')).toBe('—');
  });

  it('returns em-dash for Open Dental default missing birthdate (0001-01-01)', () => {
    expect(formatDob('0001-01-01')).toBe('—');
    expect(formatDob('0001-01-01T00:00:00')).toBe('—');
  });

  it('formats YYYY-MM-DD birthdate as MM/DD/YYYY without timezone shift', () => {
    expect(formatDob('1985-04-12')).toBe('04/12/1985');
    expect(formatDob('1990-11-05')).toBe('11/05/1990');
    expect(formatDob('1972-01-09T00:00:00')).toBe('01/09/1972');
  });

  it('pads single-digit month and day correctly', () => {
    expect(formatDob('1995-3-7')).toBe('03/07/1995');
  });
});

describe('PatientsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const mockPatients = [
    {
      PatNum: 101,
      FName: 'John',
      LName: 'Doe',
      Birthdate: '1985-04-12',
      WirelessPhone: '(555) 123-4567',
      Email: 'john.doe@example.com',
      PatStatus: 'Patient',
      smsConsent: true,
      emailConsent: true,
    },
    {
      PatNum: 102,
      FName: 'Jane',
      LName: 'Smith',
      Birthdate: '0001-01-01',
      WirelessPhone: '(555) 987-6543',
      Email: 'jane.smith@example.com',
      PatStatus: 'Prospective',
      smsConsent: false,
      emailConsent: false,
    },
  ];

  it('renders table column headers including Last Name, First Name, and DOB', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/opendental/patients')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                data: mockPatients,
                total: 2,
              }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
      })
    );

    render(<PatientsPage />);

    expect(screen.queryByRole('button', { name: 'Sync to Database' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Refresh API' })).toBeNull();

    // Verify column headers exist
    await waitFor(() => {
      expect(screen.getByText('OD PatNum')).toBeDefined();
      expect(screen.getByText('Last Name')).toBeDefined();
      expect(screen.getByText('First Name')).toBeDefined();
      expect(screen.getByText('DOB')).toBeDefined();
      expect(screen.getByText('Mobile Phone')).toBeDefined();
      expect(screen.getByText('Email')).toBeDefined();
      expect(screen.getByText('Consent Status')).toBeDefined();
      expect(screen.getByText('Status')).toBeDefined();
    });

    // Verify row data for patient 101
    expect(screen.getByText('#101')).toBeDefined();
    expect(screen.getByText('Doe')).toBeDefined();
    expect(screen.getByText('John')).toBeDefined();
    expect(screen.getByText('04/12/1985')).toBeDefined();
    expect(screen.getByText('(555) 123-4567')).toBeDefined();
    expect(screen.getByText('john.doe@example.com')).toBeDefined();
    expect(screen.getByLabelText('Email consent: yes')).toBeDefined();
    expect(screen.getByLabelText('Phone consent: yes')).toBeDefined();

    // Verify row data for patient 102 (with 0001-01-01 DOB showing '—')
    expect(screen.getByText('#102')).toBeDefined();
    expect(screen.getByText('Smith')).toBeDefined();
    expect(screen.getByText('Jane')).toBeDefined();
    expect(screen.getByText('—')).toBeDefined();
    expect(screen.getByLabelText('Email consent: no')).toBeDefined();
    expect(screen.getByLabelText('Phone consent: no')).toBeDefined();
  });

  it('only shows consent icons when the matching contact information exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/opendental/patients')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                data: [
                  {
                    PatNum: 103,
                    FName: 'Alex',
                    LName: 'Taylor',
                    Email: 'alex.taylor@example.com',
                    emailConsent: true,
                    smsConsent: true,
                  },
                  {
                    PatNum: 104,
                    FName: 'Sam',
                    LName: 'Reed',
                    WirelessPhone: '555-0102',
                    emailConsent: true,
                    smsConsent: true,
                  },
                ],
                total: 2,
              }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
      })
    );

    render(<PatientsPage />);

    expect(await screen.findByLabelText('Email consent: yes')).toBeDefined();
    expect(screen.getAllByLabelText('Email consent: yes')).toHaveLength(1);
    expect(screen.getAllByLabelText('Phone consent: yes')).toHaveLength(1);
  });

  it('filters patients by Last Name, First Name, or DOB in search', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/opendental/patients')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                data: mockPatients,
                total: 2,
              }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
      })
    );

    render(<PatientsPage />);

    await waitFor(() => {
      expect(screen.getByText('Doe')).toBeDefined();
      expect(screen.getByText('Smith')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText('Search patients by name, DOB, email, phone...');

    // Search by Last Name 'Doe'
    fireEvent.change(searchInput, { target: { value: 'Doe' } });
    expect(screen.getByText('Doe')).toBeDefined();
    expect(screen.queryByText('Smith')).toBeNull();

    // Search by First Name 'Jane'
    fireEvent.change(searchInput, { target: { value: 'Jane' } });
    expect(screen.queryByText('Doe')).toBeNull();
    expect(screen.getByText('Smith')).toBeDefined();

    // Search by DOB '04/12/1985'
    fireEvent.change(searchInput, { target: { value: '04/12/1985' } });
    expect(screen.getByText('Doe')).toBeDefined();
    expect(screen.queryByText('Smith')).toBeNull();
  });
});
