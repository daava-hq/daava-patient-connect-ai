import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { appointmentReminderSchedules } from '@/db/schema/appointment_reminders';
import { run } from '@/jobs/appointment-reminders';
import { logError } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const secret = process.env.APPOINTMENT_REMINDERS_CRON_SECRET;
  const provided = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!secret) {
    return NextResponse.json({ error: 'Appointment reminder scheduler is not configured' }, { status: 503 });
  }
  if (!provided || !constantTimeMatch(secret, provided)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activePractices = await db
    .selectDistinct({ practiceId: appointmentReminderSchedules.practiceId })
    .from(appointmentReminderSchedules)
    .where(eq(appointmentReminderSchedules.enabled, true));

  let processed = 0;
  let failed = 0;
  for (const { practiceId } of activePractices) {
    try {
      await run(practiceId);
      processed++;
    } catch {
      logError('Appointment reminder job failed for practice', new Error('Job execution failed'), { practiceId });
      failed++;
    }
  }

  return NextResponse.json({
    data: { practicesProcessed: processed + failed, failed },
    ...(failed > 0 ? { error: 'Some practices could not be processed' } : {}),
  }, { status: failed > 0 ? 500 : 200 });
}

function constantTimeMatch(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}
