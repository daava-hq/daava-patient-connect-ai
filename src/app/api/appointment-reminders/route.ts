import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeAdmin, requirePracticeMembership } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import {
  createReminderSchedule,
  getReminderDashboard,
} from '@/lib/appointment-reminders/reminder-service';

const practiceQuerySchema = z.string().uuid();
const scheduleSchema = z.object({
  practiceId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  interval: z.enum(['7_days', '3_days', '24_hours', 'same_day']),
  channel: z.enum(['sms', 'email']),
  localSendTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  templateId: z.string().uuid(),
  enabled: z.boolean().default(true),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const practiceId = practiceQuerySchema.safeParse(new URL(req.url).searchParams.get('practiceId'));
    if (!practiceId.success) {
      return NextResponse.json({ error: 'A valid practiceId is required' }, { status: 400 });
    }

    await requirePracticeMembership(session.user.id, practiceId.data);
    const data = await getReminderDashboard(practiceId.data);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Unable to load appointment reminders' }, { status: 500 });
  }
}

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
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const { practiceId, ...schedule } = parsed.data;
    await requirePracticeAdmin(session.user.id, practiceId);
    const created = await createReminderSchedule(practiceId, session.user.id, schedule);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Unable to save reminder schedule' }, { status: 500 });
  }
}
