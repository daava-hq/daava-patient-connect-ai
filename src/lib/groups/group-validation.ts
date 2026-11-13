import { z } from 'zod';

const patientStatuses = ['Patient', 'Inactive', 'Archived'] as const;
const appointmentStatuses = ['Scheduled', 'Complete', 'Broken', 'UnschedList'] as const;

export const groupCriteriaSchema = z
  .object({
    patientStatuses: z.array(z.enum(patientStatuses)).max(patientStatuses.length).optional(),
    minAge: z.number().int().min(0).max(120).optional(),
    maxAge: z.number().int().min(0).max(120).optional(),
    birthMonths: z.array(z.number().int().min(1).max(12)).max(12).optional(),
    appointmentStatuses: z.array(z.enum(appointmentStatuses)).max(appointmentStatuses.length).optional(),
    lastAppointmentAfter: z.string().date().optional(),
    lastAppointmentBefore: z.string().date().optional(),
    hasDueRecall: z.literal(true).optional(),
    contactAvailability: z.enum(['email', 'sms', 'either', 'both']).optional(),
  })
  .strict()
  .superRefine((criteria, context) => {
    if (criteria.minAge !== undefined && criteria.maxAge !== undefined && criteria.minAge > criteria.maxAge) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxAge'],
        message: 'Maximum age must be greater than or equal to minimum age',
      });
    }

    if (criteria.birthMonths && new Set(criteria.birthMonths).size !== criteria.birthMonths.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['birthMonths'],
        message: 'Birth months must be unique',
      });
    }

    if (
      criteria.lastAppointmentAfter &&
      criteria.lastAppointmentBefore &&
      criteria.lastAppointmentAfter > criteria.lastAppointmentBefore
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lastAppointmentBefore'],
        message: 'The last-appointment end date must not precede its start date',
      });
    }
  });

export const groupTypeSchema = z.enum(['static', 'dynamic']);
export const groupNameSchema = z.string().trim().min(1).max(255);
export const groupDescriptionSchema = z.string().trim().max(2000).nullable().optional();

export type ValidatedGroupCriteria = z.infer<typeof groupCriteriaSchema>;
