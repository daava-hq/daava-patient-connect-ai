import 'server-only';
import { db } from '@/db';
import { referrals, Referral, NewReferral } from '@/db/schema/referrals';
import { patients } from '@/db/schema/patients';
import { eq, and, desc, sql } from 'drizzle-orm';
import { NotFoundError } from '@/lib/errors';

export async function getPracticeReferrals(practiceId: string) {
  return db
    .select({
      id: referrals.id,
      patientId: referrals.patientId,
      patientName: sql<string>`concat(${patients.firstName}, ' ', ${patients.lastName})`,
      referrerName: referrals.referrerName,
      referredTo: referrals.referredTo,
      status: referrals.status,
      notes: referrals.notes,
      createdAt: referrals.createdAt,
    })
    .from(referrals)
    .innerJoin(patients, eq(referrals.patientId, patients.id))
    .where(eq(referrals.practiceId, practiceId))
    .orderBy(desc(referrals.createdAt));
}

export async function createReferral(data: NewReferral): Promise<Referral> {
  const [created] = await db.insert(referrals).values(data).returning();
  return created;
}

export async function updateReferralStatus(practiceId: string, referralId: string, status: string): Promise<Referral> {
  const [updated] = await db
    .update(referrals)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(referrals.practiceId, practiceId), eq(referrals.id, referralId)))
    .returning();
  if (!updated) throw new NotFoundError('Referral not found');
  return updated;
}
