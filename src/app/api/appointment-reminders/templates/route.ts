import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { getReminderTemplateOptions } from '@/lib/appointment-reminders/reminder-service';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsedPracticeId = z.string().uuid().safeParse(new URL(req.url).searchParams.get('practiceId'));
    if (!parsedPracticeId.success) {
      return NextResponse.json({ error: 'A valid practiceId is required' }, { status: 400 });
    }

    await requirePracticeMembership(session.user.id, parsedPracticeId.data);
    const templates = await getReminderTemplateOptions(parsedPracticeId.data);
    return NextResponse.json({ data: templates });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Unable to load appointment reminder templates' }, { status: 500 });
  }
}
