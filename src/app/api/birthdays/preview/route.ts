import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { previewBirthdayTemplate } from '@/lib/birthdays/birthday-service';
import { parseDateKey } from '@/lib/birthdays/birthday-utils';

const previewSchema = z.object({
  practiceId: z.string().uuid(),
  templateId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(100).default('Taylor'),
  birthdayDate: z.string().refine((value) => parseDateKey(value) !== null, 'Provide a valid birthday date').optional(),
  offer: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = previewSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }
    await requirePracticeMembership(session.user.id, parsed.data.practiceId);
    const data = await previewBirthdayTemplate(parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Unable to preview birthday template' }, { status: 500 });
  }
}
