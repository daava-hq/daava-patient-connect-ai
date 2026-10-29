import { db } from '@/db';
import { practiceMembers } from '@/db/schema/practice_members';
import { users } from '@/db/schema/users';
import { eq, and } from 'drizzle-orm';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';

export interface PracticeMembership {
  id: string;
  practiceId: string;
  userId: string;
  role: string;
}

export async function requirePracticeMembership(userId: string, practiceId: string): Promise<PracticeMembership> {
  if (!userId) {
    throw new UnauthorizedError('Authentication required');
  }

  // 1. Check direct practice membership first
  const [membership] = await db
    .select()
    .from(practiceMembers)
    .where(and(eq(practiceMembers.userId, userId), eq(practiceMembers.practiceId, practiceId)))
    .limit(1);

  if (membership) {
    return {
      id: membership.id,
      practiceId: membership.practiceId,
      userId: membership.userId,
      role: membership.role,
    };
  }

  // 2. If not directly a member, check if user is a global system admin (users.role === 'admin')
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.role === 'admin') {
    return {
      id: 'global-admin-membership',
      practiceId,
      userId,
      role: 'admin',
    };
  }

  throw new ForbiddenError('Access denied to this practice');
}

export async function requirePracticeAdmin(userId: string, practiceId: string): Promise<PracticeMembership> {
  const membership = await requirePracticeMembership(userId, practiceId);
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    throw new ForbiddenError('Admin or Owner privileges required for this practice operation');
  }
  return membership;
}

export async function getUserPractices(userId: string) {
  const memberships = await db.query.practiceMembers.findMany({
    where: eq(practiceMembers.userId, userId),
  });
  return memberships;
}
