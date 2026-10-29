import 'server-only';
import { db } from '@/db';
import { practiceOpendentalCredentials } from '@/db/schema/practice_credentials';
import { eq } from 'drizzle-orm';
import { decrypt, getOpenDentalPatients } from '@/lib/opendental';
import { upsertPatient } from '@/lib/patients/patient-repository';
import { logError, logInfo } from '@/lib/logger';

export const jobName = 'sync-patients';

export async function runPatientSync(practiceId: string): Promise<{ success: boolean; count: number; error?: string }> {
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
      const odPatients = await getOpenDentalPatients(developerKey, customerKey, {
        limit,
        offset,
        since: creds.lastPatientSyncedAt ? creds.lastPatientSyncedAt.toISOString() : undefined,
      });

      if (!odPatients || odPatients.length === 0) {
        break;
      }

      for (const od of odPatients) {
        await upsertPatient({
          practiceId,
          opendentalPatientId: od.PatNum,
          firstName: od.FName || 'Unknown',
          lastName: od.LName || 'Unknown',
          dateOfBirth: od.Birthdate ? od.Birthdate.split('T')[0] : null,
          phoneHome: od.HmPhone || null,
          phoneMobile: od.WirelessPhone || null,
          email: od.Email || null,
          status: od.PatStatus || 'Patient',
          opendentalUpdatedAt: od.DateTStamp ? new Date(od.DateTStamp) : null,
        });
        totalSynced++;
      }

      if (odPatients.length < limit) {
        break;
      }
      offset += limit;
    }

    // Update last synced timestamp
    await db
      .update(practiceOpendentalCredentials)
      .set({
        lastPatientSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(practiceOpendentalCredentials.practiceId, practiceId));

    logInfo('Patient sync completed successfully', { practiceId, totalSynced });
    return { success: true, count: totalSynced };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logError('Patient sync failed', error, { practiceId });
    return { success: false, count: 0, error: error.message };
  }
}
