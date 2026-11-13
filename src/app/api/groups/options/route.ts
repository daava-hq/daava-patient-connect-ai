import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { getPracticeGroupOptions } from '@/lib/groups/group-repository';

const practiceIdSchema = z.string().uuid();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const practiceId = practiceIdSchema.safeParse(req.nextUrl.searchParams.get('practiceId'));
    if (!practiceId.success) {
      return NextResponse.json({ error: 'A valid practiceId is required' }, { status: 400 });
    }

    await requirePracticeMembership(session.user.id, practiceId.data);
    const groups = await getPracticeGroupOptions(practiceId.data);
    return NextResponse.json({ data: groups });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Unable to load group options' }, { status: 500 });
  }
}
