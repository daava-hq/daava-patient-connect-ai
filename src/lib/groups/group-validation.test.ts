import { describe, expect, it } from 'vitest';
import { groupCriteriaSchema } from './group-validation';

describe('groupCriteriaSchema', () => {
  it('accepts supported, privacy-conscious synchronized patient filters', () => {
    const result = groupCriteriaSchema.safeParse({
      patientStatuses: ['Patient'],
      minAge: 18,
      maxAge: 65,
      birthMonths: [1, 6, 12],
      appointmentStatuses: ['Complete'],
      lastAppointmentAfter: '2025-01-01',
      lastAppointmentBefore: '2025-12-31',
      contactAvailability: 'either',
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown and clinical attributes', () => {
    const result = groupCriteriaSchema.safeParse({
      treatmentPlan: 'anything',
      diagnosis: 'anything',
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid age ranges, dates, months, and appointment statuses', () => {
    const result = groupCriteriaSchema.safeParse({
      minAge: 70,
      maxAge: 40,
      birthMonths: [2, 2],
      appointmentStatuses: ['Unknown'],
      lastAppointmentAfter: '2026-03-01',
      lastAppointmentBefore: '2026-02-01',
    });

    expect(result.success).toBe(false);
  });
});
