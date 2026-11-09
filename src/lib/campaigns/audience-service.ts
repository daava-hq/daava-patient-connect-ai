import 'server-only';
import { db } from '@/db';
import { patients, Patient } from '@/db/schema/patients';
import { appointments } from '@/db/schema/appointments';
import { AudienceFilter } from '@/db/schema/campaigns';
import { eq, and, inArray, sql, gte, lte, type SQL } from 'drizzle-orm';
import { getGroupAudienceCondition } from '@/lib/groups/group-repository';

export type AudiencePatient = Pick<
  Patient,
  'id' | 'firstName' | 'lastName' | 'email' | 'phoneMobile' | 'phoneHome' | 'smsConsent' | 'emailConsent' | 'status' | 'dateOfBirth'
>;

/**
 * Resolves the audience for a campaign based on the stored AudienceFilter.
 * Always enforced:
 *  - practiceId scoping
 *  - Patient.status not 'Inactive' or 'Archived' unless explicitly included
 * Caller must apply the consent filter appropriate to the campaign channel
 * BEFORE dispatching (consent can change between audience resolution and send;
 * the dispatch job re-checks consent per recipient).
 */
export async function resolveAudience(
  practiceId: string,
  filter: AudienceFilter,
  limit?: number
): Promise<AudiencePatient[]> {
  const conditions = await getAudienceConditions(practiceId, filter);
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const query = db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      email: patients.email,
      phoneMobile: patients.phoneMobile,
      phoneHome: patients.phoneHome,
      smsConsent: patients.smsConsent,
      emailConsent: patients.emailConsent,
      status: patients.status,
      dateOfBirth: patients.dateOfBirth,
    })
    .from(patients)
    .where(whereClause);
  return limit ? query.limit(limit) : query;
}

async function getAudienceConditions(practiceId: string, filter: AudienceFilter): Promise<SQL[]> {
  const conditions: SQL[] = [eq(patients.practiceId, practiceId)];

  // Patient status filter
  if (filter.patientStatuses && filter.patientStatuses.length > 0) {
    conditions.push(inArray(patients.status, filter.patientStatuses));
  } else {
    // Default: active patients only
    conditions.push(eq(patients.status, 'Patient'));
  }

  // Consent filter — applied here for audience preview; re-checked per-recipient at send time
  if (filter.consentSms === true) {
    conditions.push(eq(patients.smsConsent, true));
  }
  if (filter.consentEmail === true) {
    conditions.push(eq(patients.emailConsent, true));
    conditions.push(sql`${patients.email} ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'`);
  }

  // Birthday month filter
  if (filter.birthdayMonth !== undefined) {
    conditions.push(sql`EXTRACT(MONTH FROM ${patients.dateOfBirth}) = ${filter.birthdayMonth}`);
  }

  // Explicit patient list
  if (filter.patientIds && filter.patientIds.length > 0) {
    conditions.push(inArray(patients.id, filter.patientIds));
  }

  // Group membership filter
  if (filter.groupIds && filter.groupIds.length > 0) {
    conditions.push(await getGroupAudienceCondition(practiceId, filter.groupIds));
  }

  // Appointment date range filter
  if (filter.appointmentAfter || filter.appointmentBefore) {
    const apptConditions = [eq(appointments.practiceId, practiceId)];
    if (filter.appointmentAfter) {
      apptConditions.push(gte(appointments.scheduledAt, new Date(filter.appointmentAfter)));
    }
    if (filter.appointmentBefore) {
      apptConditions.push(lte(appointments.scheduledAt, new Date(filter.appointmentBefore)));
    }

    const apptPatientIds = await db
      .selectDistinct({ patientId: appointments.patientId })
      .from(appointments)
      .where(and(...apptConditions));

    const ids = apptPatientIds.map((r) => r.patientId);
    if (ids.length === 0) return [];
    conditions.push(inArray(patients.id, ids));
  }

  return conditions;
}

/**
 * Counts the audience without fetching full records.
 */
export async function countAudience(practiceId: string, filter: AudienceFilter): Promise<number> {
  const conditions = await getAudienceConditions(practiceId, filter);
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(patients)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0]);
  return result?.count ?? 0;
}

/**
 * Filters an audience list by consent for the given channel.
 * Called by the dispatch job immediately before sending to catch opt-outs.
 */
export function filterByConsent(
  patients: AudiencePatient[],
  channel: 'sms' | 'email'
): { consenting: AudiencePatient[]; opted_out: AudiencePatient[] } {
  const consenting: AudiencePatient[] = [];
  const opted_out: AudiencePatient[] = [];

  for (const p of patients) {
    const hasConsent = channel === 'sms' ? p.smsConsent : p.emailConsent;
    if (hasConsent) consenting.push(p);
    else opted_out.push(p);
  }

  return { consenting, opted_out };
}

export function isValidEmailAddress(value: string | null | undefined): value is string {
  return typeof value === 'string' &&
    value.trim().length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
