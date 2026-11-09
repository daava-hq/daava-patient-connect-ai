import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { birthdayCampaigns } from '@/db/schema/birthday_engagement';
import { practices } from '@/db/schema/practices';
import { run } from '@/jobs/birthday-engagement';
import { logError } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const secret = process.env.APPOINTMENT_REMINDERS_CRON_SECRET;
  const provided = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!secret) {
    return NextResponse.json({ error: 'Birthday scheduler is not configured' }, { status: 503 });
  }
  if (!provided || !constantTimeMatch(secret, provided)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activePractices = await db
    .selectDistinct({ practiceId: birthdayCampaigns.practiceId })
    .from(birthdayCampaigns)
    .innerJoin(practices, eq(birthdayCampaigns.practiceId, practices.id))
    .where(and(eq(birthdayCampaigns.enabled, true), isNull(birthdayCampaigns.deletedAt)));

  let practiceFailures = 0;
  const birthdays = { materialized: 0, processed: 0, sent: 0, failed: 0, skipped: 0 };
  for (const { practiceId } of activePractices) {
    try {
      const result = await run(practiceId);
      birthdays.materialized += result.materialized;
      birthdays.processed += result.processed;
      birthdays.sent += result.sent;
      birthdays.failed += result.failed;
      birthdays.skipped += result.skipped;
    } catch {
      logError('Birthday engagement job failed for practice', new Error('Job execution failed'), { practiceId });
      practiceFailures++;
    }
  }

  return NextResponse.json({
    data: { practicesProcessed: activePractices.length, practiceFailures, birthdays },
    ...(practiceFailures > 0 ? { error: 'Some practices could not be processed' } : {}),
  }, { status: practiceFailures > 0 ? 500 : 200 });
}

function constantTimeMatch(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}
