import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { createGroup, getPracticeGroups } from '@/lib/groups/group-repository';
import { AppError } from '@/lib/errors';
import { groupCriteriaSchema, groupDescriptionSchema, groupNameSchema, groupTypeSchema } from '@/lib/groups/group-validation';
import { z } from 'zod';

const querySchema = z.object({
  practiceId: z.string().uuid(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  includeArchived: z.enum(['true', 'false']).default('false'),
});

const createGroupSchema = z
  .object({
    practiceId: z.string().uuid(),
    name: groupNameSchema,
    description: groupDescriptionSchema,
    groupType: groupTypeSchema.default('static'),
    criteria: groupCriteriaSchema.default({}),
    patientIds: z.array(z.string().uuid()).max(500).default([]),
  })
  .strict()
  .superRefine((group, context) => {
    if (group.groupType === 'dynamic' && group.patientIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['patientIds'],
        message: 'Dynamic groups derive their members from criteria',
      });
    }
    if (group.groupType === 'static' && Object.keys(group.criteria).length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['criteria'],
        message: 'Static groups do not accept dynamic criteria',
      });
    }
  });

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }
    const { practiceId, search, page, limit, includeArchived } = parsed.data;
    await requirePracticeMembership(session.user.id, practiceId);

    const result = await getPracticeGroups(practiceId, {
      search,
      includeArchived: includeArchived === 'true',
      limit,
      offset: (page - 1) * limit,
    });
    return NextResponse.json({ data: { ...result, page } });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = createGroupSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }
    const { practiceId, patientIds, ...groupData } = parsed.data;
    await requirePracticeMembership(session.user.id, practiceId);
    const group = await createGroup(
      { practiceId, ...groupData },
      patientIds,
      session.user.id
    );
    return NextResponse.json({ data: group }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
