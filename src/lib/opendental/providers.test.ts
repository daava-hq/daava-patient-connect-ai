import { describe, it, expect } from 'vitest';
import {
  buildCalendarColumns,
  displayName,
  shortName,
} from './providers';
import { OpenDentalProvider, OpenDentalOperatory } from './types';

describe('Open Dental Providers & Operatories Calendar Columns', () => {
  const sampleProviders: OpenDentalProvider[] = [
    {
      ProvNum: 1,
      FName: 'Brian',
      LName: 'Albert',
      ProvStatus: 'Active',
      IsHidden: 'false',
    },
    {
      ProvNum: 2,
      FName: 'Tina',
      LName: 'Jones',
      ProvStatus: 'Active',
      IsHidden: 'false',
    },
    {
      ProvNum: 3,
      FName: 'Sarah',
      LName: 'Lexington',
      Suffix: 'DDS',
      ProvStatus: 'Active',
      IsHidden: 'false',
    },
    {
      ProvNum: 4,
      FName: 'Bruce',
      LName: 'Bently',
      ProvStatus: 'Active',
      IsHidden: 'false',
    },
    {
      ProvNum: 99,
      FName: 'Hidden',
      LName: 'Doctor',
      ProvStatus: 'Hidden',
      IsHidden: 'true',
    },
  ];

  const sampleOperatories: OpenDentalOperatory[] = [
    {
      OperatoryNum: 1,
      OpName: 'Dr. Brian Albert',
      ItemOrder: 0,
      IsHidden: 'false',
      ProvDentist: 1,
      ProvHygienist: 0,
      IsHygiene: 'false',
    },
    {
      OperatoryNum: 2,
      OpName: 'Dr. Sarah Lexington',
      ItemOrder: 1,
      IsHidden: 'false',
      ProvDentist: 3,
      ProvHygienist: 0,
      IsHygiene: 'false',
    },
    {
      OperatoryNum: 3,
      OpName: 'Doctor Overflow',
      ItemOrder: 2,
      IsHidden: 'false',
      ProvDentist: 0,
      ProvHygienist: 0,
      IsHygiene: 'false',
    },
    {
      OperatoryNum: 4,
      OpName: 'Operatory 4',
      ItemOrder: 3,
      IsHidden: 'true',
      ProvDentist: 0,
      ProvHygienist: 0,
      IsHygiene: 'false',
    },
    {
      OperatoryNum: 5,
      OpName: 'Tina',
      ItemOrder: 4,
      IsHidden: 'false',
      ProvDentist: 1,
      ProvHygienist: 2,
      IsHygiene: 'true',
    },
    {
      OperatoryNum: 6,
      OpName: 'Bruce',
      ItemOrder: 5,
      IsHidden: 'false',
      ProvDentist: 3,
      ProvHygienist: 4,
      IsHygiene: 'true',
    },
  ];

  it('formats provider display name and short name properly', () => {
    const doc = sampleProviders[0];
    expect(displayName(doc, 'Doctor')).toBe('Dr. Brian Albert');
    expect(shortName(doc, 'Doctor')).toBe('B. Albert');

    const hyg = sampleProviders[1];
    expect(displayName(hyg, 'Hygienist')).toBe('Tina Jones');
    expect(shortName(hyg, 'Hygienist')).toBe('T. Jones');
  });

  it('builds calendar columns ordered by ItemOrder excluding hidden operatories', () => {
    const columns = buildCalendarColumns(sampleProviders, sampleOperatories);

    // Expect 5 columns (Operatory 4 is hidden)
    expect(columns).toHaveLength(5);

    expect(columns[0]).toEqual({
      id: 'provider-1-operatory-1',
      name: 'Dr. Brian Albert',
      shortName: 'B. Albert',
      providerNum: 1,
      operatoryNum: 1,
      operatoryName: 'Dr. Brian Albert',
      role: 'Doctor',
    });

    expect(columns[1]).toEqual({
      id: 'provider-3-operatory-2',
      name: 'Dr. Sarah Lexington',
      shortName: 'S. Lexington',
      providerNum: 3,
      operatoryNum: 2,
      operatoryName: 'Dr. Sarah Lexington',
      role: 'Doctor',
    });

    expect(columns[2]).toEqual({
      id: 'operatory-3',
      name: 'Doctor Overflow',
      shortName: 'Doctor Overflow',
      providerNum: 0,
      operatoryNum: 3,
      operatoryName: 'Doctor Overflow',
      role: 'Doctor',
    });

    expect(columns[3]).toEqual({
      id: 'provider-2-operatory-5',
      name: 'Tina Jones',
      shortName: 'Tina',
      providerNum: 2,
      operatoryNum: 5,
      operatoryName: 'Tina',
      role: 'Hygienist',
    });

    expect(columns[4]).toEqual({
      id: 'provider-4-operatory-6',
      name: 'Bruce Bently',
      shortName: 'Bruce',
      providerNum: 4,
      operatoryNum: 6,
      operatoryName: 'Bruce',
      role: 'Hygienist',
    });
  });
});
