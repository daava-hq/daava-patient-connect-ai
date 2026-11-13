import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { opendentalRecalls } from '@/db/schema/opendental_recalls';
import { patients } from '@/db/schema/patients';
import { practiceOpendentalCredentials } from '@/db/schema/practice_credentials';
import { decrypt, getOpenDentalRecalls, parseOpenDentalRecall } from '@/lib/opendental';
import { logError, logInfo } from '@/lib/logger';

export const jobName = 'sync-recalls';

export async function runRecallSync(
  practiceId: string,
): Promise<{ success: boolean; count: number; skippedCount: number; error?: string }> {
  try {
    const [credentials] = await db
      .select()
      .from(practiceOpendentalCredentials)
      .where(eq(practiceOpendentalCredentials.practiceId, practiceId))
      .limit(1);

    if (!credentials) {
      return {
        success: false,
        count: 0,
        skippedCount: 0,
        error: 'Open Dental credentials not configured for this practice',
      };
    }

    const developerKey = decrypt(credentials.developerKeyEnc);
    const customerKey = decrypt(credentials.customerKeyEnc);
    const remoteRecalls = await getOpenDentalRecalls(developerKey, customerKey);
    const practicePatients = await db
      .select({ id: patients.id, opendentalPatientId: patients.opendentalPatientId })
      .from(patients)
      .where(eq(patients.practiceId, practiceId));
    const patientIdByOpenDentalId = new Map(
      practicePatients.map((patient) => [patient.opendentalPatientId, patient.id]),
    );

    const rows: Array<typeof opendentalRecalls.$inferInsert> = [];
    let skippedCount = 0;
    for (const remoteRecall of remoteRecalls) {
      try {
        const recall = parseOpenDentalRecall(remoteRecall);
        const patientId = patientIdByOpenDentalId.get(recall.patientNum);
        if (!patientId) {
          skippedCount++;
          continue;
        }
        rows.push({
          practiceId,
          patientId,
          opendentalRecallId: recall.recallNum,
          recallTypeNum: recall.recallTypeNum,
          dueDate: recall.dueDate,
          dateScheduled: recall.dateScheduled,
          isDisabled: recall.isDisabled,
          syncedAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (error) {
        skippedCount++;
        logError('Open Dental recall record was skipped', error, { practiceId, endpoint: 'recalls' });
      }
    }

    const syncedAt = new Date();
    await db.transaction(async (tx) => {
      await tx.delete(opendentalRecalls).where(eq(opendentalRecalls.practiceId, practiceId));
      if (rows.length) {
        await tx.insert(opendentalRecalls).values(rows);
      }
      await tx
        .update(practiceOpendentalCredentials)
        .set({ lastRecallSyncedAt: syncedAt, updatedAt: syncedAt })
        .where(eq(practiceOpendentalCredentials.practiceId, practiceId));
    });

    logInfo('Open Dental recall sync completed', {
      practiceId,
      totalSynced: rows.length,
      skippedCount,
    });
    return { success: true, count: rows.length, skippedCount };
  } catch (error) {
    const syncError = error instanceof Error ? error : new Error(String(error));
    logError('Open Dental recall sync failed', syncError, { practiceId });
    return {
      success: false,
      count: 0,
      skippedCount: 0,
      error: syncError.message,
    };
  }
}
