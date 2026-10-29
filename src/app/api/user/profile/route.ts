import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { db } from '@/db';
import { users } from '@/db/schema/users';
import { practiceMembers } from '@/db/schema/practice_members';
import { practices } from '@/db/schema/practices';
import { organisations } from '@/db/schema/organisations';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';
import { AppError } from '@/lib/errors';

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase().trim().optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const memberships = await db
      .select({
        practiceId: practices.id,
        practiceName: practices.name,
        practiceSlug: practices.slug,
        organisationName: organisations.name,
        role: practiceMembers.role,
        joinedAt: practiceMembers.createdAt,
      })
      .from(practiceMembers)
      .innerJoin(practices, eq(practiceMembers.practiceId, practices.id))
      .innerJoin(organisations, eq(practices.organisationId, organisations.id))
      .where(eq(practiceMembers.userId, session.user.id));

    return NextResponse.json({ data: { user, practices: memberships } }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateProfileSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { name, email } = parsed.data;

    if (email) {
      const [emailConflict] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), ne(users.id, session.user.id)))
        .limit(1);

      if (emailConflict) {
        return NextResponse.json(
          { error: 'This email address is already in use by another account.' },
          { status: 409 }
        );
      }
    }

    const updates: Record<string, unknown> = {
      name,
      updatedAt: new Date(),
    };
    if (email) {
      updates.email = email;
    }

    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, session.user.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        updatedAt: users.updatedAt,
      });

    return NextResponse.json(
      { message: 'Profile updated successfully', data: updatedUser },
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
