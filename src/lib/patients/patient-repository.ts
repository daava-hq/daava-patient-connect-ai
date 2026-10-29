import 'server-only';
import { db } from '@/db';
import { patients, Patient, NewPatient } from '@/db/schema/patients';
import { eq, and, sql, ilike, or } from 'drizzle-orm';

export async function getPracticePatients(
  practiceId: string,
  options: { search?: string; limit?: number; offset?: number } = {}
) {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  const conditions = [eq(patients.practiceId, practiceId)];

  if (options.search) {
    const searchPattern = `%${options.search}%`;
    conditions.push(
      or(
        ilike(patients.firstName, searchPattern),
        ilike(patients.lastName, searchPattern),
        ilike(patients.email, searchPattern),
        ilike(patients.phoneMobile, searchPattern)
      )!
    );
  }

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const rows = await db
    .select()
    .from(patients)
    .where(whereClause)
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(patients)
    .where(whereClause);

  return {
    patients: rows,
    total: Number(count),
  };
}

export async function getPatientById(practiceId: string, patientId: string) {
  const [patient] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.practiceId, practiceId), eq(patients.id, patientId)))
    .limit(1);

  return patient || null;
}

export async function upsertPatient(data: NewPatient) {
  const [upserted] = await db
    .insert(patients)
    .values(data)
    .onConflictDoUpdate({
      target: [patients.practiceId, patients.opendentalPatientId],
      set: {
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        phoneHome: data.phoneHome,
        phoneMobile: data.phoneMobile,
        email: data.email,
        status: data.status,
        opendentalUpdatedAt: data.opendentalUpdatedAt,
        syncedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return upserted;
}
