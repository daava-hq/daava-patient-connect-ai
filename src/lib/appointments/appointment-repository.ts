import 'server-only';
import { db } from '@/db';
import { appointments, Appointment, NewAppointment } from '@/db/schema/appointments';
import { patients } from '@/db/schema/patients';
import { practices } from '@/db/schema/practices';
import { eq, and, sql, asc, desc } from 'drizzle-orm';

export async function getNextPracticeAppointmentDate(practiceId: string) {
  const [appointment] = await db
    .select({
      scheduledAt: appointments.scheduledAt,
      practiceTimezone: practices.timezone,
    })
    .from(appointments)
    .innerJoin(practices, eq(appointments.practiceId, practices.id))
    .where(and(
      eq(appointments.practiceId, practiceId),
      sql`${appointments.scheduledAt} >= now()`
    ))
    .orderBy(asc(appointments.scheduledAt))
    .limit(1);

  if (!appointment) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: appointment.practiceTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(appointment.scheduledAt);
  const fields = new Map(parts.map(({ type, value }) => [type, value]));
  return `${fields.get('year')}-${fields.get('month')}-${fields.get('day')}`;
}

export async function getPracticeAppointments(
  practiceId: string,
  options: { status?: string; date?: string; limit?: number; offset?: number } = {}
) {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  const conditions = [eq(appointments.practiceId, practiceId)];
  if (options.status) {
    conditions.push(eq(appointments.status, options.status));
  }
  if (options.date) {
    conditions.push(
      sql`(${appointments.scheduledAt} AT TIME ZONE ${practices.timezone})::date = ${options.date}::date`
    );
  }

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const rows = await db
    .select({
      id: appointments.id,
      practiceId: appointments.practiceId,
      patientId: appointments.patientId,
      opendentalApptId: appointments.opendentalApptId,
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
      confirmationStatus: appointments.confirmationStatus,
      description: appointments.description,
      syncedAt: appointments.syncedAt,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientOpendentalId: patients.opendentalPatientId,
      patientDateOfBirth: patients.dateOfBirth,
      patientPhoneHome: patients.phoneHome,
      patientPhoneMobile: patients.phoneMobile,
      patientEmail: patients.email,
      patientStatus: patients.status,
      patientSmsConsent: patients.smsConsent,
      patientEmailConsent: patients.emailConsent,
      practiceTimezone: practices.timezone,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(practices, eq(appointments.practiceId, practices.id))
    .where(whereClause)
    .orderBy(desc(appointments.scheduledAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(appointments)
    .innerJoin(practices, eq(appointments.practiceId, practices.id))
    .where(whereClause);

  return {
    appointments: rows,
    total: Number(count),
  };
}

export async function upsertAppointment(data: {
  practiceId: string;
  opendentalApptId: number;
  opendentalPatientId: number;
  scheduledAt: Date;
  status: string;
  confirmationStatus?: string | null;
  description?: string | null;
  opendentalUpdatedAt?: Date | null;
}) {
  // Reconciliation: find patient by opendentalPatientId, or create stub patient if missing
  let [patient] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.practiceId, data.practiceId), eq(patients.opendentalPatientId, data.opendentalPatientId)))
    .limit(1);

  if (!patient) {
    [patient] = await db
      .insert(patients)
      .values({
        practiceId: data.practiceId,
        opendentalPatientId: data.opendentalPatientId,
        firstName: 'Unknown',
        lastName: `Patient #${data.opendentalPatientId}`,
        status: 'Patient',
      })
      .returning();
  }

  const [upserted] = await db
    .insert(appointments)
    .values({
      practiceId: data.practiceId,
      patientId: patient.id,
      opendentalApptId: data.opendentalApptId,
      scheduledAt: data.scheduledAt,
      status: data.status,
      confirmationStatus: data.confirmationStatus ?? null,
      description: data.description || null,
      opendentalUpdatedAt: data.opendentalUpdatedAt || null,
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [appointments.practiceId, appointments.opendentalApptId],
      set: {
        patientId: patient.id,
        scheduledAt: data.scheduledAt,
        status: data.status,
        description: data.description || null,
        opendentalUpdatedAt: data.opendentalUpdatedAt || null,
        syncedAt: new Date(),
        updatedAt: new Date(),
        ...(data.confirmationStatus !== undefined
          ? { confirmationStatus: data.confirmationStatus }
          : {}),
      },
    })
    .returning();

  return upserted;
}
