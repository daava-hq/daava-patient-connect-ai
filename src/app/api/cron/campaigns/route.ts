import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { practices } from '@/db/schema/practices';
import { processScheduledCampaigns } from '@/jobs/dispatch-campaign';
import { logError } from '@/lib/logger';
import sampleDataCatalog from '@/lib/sample-data/catalog.json';

export async function POST(req: NextRequest) {
  const expected = process.env.APPOINTMENT_REMINDERS_CRON_SECRET;
  const provided = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!expected) {
    return NextResponse.json({ error: 'Campaign scheduler is not configured' }, { status: 503 });
  }
  if (!provided || !constantTimeMatch(expected, provided)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sampleDataOnly = req.nextUrl.searchParams.get('sampleData') === 'true';
  if (req.nextUrl.searchParams.has('sampleData') && !sampleDataOnly) {
    return NextResponse.json({ error: 'Invalid sampleData value' }, { status: 400 });
  }
  if (
    sampleDataOnly &&
    process.env.APP_ENVIRONMENT !== 'local' &&
    process.env.APP_ENVIRONMENT !== 'dev'
  ) {
    return NextResponse.json({ error: 'Sample campaign cron is unavailable' }, { status: 404 });
  }

  try {
    let result: { processed: number; failed: number };
    if (sampleDataOnly) {
      const [samplePractice] = await db
        .select({ id: practices.id })
        .from(practices)
        .where(eq(practices.slug, sampleDataCatalog.practice.slug))
        .limit(1);
      if (!samplePractice) {
        return NextResponse.json({ error: 'Sample practice not found' }, { status: 404 });
      }
      result = await processScheduledCampaigns(samplePractice.id);
    } else {
      result = await processScheduledCampaigns();
    }
    return NextResponse.json({
      data: result,
      ...(result.failed > 0 ? { error: 'Some scheduled campaigns could not be dispatched' } : {}),
    }, { status: result.failed > 0 ? 500 : 200 });
  } catch (error) {
    logError('Campaign scheduler failed', error);
    return NextResponse.json({ error: 'Campaign scheduler failed' }, { status: 500 });
  }
}

function constantTimeMatch(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}
