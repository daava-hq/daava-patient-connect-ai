import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { duplicateGroup } from '@/lib/groups/group-repository';
import { AppError, NotFoundError } from '@/lib/errors';

const requestSchema = z.object({ practiceId: z.string().uuid() }).strict();

export async function POST(req: NextRequest, { params }: { params: { groupId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = requestSchema.safeParse(await req.json());
    const groupId = z.string().uuid().safeParse(params.groupId);
    if (!parsed.success || !groupId.success) {
      return NextResponse.json({ error: 'Validation error' }, { status: 400 });
    }
    await requirePracticeMembership(session.user.id, parsed.data.practiceId);
    const group = await duplicateGroup(parsed.data.practiceId, groupId.data, session.user.id);
    return NextResponse.json({ data: group }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    if (err instanceof Error && err.message.includes('not found')) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
