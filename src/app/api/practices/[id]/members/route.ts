import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership, requirePracticeAdmin } from '@/lib/auth/guards';
import { db } from '@/db';
import { users } from '@/db/schema/users';
import { practiceMembers } from '@/db/schema/practice_members';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { AppError } from '@/lib/errors';

const inviteSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
  password: z.string().min(8).max(128).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const practiceId = params.id;
    await requirePracticeMembership(session.user.id, practiceId);

    const members = await db
      .select({
        memberId: practiceMembers.id,
        role: practiceMembers.role,
        joinedAt: practiceMembers.createdAt,
        userId: users.id,
        name: users.name,
        email: users.email,
        userGlobalRole: users.role,
      })
      .from(practiceMembers)
      .innerJoin(users, eq(practiceMembers.userId, users.id))
      .where(eq(practiceMembers.practiceId, practiceId))
      .orderBy(practiceMembers.createdAt);

    return NextResponse.json({ data: members, currentUserId: session.user.id }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const practiceId = params.id;
    await requirePracticeAdmin(session.user.id, practiceId);

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = inviteSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { name, email, role, password } = parsed.data;

    // Check if user exists
    let [existingUser] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let userId = existingUser?.id;

    if (!existingUser) {
      // Create user
      const initialPassword = password || 'TemporaryPass123!';
      const hashedPassword = await bcrypt.hash(initialPassword, 12);
      const [newUser] = await db
        .insert(users)
        .values({
          name,
          email,
          hashedPassword,
          role: role === 'owner' ? 'admin' : 'member',
        })
        .returning({ id: users.id, name: users.name, email: users.email });
      userId = newUser.id;
    } else {
      // Check if already a member of this practice
      const [existingMember] = await db
        .select({ id: practiceMembers.id })
        .from(practiceMembers)
        .where(
          and(
            eq(practiceMembers.practiceId, practiceId),
            eq(practiceMembers.userId, existingUser.id)
          )
        )
        .limit(1);

      if (existingMember) {
        return NextResponse.json(
          { error: 'This user is already a member of this practice.' },
          { status: 409 }
        );
      }
    }

    // Add to practice_members
    const [newMember] = await db
      .insert(practiceMembers)
      .values({
        practiceId,
        userId: userId!,
        role,
      })
      .returning();

    return NextResponse.json(
      {
        message: 'Team member added successfully',
        data: {
          memberId: newMember.id,
          userId,
          name,
          email,
          role: newMember.role,
          joinedAt: newMember.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
