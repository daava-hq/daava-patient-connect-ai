import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { processScheduledCampaigns } from '@/jobs/dispatch-campaign';
import { logError } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const expected = process.env.APPOINTMENT_REMINDERS_CRON_SECRET;
  const provided = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!expected) {
    return NextResponse.json({ error: 'Campaign scheduler is not configured' }, { status: 503 });
  }
  if (!provided || !constantTimeMatch(expected, provided)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processScheduledCampaigns();
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
