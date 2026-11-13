import 'server-only';
import { z } from 'zod';
import { fetchOpenDental } from './client';

const recallResponseSchema = z
  .object({
    RecallNum: z.number().int().positive(),
    PatNum: z.number().int().positive(),
    RecallTypeNum: z.number().int().positive(),
    DateDue: z.string().nullable().optional(),
    DateScheduled: z.string().nullable().optional(),
    IsDisabled: z.union([z.boolean(), z.enum(['true', 'false'])]),
  })
  .passthrough();

export interface NormalizedOpenDentalRecall {
  recallNum: number;
  patientNum: number;
  recallTypeNum: number;
  dueDate: string | null;
  dateScheduled: string | null;
  isDisabled: boolean;
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value || value === '0001-01-01') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Open Dental recall date must use YYYY-MM-DD format');
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Open Dental recall date is invalid');
  }
  return value;
}

export function parseOpenDentalRecall(value: unknown): NormalizedOpenDentalRecall {
  const recall = recallResponseSchema.parse(value);
  return {
    recallNum: recall.RecallNum,
    patientNum: recall.PatNum,
    recallTypeNum: recall.RecallTypeNum,
    dueDate: normalizeDate(recall.DateDue),
    dateScheduled: normalizeDate(recall.DateScheduled),
    isDisabled: typeof recall.IsDisabled === 'boolean' ? recall.IsDisabled : recall.IsDisabled === 'true',
  };
}

export async function getOpenDentalRecalls(
  developerKey: string,
  customerKey: string,
): Promise<unknown[]> {
  return fetchOpenDental<unknown[]>(developerKey, customerKey, 'recalls');
}
