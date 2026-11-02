import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { updateReminderSchedule } from '@/lib/appointment-reminders/reminder-service';

const updateSchema = z.object({
  practiceId: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  interval: z.enum(['7_days', '3_days', '24_hours', 'same_day']).optional(),
  channel: z.enum(['sms', 'email']).optional(),
  localSendTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  templateId: z.string().uuid().optional(),
  enabled: z.boolean().optional(),
}).strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const { practiceId, ...changes } = parsed.data;
    await requirePracticeAdmin(session.user.id, practiceId);
    const updated = await updateReminderSchedule(practiceId, params.scheduleId, changes);
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Unable to update reminder schedule' }, { status: 500 });
  }
}
