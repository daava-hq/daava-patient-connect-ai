import 'server-only';
import { logInfo } from '@/lib/logger';
import { processBirthdayCampaigns } from '@/lib/birthdays/birthday-service';

export const jobName = 'birthday-engagement';
export const schedule = '*/5 * * * *';

export async function run(practiceId: string) {
  logInfo('Birthday engagement job started', { practiceId });
  const result = await processBirthdayCampaigns(practiceId);
  logInfo('Birthday engagement job completed', { practiceId, ...result });
  return result;
}
