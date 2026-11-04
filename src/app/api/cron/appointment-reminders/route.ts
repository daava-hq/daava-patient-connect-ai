import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { appointmentReminderSchedules } from '@/db/schema/appointment_reminders';
import { practices } from '@/db/schema/practices';
import { run } from '@/jobs/appointment-reminders';
import { env } from '@/lib/env';
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

  const sampleDataOnly = req.nextUrl.searchParams.get('sampleData') === 'true';
  if (req.nextUrl.searchParams.has('sampleData') && !sampleDataOnly) {
    return NextResponse.json({ error: 'Invalid sampleData value' }, { status: 400 });
  }
  if (sampleDataOnly && env.APP_ENVIRONMENT !== 'local' && env.APP_ENVIRONMENT !== 'dev') {
    return NextResponse.json({ error: 'Sample reminder cron is unavailable' }, { status: 404 });
  }

  const activePracticeQuery = db
    .selectDistinct({ practiceId: appointmentReminderSchedules.practiceId })
    .from(appointmentReminderSchedules)
    .innerJoin(practices, eq(appointmentReminderSchedules.practiceId, practices.id));
  const activePractices = await activePracticeQuery.where(
    sampleDataOnly
      ? and(
          eq(appointmentReminderSchedules.enabled, true),
          eq(practices.slug, 'appointment-reminder-sample')
        )
      : eq(appointmentReminderSchedules.enabled, true)
  );

  let practicesProcessed = 0;
  let practiceFailures = 0;
  const reminders = { upserted: 0, processed: 0, sent: 0, failed: 0, skipped: 0 };
  for (const { practiceId } of activePractices) {
    try {
      const result = await run(practiceId);
      practicesProcessed++;
      reminders.upserted += result.upserted;
      reminders.processed += result.processed;
      reminders.sent += result.sent;
      reminders.failed += result.failed;
      reminders.skipped += result.skipped;
    } catch {
      logError('Appointment reminder job failed for practice', new Error('Job execution failed'), { practiceId });
      practiceFailures++;
    }
  }

  return NextResponse.json({
    data: {
      practicesProcessed: practicesProcessed + practiceFailures,
      practiceFailures,
      reminders,
    },
    ...(practiceFailures > 0 ? { error: 'Some practices could not be processed' } : {}),
  }, { status: practiceFailures > 0 ? 500 : 200 });
}

function constantTimeMatch(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}
