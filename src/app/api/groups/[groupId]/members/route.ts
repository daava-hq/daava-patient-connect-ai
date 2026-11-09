import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { addGroupMembers, getGroupMembers, removeGroupMembers } from '@/lib/groups/group-repository';
import { AppError } from '@/lib/errors';

const querySchema = z.object({
  practiceId: z.string().uuid(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const changeMembersSchema = z
  .object({
    practiceId: z.string().uuid(),
    patientIds: z.array(z.string().uuid()).min(1).max(500),
  })
  .strict();

export async function GET(req: NextRequest, { params }: { params: { groupId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const query = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    const groupId = z.string().uuid().safeParse(params.groupId);
    if (!query.success || !groupId.success) {
      return NextResponse.json({ error: 'Validation error' }, { status: 400 });
    }

    await requirePracticeMembership(session.user.id, query.data.practiceId);
    const result = await getGroupMembers(query.data.practiceId, groupId.data, {
      search: query.data.search,
      limit: query.data.limit,
      offset: (query.data.page - 1) * query.data.limit,
    });
    return NextResponse.json({ data: { ...result, page: query.data.page } });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { groupId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = changeMembersSchema.safeParse(await req.json());
    const groupId = z.string().uuid().safeParse(params.groupId);
    if (!parsed.success || !groupId.success) {
      return NextResponse.json({ error: 'Validation error' }, { status: 400 });
    }
    await requirePracticeMembership(session.user.id, parsed.data.practiceId);
    const added = await addGroupMembers(
      parsed.data.practiceId,
      groupId.data,
      parsed.data.patientIds,
      session.user.id
    );
    return NextResponse.json({ data: { added } }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { groupId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = changeMembersSchema.safeParse(await req.json());
    const groupId = z.string().uuid().safeParse(params.groupId);
    if (!parsed.success || !groupId.success) {
      return NextResponse.json({ error: 'Validation error' }, { status: 400 });
    }
    await requirePracticeMembership(session.user.id, parsed.data.practiceId);
    const removed = await removeGroupMembers(
      parsed.data.practiceId,
      groupId.data,
      parsed.data.patientIds,
      session.user.id
    );
    return NextResponse.json({ data: { removed } });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
