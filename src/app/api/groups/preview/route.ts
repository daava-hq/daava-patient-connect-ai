import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { previewGroupCriteria } from '@/lib/groups/group-repository';
import { groupCriteriaSchema } from '@/lib/groups/group-validation';
import { AppError } from '@/lib/errors';

const requestSchema = z.object({
  practiceId: z.string().uuid(),
  criteria: groupCriteriaSchema,
}).strict();

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }
    await requirePracticeMembership(session.user.id, parsed.data.practiceId);
    const result = await previewGroupCriteria(parsed.data.practiceId, parsed.data.criteria);
    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
