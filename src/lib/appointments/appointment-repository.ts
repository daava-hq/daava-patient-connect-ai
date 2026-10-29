import 'server-only';
import { db } from '@/db';
import { appointments, Appointment, NewAppointment } from '@/db/schema/appointments';
import { patients } from '@/db/schema/patients';
import { eq, and, sql, desc } from 'drizzle-orm';

export async function getPracticeAppointments(
  practiceId: string,
  options: { status?: string; limit?: number; offset?: number } = {}
) {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  const conditions = [eq(appointments.practiceId, practiceId)];
  if (options.status) {
    conditions.push(eq(appointments.status, options.status));
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
      description: appointments.description,
      syncedAt: appointments.syncedAt,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(whereClause)
    .orderBy(desc(appointments.scheduledAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(appointments)
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
      },
    })
    .returning();

  return upserted;
}
