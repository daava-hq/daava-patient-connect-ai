import 'server-only';
import { logInfo } from '@/lib/logger';
import { processDueAppointmentReminders } from '@/lib/appointment-reminders/reminder-service';

export const jobName = 'appointment-reminders';
export const schedule = '*/5 * * * *';

export async function run(practiceId: string) {
  logInfo('Appointment reminder job started', { practiceId });
  const result = await processDueAppointmentReminders({ practiceId });
  logInfo('Appointment reminder job completed', { practiceId, ...result });
  return result;
}
