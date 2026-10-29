import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeAdmin } from '@/lib/auth/guards';
import { db } from '@/db';
import { practiceMembers } from '@/db/schema/practice_members';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { AppError } from '@/lib/errors';

const updateRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: practiceId, memberId } = params;
    await requirePracticeAdmin(session.user.id, practiceId);

    const body = await req.json().catch(() => ({}));
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid role provided', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const [targetMember] = await db
      .select()
      .from(practiceMembers)
      .where(and(eq(practiceMembers.id, memberId), eq(practiceMembers.practiceId, practiceId)))
      .limit(1);

    if (!targetMember) {
      return NextResponse.json({ error: 'Team member not found in this practice' }, { status: 404 });
    }

    // If demoting an owner, verify there is at least one other owner
    if (targetMember.role === 'owner' && parsed.data.role !== 'owner') {
      const allOwners = await db
        .select({ id: practiceMembers.id })
        .from(practiceMembers)
        .where(
          and(
            eq(practiceMembers.practiceId, practiceId),
            eq(practiceMembers.role, 'owner')
          )
        );

      if (allOwners.length <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote the only practice owner. Assign another owner first.' },
          { status: 400 }
        );
      }
    }

    const [updated] = await db
      .update(practiceMembers)
      .set({ role: parsed.data.role })
      .where(eq(practiceMembers.id, memberId))
      .returning();

    return NextResponse.json(
      { message: 'Role updated successfully', data: updated },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: practiceId, memberId } = params;
    await requirePracticeAdmin(session.user.id, practiceId);

    const [targetMember] = await db
      .select()
      .from(practiceMembers)
      .where(and(eq(practiceMembers.id, memberId), eq(practiceMembers.practiceId, practiceId)))
      .limit(1);

    if (!targetMember) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Check if target is current user
    if (targetMember.userId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the practice.' },
        { status: 400 }
      );
    }

    // Cannot remove admin or owner
    if (targetMember.role === 'admin' || targetMember.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove a team member with an administrator or owner role.' },
        { status: 400 }
      );
    }

    await db.delete(practiceMembers).where(eq(practiceMembers.id, memberId));

    return NextResponse.json({ message: 'Team member removed from practice' }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
