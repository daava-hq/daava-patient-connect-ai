import 'server-only';
import { db } from '@/db';
import { practiceOpendentalCredentials } from '@/db/schema/practice_credentials';
import { eq } from 'drizzle-orm';
import { decrypt, getOpenDentalAppointments } from '@/lib/opendental';
import { upsertAppointment } from '@/lib/appointments/appointment-repository';
import { logError, logInfo } from '@/lib/logger';

export const jobName = 'sync-appointments';

export async function runAppointmentSync(practiceId: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const [creds] = await db
      .select()
      .from(practiceOpendentalCredentials)
      .where(eq(practiceOpendentalCredentials.practiceId, practiceId))
      .limit(1);

    if (!creds) {
      return { success: false, count: 0, error: 'Open Dental credentials not configured for this practice' };
    }

    const developerKey = decrypt(creds.developerKeyEnc);
    const customerKey = decrypt(creds.customerKeyEnc);

    let offset = 0;
    const limit = 100;
    let totalSynced = 0;

    while (true) {
      const odAppointments = await getOpenDentalAppointments(developerKey, customerKey, {
        limit,
        offset,
        since: creds.lastApptSyncedAt ? creds.lastApptSyncedAt.toISOString() : undefined,
      });

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

    logInfo('Appointment sync completed successfully', { practiceId, totalSynced });
    return { success: true, count: totalSynced };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logError('Appointment sync failed', error, { practiceId });
    return { success: false, count: 0, error: error.message };
  }
}
