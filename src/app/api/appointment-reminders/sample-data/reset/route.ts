import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { resetSampleAppointmentReminderData } from '@/lib/appointment-reminders/reminder-service';
import { logError } from '@/lib/logger';

const resetSchema = z.object({ practiceId: z.string().uuid() }).strict();

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }

    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    await requirePracticeAdmin(session.user.id, parsed.data.practiceId);
    const data = await resetSampleAppointmentReminderData(parsed.data.practiceId);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logError('Unable to reset sample reminder data', error);
    return NextResponse.json({ error: 'Unable to reset sample reminder data' }, { status: 500 });
  }
}
