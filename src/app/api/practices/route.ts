import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { db } from '@/db';
import { practices } from '@/db/schema/practices';
import { organisations } from '@/db/schema/organisations';
import { practiceMembers } from '@/db/schema/practice_members';
import { users } from '@/db/schema/users';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (user?.role === 'admin') {
      const allPractices = await db
        .select({
          id: practices.id,
          name: practices.name,
          slug: practices.slug,
          address: practices.address,
          phone: practices.phone,
          timezone: practices.timezone,
          logoUrl: practices.logoUrl,
          organisationId: practices.organisationId,
          organisationName: organisations.name,
        })
        .from(practices)
        .innerJoin(organisations, eq(practices.organisationId, organisations.id));

      const formatted = allPractices.map((p) => ({
        ...p,
        role: 'system-admin',
      }));
      return NextResponse.json({ data: formatted }, { status: 200 });
    }

    const memberships = await db
      .select({
        id: practices.id,
        name: practices.name,
        slug: practices.slug,
        address: practices.address,
        phone: practices.phone,
        timezone: practices.timezone,
        logoUrl: practices.logoUrl,
        organisationId: practices.organisationId,
        organisationName: organisations.name,
        role: practiceMembers.role,
      })
      .from(practiceMembers)
      .innerJoin(practices, eq(practiceMembers.practiceId, practices.id))
      .innerJoin(organisations, eq(practices.organisationId, organisations.id))
      .where(eq(practiceMembers.userId, session.user.id));

    return NextResponse.json({ data: memberships }, { status: 200 });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
