import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { getBirthdayDashboard } from '@/lib/birthdays/birthday-service';

const querySchema = z.object({
  practiceId: z.string().uuid(),
  range: z.enum(['today', 'tomorrow', 'next7', 'thisMonth', 'custom']).default('next7'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid birthday dashboard query', details: parsed.error.flatten() }, { status: 400 });
    }

    await requirePracticeMembership(session.user.id, parsed.data.practiceId);
    const data = await getBirthdayDashboard({
      practiceId: parsed.data.practiceId,
      range: parsed.data.range,
      customStart: parsed.data.startDate,
      customEnd: parsed.data.endDate,
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Unable to load birthday dashboard' }, { status: 500 });
  }
}
