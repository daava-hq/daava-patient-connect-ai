import { z } from 'zod';

export const birthdayCampaignSchema = z.object({
  practiceId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  channel: z.enum(['sms', 'email']),
  templateId: z.string().uuid(),
  daysBefore: z.number().int().min(0).max(30),
  localDeliveryTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  offerText: z.string().max(500).nullable().default(null),
  eligibilityRules: z.object({
    minimumAge: z.number().int().min(0).max(120).optional(),
    maximumAge: z.number().int().min(0).max(120).optional(),
  }).default({}),
  enabled: z.boolean().default(false),
}).superRefine((data, context) => {
  if (
    data.eligibilityRules.minimumAge !== undefined &&
    data.eligibilityRules.maximumAge !== undefined &&
    data.eligibilityRules.minimumAge > data.eligibilityRules.maximumAge
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['eligibilityRules', 'maximumAge'],
      message: 'Maximum age must be greater than or equal to minimum age',
    });
  }
});
