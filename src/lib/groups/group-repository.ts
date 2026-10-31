import 'server-only';
import { db } from '@/db';
import { groups, groupMembers, Group, NewGroup } from '@/db/schema/groups';
import { patients } from '@/db/schema/patients';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { NotFoundError } from '@/lib/errors';

export async function getPracticeGroups(practiceId: string) {
  return db
    .select({
      id: groups.id,
      practiceId: groups.practiceId,
      name: groups.name,
      description: groups.description,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM group_members gm WHERE gm.group_id = ${groups.id}
      )`,
      createdAt: groups.createdAt,
      updatedAt: groups.updatedAt,
    })
    .from(groups)
    .where(and(eq(groups.practiceId, practiceId), isNull(groups.deletedAt)))
    .orderBy(groups.name);
}

export async function getGroupById(practiceId: string, groupId: string): Promise<Group | null> {
  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.practiceId, practiceId), eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1);
  return group ?? null;
}

export async function createGroup(data: Pick<NewGroup, 'practiceId' | 'name' | 'description'>): Promise<Group> {
  const [group] = await db.insert(groups).values(data).returning();
  return group;
}

export async function updateGroup(
  practiceId: string,
  groupId: string,
  data: Partial<Pick<NewGroup, 'name' | 'description'>>
): Promise<Group> {
  const [updated] = await db
    .update(groups)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(groups.practiceId, practiceId), eq(groups.id, groupId), isNull(groups.deletedAt)))
    .returning();
  if (!updated) throw new NotFoundError('Group not found');
  return updated;
}

export async function softDeleteGroup(practiceId: string, groupId: string): Promise<void> {
  const [updated] = await db
    .update(groups)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(groups.practiceId, practiceId), eq(groups.id, groupId), isNull(groups.deletedAt)))
    .returning({ id: groups.id });
  if (!updated) throw new NotFoundError('Group not found');
}

export async function getGroupMembers(practiceId: string, groupId: string) {
  // Verify group belongs to practice first
  const group = await getGroupById(practiceId, groupId);
  if (!group) throw new NotFoundError('Group not found');

  return db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      email: patients.email,
      phoneMobile: patients.phoneMobile,
      status: patients.status,
      smsConsent: patients.smsConsent,
      emailConsent: patients.emailConsent,
      addedAt: groupMembers.addedAt,
    })
    .from(groupMembers)
    .innerJoin(patients, eq(groupMembers.patientId, patients.id))
    .where(eq(groupMembers.groupId, groupId));
}

export async function addGroupMember(practiceId: string, groupId: string, patientId: string): Promise<void> {
  const group = await getGroupById(practiceId, groupId);
  if (!group) throw new NotFoundError('Group not found');

  // Verify patient belongs to same practice
  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.practiceId, practiceId), eq(patients.id, patientId)))
    .limit(1);
  if (!patient) throw new NotFoundError('Patient not found');

  await db.insert(groupMembers).values({ groupId, patientId }).onConflictDoNothing();
}

export async function removeGroupMember(practiceId: string, groupId: string, patientId: string): Promise<void> {
  const group = await getGroupById(practiceId, groupId);
  if (!group) throw new NotFoundError('Group not found');

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.patientId, patientId)));
}

export async function getGroupPatientIds(groupId: string): Promise<string[]> {
  const rows = await db
    .select({ patientId: groupMembers.patientId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  return rows.map((r) => r.patientId);
}
