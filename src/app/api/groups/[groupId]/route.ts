import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import {
  archiveGroup,
  countGroupMembers,
  getGroupById,
  restoreGroup,
  updateGroup,
} from '@/lib/groups/group-repository';
import { AppError, NotFoundError } from '@/lib/errors';
import { groupCriteriaSchema, groupDescriptionSchema, groupNameSchema } from '@/lib/groups/group-validation';

const practiceQuerySchema = z.object({ practiceId: z.string().uuid() }).strict();
const updateSchema = z.object({
    practiceId: z.string().uuid(),
    name: groupNameSchema.optional(),
    description: groupDescriptionSchema,
    criteria: groupCriteriaSchema.optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value).every((key) => key === 'practiceId')) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one group field must be provided' });
    }
    if (
      value.archived !== undefined &&
      Object.keys(value).some((key) => key !== 'practiceId' && key !== 'archived')
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Archive changes must be submitted separately' });
    }
  });

interface RouteContext {
  params: { groupId: string };
}

function validateGroupId(groupId: string) {
  const parsed = z.string().uuid().safeParse(groupId);
  if (!parsed.success) throw new NotFoundError('Group not found');
  return parsed.data;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const query = practiceQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!query.success) return NextResponse.json({ error: 'Invalid practiceId' }, { status: 400 });
    const groupId = validateGroupId(params.groupId);
    await requirePracticeMembership(session.user.id, query.data.practiceId);
    const group = await getGroupById(query.data.practiceId, groupId);
    if (!group) throw new NotFoundError('Group not found');
    const memberCount = await countGroupMembers(query.data.practiceId, groupId);
    return NextResponse.json({ data: { ...group, memberCount } });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }
    const groupId = validateGroupId(params.groupId);
    const { practiceId, archived, ...updates } = parsed.data;
    await requirePracticeMembership(session.user.id, practiceId);

    if (archived !== undefined) {
      const group = archived
        ? (await archiveGroup(practiceId, groupId), null)
        : await restoreGroup(practiceId, groupId);
      if (group) return NextResponse.json({ data: group });
      return NextResponse.json({ success: true });
    }

    const group = await updateGroup(practiceId, groupId, updates);
    return NextResponse.json({ data: group });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const query = practiceQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!query.success) return NextResponse.json({ error: 'Invalid practiceId' }, { status: 400 });
    const groupId = validateGroupId(params.groupId);
    await requirePracticeMembership(session.user.id, query.data.practiceId);
    await archiveGroup(query.data.practiceId, groupId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
