import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { getRecallAudienceGroupOptions } from '@/lib/groups/group-repository';

const querySchema = z.object({ practiceId: z.string().uuid() });

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid practiceId is required' }, { status: 400 });
    }

    const { practiceId } = parsed.data;
    await requirePracticeMembership(session.user.id, practiceId);
    const groups = await getRecallAudienceGroupOptions(practiceId);
    return NextResponse.json({ data: groups }, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load due-recall groups' }, { status: 500 });
  }
}
