import 'server-only';
import { db } from '@/db';
import { practiceOpendentalCredentials } from '@/db/schema/practice_credentials';
import { eq } from 'drizzle-orm';
import { decrypt, getOpenDentalAppointments } from '@/lib/opendental';
import { upsertAppointment } from '@/lib/appointments/appointment-repository';
import { logError, logInfo } from '@/lib/logger';

export const jobName = 'sync-appointments';

export async function runAppointmentSync(practiceId: string): Promise<{ success: boolean; count: number; error?: string }> {
  console.log(`[Appointment Sync Step 1] Starting appointment sync for practice ID: ${practiceId}`);
  try {
    const [creds] = await db
      .select()
      .from(practiceOpendentalCredentials)
      .where(eq(practiceOpendentalCredentials.practiceId, practiceId))
      .limit(1);

    if (!creds) {
      console.log(`[Appointment Sync Error] Open Dental credentials not configured for practice ID: ${practiceId}`);
      return { success: false, count: 0, error: 'Open Dental credentials not configured for this practice' };
    }

    console.log(`[Appointment Sync Step 2] Successfully fetched and decrypted Open Dental credentials for practice ID: ${practiceId}`);
    const developerKey = decrypt(creds.developerKeyEnc);
    const customerKey = decrypt(creds.customerKeyEnc);

    let offset = 0;
    const limit = 100;
    let totalSynced = 0;

    while (true) {
      console.log(`[Appointment Sync Step 3] Fetching appointment batch from Open Dental API (Offset: ${offset}, Limit: ${limit})...`);
      const odAppointments = await getOpenDentalAppointments(developerKey, customerKey, {
        Limit: limit,
        Offset: offset,
      });

      console.log(`[Appointment Sync Step 4] Received ${odAppointments?.length || 0} appointments from Open Dental API batch.`);
      if (!odAppointments || odAppointments.length === 0) {
        break;
      }

      for (const od of odAppointments) {
        await upsertAppointment({
          practiceId,
          opendentalApptId: od.AptNum,
          opendentalPatientId: od.PatNum,
          scheduledAt: new Date(od.AptDateTime),
          status: od.AptStatus || 'Scheduled',
          description: od.ProcDescript,
          opendentalUpdatedAt: od.DateTStamp ? new Date(od.DateTStamp) : null,
        });
        totalSynced++;
      }

      if (odAppointments.length < limit) {
        break;
      }
      offset += limit;
    }

    // Update last synced watermark timestamp
    await db
      .update(practiceOpendentalCredentials)
      .set({
        lastApptSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(practiceOpendentalCredentials.practiceId, practiceId));

    console.log(`[Appointment Sync Success] Appointment sync completed successfully for practice ID: ${practiceId}. Total synchronized: ${totalSynced}`);
    logInfo('Appointment sync completed successfully', { practiceId, totalSynced });
    return { success: true, count: totalSynced };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[Appointment Sync Failure] Appointment sync failed for practice ID: ${practiceId}`, error);
    logError('Appointment sync failed', error, { practiceId });
    return { success: false, count: 0, error: error.message };
  }
}
