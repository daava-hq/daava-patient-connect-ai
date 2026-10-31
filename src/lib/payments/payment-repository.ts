import 'server-only';
import { db } from '@/db';
import { patientBalances, PatientBalance, NewPatientBalance } from '@/db/schema/payments';
import { patients } from '@/db/schema/patients';
import { eq, and, gt, desc } from 'drizzle-orm';

export async function getPracticeBalances(practiceId: string) {
  return db
    .select({
      id: patientBalances.id,
      patientId: patientBalances.patientId,
      patientName: sql<string>`concat(${patients.firstName}, ' ', ${patients.lastName})`,
      email: patients.email,
      phoneMobile: patients.phoneMobile,
      balance: patientBalances.balance,
      lastReminderSentAt: patientBalances.lastReminderSentAt,
      paymentLinkSent: patientBalances.paymentLinkSent,
    })
    .from(patientBalances)
    .innerJoin(patients, eq(patientBalances.patientId, patients.id))
    .where(and(eq(patientBalances.practiceId, practiceId), gt(patientBalances.balance, '0.00')))
    .orderBy(desc(patientBalances.balance));
}

import { sql } from 'drizzle-orm';

export async function upsertPatientBalance(data: NewPatientBalance): Promise<PatientBalance> {
  const [upserted] = await db
    .insert(patientBalances)
    .values(data)
    .onConflictDoUpdate({
      target: [patientBalances.practiceId, patientBalances.patientId],
      set: { balance: data.balance, updatedAt: new Date() },
    })
    .returning();
  return upserted;
}
