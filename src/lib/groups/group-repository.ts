import 'server-only';
import { db } from '@/db';
import {
  groups,
  groupMembers,
  groupMembershipHistory,
  Group,
  GroupCriteria,
  NewGroup,
} from '@/db/schema/groups';
import { patients } from '@/db/schema/patients';
import { appointments } from '@/db/schema/appointments';
import { opendentalRecalls } from '@/db/schema/opendental_recalls';
import { practices } from '@/db/schema/practices';
import { users } from '@/db/schema/users';
import { campaigns } from '@/db/schema/campaigns';
import { campaignDeliveryEvents, campaignRecipients } from '@/db/schema/campaign_recipients';
import { templates, templateCategories } from '@/db/schema/templates';
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  gt,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  notInArray,
  notExists,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { groupCriteriaSchema } from './group-validation';

const PAGE_SIZE_MAX = 100;

function getPatientAgeBounds(minAge?: number, maxAge?: number) {
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().slice(0, 10);
  const latestBirthDate = minAge === undefined ? undefined : new Date(Date.UTC(today.getUTCFullYear() - minAge, today.getUTCMonth(), today.getUTCDate()));
  const earliestBirthDate =
    maxAge === undefined
      ? undefined
      : new Date(Date.UTC(today.getUTCFullYear() - maxAge - 1, today.getUTCMonth(), today.getUTCDate() + 1));

  return {
    latestBirthDate: latestBirthDate ? formatDate(latestBirthDate) : undefined,
    earliestBirthDate: earliestBirthDate ? formatDate(earliestBirthDate) : undefined,
  };
}

function buildPatientConditions(practiceId: string, criteria: GroupCriteria) {
  const conditions = [eq(patients.practiceId, practiceId)];
  const statuses = criteria.patientStatuses === undefined ? ['Patient'] : criteria.patientStatuses;
  if (statuses.length) conditions.push(inArray(patients.status, statuses));

  const { latestBirthDate, earliestBirthDate } = getPatientAgeBounds(criteria.minAge, criteria.maxAge);
  if (latestBirthDate) conditions.push(lte(patients.dateOfBirth, latestBirthDate));
  if (earliestBirthDate) conditions.push(gte(patients.dateOfBirth, earliestBirthDate));

  if (criteria.birthMonths?.length) {
    conditions.push(sql`EXTRACT(MONTH FROM ${patients.dateOfBirth}) IN (${sql.join(criteria.birthMonths.map((month) => sql`${month}`), sql`, `)})`);
  }

  if (criteria.appointmentStatuses?.length) {
    conditions.push(
      exists(
        db
          .select({ id: appointments.id })
          .from(appointments)
          .where(
            and(
              eq(appointments.patientId, patients.id),
              eq(appointments.practiceId, practiceId),
              inArray(appointments.status, criteria.appointmentStatuses)
            )
          )
      )
    );
  }

  if (criteria.lastAppointmentAfter || criteria.lastAppointmentBefore) {
    const lastAppointment = sql`(
      SELECT max(${appointments.scheduledAt})
      FROM ${appointments}
      WHERE ${appointments.patientId} = ${patients.id}
        AND ${appointments.practiceId} = ${practiceId}
        AND ${appointments.scheduledAt} <= NOW()
    )`;
    if (criteria.lastAppointmentAfter) {
      conditions.push(sql`${lastAppointment} >= ${new Date(`${criteria.lastAppointmentAfter}T00:00:00.000Z`)}`);
    }
    if (criteria.lastAppointmentBefore) {
      const exclusiveEndDate = new Date(`${criteria.lastAppointmentBefore}T00:00:00.000Z`);
      exclusiveEndDate.setUTCDate(exclusiveEndDate.getUTCDate() + 1);
      conditions.push(sql`${lastAppointment} < ${exclusiveEndDate}`);
    }
  }

  if (criteria.hasDueRecall) {
    const practiceToday = sql`(
      SELECT (NOW() AT TIME ZONE ${practices.timezone})::date
      FROM ${practices}
      WHERE ${practices.id} = ${practiceId}
    )`;
    conditions.push(
      exists(
        db
          .select({ id: opendentalRecalls.id })
          .from(opendentalRecalls)
          .where(
            and(
              eq(opendentalRecalls.practiceId, practiceId),
              eq(opendentalRecalls.patientId, patients.id),
              eq(opendentalRecalls.isDisabled, false),
              lte(opendentalRecalls.dueDate, practiceToday),
              or(
                isNull(opendentalRecalls.dateScheduled),
                lt(opendentalRecalls.dateScheduled, practiceToday),
              )!,
            ),
          ),
      ),
    );
    conditions.push(
      notExists(
        db
          .select({ id: appointments.id })
          .from(appointments)
          .where(
            and(
              eq(appointments.practiceId, practiceId),
              eq(appointments.patientId, patients.id),
              eq(appointments.status, 'Scheduled'),
              gt(appointments.scheduledAt, sql`NOW()`),
            ),
          ),
      ),
    );
  }

  if (criteria.contactAvailability === 'email' || criteria.contactAvailability === 'both') {
    conditions.push(sql`NULLIF(BTRIM(${patients.email}), '') IS NOT NULL`);
  }
  if (criteria.contactAvailability === 'sms' || criteria.contactAvailability === 'both') {
    conditions.push(sql`NULLIF(BTRIM(${patients.phoneMobile}), '') IS NOT NULL`);
  }
  if (criteria.contactAvailability === 'either') {
    conditions.push(
      or(
        sql`NULLIF(BTRIM(${patients.email}), '') IS NOT NULL`,
        sql`NULLIF(BTRIM(${patients.phoneMobile}), '') IS NOT NULL`
      )!
    );
  }

  return conditions;
}

function normalizeCriteria(criteria: GroupCriteria) {
  const parsed = groupCriteriaSchema.safeParse(criteria);
  if (!parsed.success) throw new ValidationError('Invalid dynamic group criteria');
  return parsed.data;
}

function patientSearchConditions(search?: string) {
  if (!search?.trim()) return [];
  const escaped = search.trim().replace(/[\\%_]/g, '\\$&');
  const pattern = `%${escaped}%`;
  return [
    or(
      ilike(patients.firstName, pattern),
      ilike(patients.lastName, pattern),
      ilike(patients.email, pattern)
    )!,
  ];
}

async function getActiveGroup(practiceId: string, groupId: string) {
  const group = await getGroupById(practiceId, groupId);
  if (!group || group.archivedAt) throw new NotFoundError('Group not found');
  return group;
}

export async function getPracticeGroups(
  practiceId: string,
  options: { search?: string; includeArchived?: boolean; limit?: number; offset?: number } = {}
) {
  const conditions = [eq(groups.practiceId, practiceId), isNull(groups.deletedAt)];
  if (!options.includeArchived) conditions.push(isNull(groups.archivedAt));
  if (options.search?.trim()) {
    const pattern = `%${options.search.trim().replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(or(ilike(groups.name, pattern), ilike(groups.description, pattern))!);
  }
  const limit = Math.min(Math.max(options.limit ?? 25, 1), PAGE_SIZE_MAX);
  const offset = Math.max(options.offset ?? 0, 0);
  const whereClause = and(...conditions);
  const rows = await db
    .select({
      id: groups.id,
      practiceId: groups.practiceId,
      name: groups.name,
      description: groups.description,
      groupType: groups.groupType,
      criteria: groups.criteria,
      archivedAt: groups.archivedAt,
      createdAt: groups.createdAt,
      updatedAt: groups.updatedAt,
    })
    .from(groups)
    .where(whereClause)
    .orderBy(groups.name)
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(groups).where(whereClause);
  const staticGroupIds = rows.filter((group) => group.groupType === 'static').map((group) => group.id);
  const staticMemberCounts = staticGroupIds.length
    ? await db
        .select({ groupId: groupMembers.groupId, total: count() })
        .from(groupMembers)
        .innerJoin(patients, eq(groupMembers.patientId, patients.id))
        .where(
          and(
            inArray(groupMembers.groupId, staticGroupIds),
            eq(patients.practiceId, practiceId)
          )
        )
        .groupBy(groupMembers.groupId)
    : [];
  const staticMemberCountByGroup = new Map(
    staticMemberCounts.map(({ groupId, total }) => [groupId, total])
  );

  const withDynamicCounts = await Promise.all(
    rows.map(async (group) => ({
      ...group,
      memberCount:
        group.groupType === 'dynamic'
          ? await countGroupMembers(practiceId, group.id)
          : staticMemberCountByGroup.get(group.id) ?? 0,
    }))
  );
  return { groups: withDynamicCounts, total, limit, offset };
}

export async function getPracticeGroupOptions(practiceId: string) {
  return db
    .select({
      id: groups.id,
      name: groups.name,
      groupType: groups.groupType,
    })
    .from(groups)
    .where(
      and(
        eq(groups.practiceId, practiceId),
        isNull(groups.deletedAt),
        isNull(groups.archivedAt)
      )
    )
    .orderBy(asc(groups.name));
}

export async function getRecallAudienceGroupOptions(practiceId: string) {
  const activeGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
      groupType: groups.groupType,
      criteria: groups.criteria,
    })
    .from(groups)
    .where(
      and(
        eq(groups.practiceId, practiceId),
        isNull(groups.deletedAt),
        isNull(groups.archivedAt),
        eq(groups.groupType, 'dynamic'),
      ),
    )
    .orderBy(asc(groups.name));

  return activeGroups
    .filter((group) => {
      const parsedCriteria = groupCriteriaSchema.safeParse(group.criteria ?? {});
      return parsedCriteria.success && parsedCriteria.data.hasDueRecall === true;
    })
    .map(({ id, name, groupType }) => ({ id, name, groupType }));
}

export async function getGroupById(practiceId: string, groupId: string): Promise<Group | null> {
  const [group] = await db
    .select()
    .from(groups)
    .where(
      and(
        eq(groups.practiceId, practiceId),
        eq(groups.id, groupId),
        isNull(groups.deletedAt)
      )
    )
    .limit(1);
  return group ?? null;
}

export async function createGroup(
  data: Pick<NewGroup, 'practiceId' | 'name' | 'description' | 'groupType' | 'criteria'>,
  patientIds: string[] = [],
  changedBy?: string
): Promise<Group> {
  const criteria = data.groupType === 'dynamic' ? normalizeCriteria(data.criteria ?? {}) : {};
  const uniquePatientIds = [...new Set(patientIds)];
  if (data.groupType === 'dynamic' && uniquePatientIds.length > 0) {
    throw new ValidationError('Dynamic groups derive their members from criteria');
  }

  return db.transaction(async (tx) => {
    const [group] = await tx
      .insert(groups)
      .values({ ...data, criteria, groupType: data.groupType ?? 'static' })
      .returning();

    if (uniquePatientIds.length) {
      const eligiblePatients = await tx
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.practiceId, data.practiceId), inArray(patients.id, uniquePatientIds)));
      if (eligiblePatients.length !== uniquePatientIds.length) {
        throw new ValidationError('One or more selected patients do not belong to this practice');
      }
      const inserted = await tx
        .insert(groupMembers)
        .values(uniquePatientIds.map((patientId) => ({ groupId: group.id, patientId })))
        .onConflictDoNothing()
        .returning({ patientId: groupMembers.patientId });
      if (inserted.length) {
        await tx.insert(groupMembershipHistory).values(
          inserted.map(({ patientId }) => ({
            practiceId: data.practiceId,
            groupId: group.id,
            patientId,
            action: 'added' as const,
            changedBy: changedBy ?? null,
          }))
        );
      }
    }
    return group;
  });
}

export async function updateGroup(
  practiceId: string,
  groupId: string,
  data: Partial<Pick<NewGroup, 'name' | 'description' | 'criteria'>>
): Promise<Group> {
  const existing = await getGroupById(practiceId, groupId);
  if (!existing || existing.archivedAt) throw new NotFoundError('Group not found');
  if (data.criteria !== undefined) {
    if (existing.groupType !== 'dynamic') {
      throw new ValidationError('Only dynamic groups can update filter criteria');
    }
    normalizeCriteria(data.criteria);
  }

  const [updated] = await db
    .update(groups)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(groups.practiceId, practiceId),
        eq(groups.id, groupId),
        isNull(groups.deletedAt),
        isNull(groups.archivedAt)
      )
    )
    .returning();
  if (!updated) throw new NotFoundError('Group not found');
  return updated;
}

export async function archiveGroup(practiceId: string, groupId: string): Promise<void> {
  const [archived] = await db
    .update(groups)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(groups.practiceId, practiceId),
        eq(groups.id, groupId),
        isNull(groups.deletedAt),
        isNull(groups.archivedAt)
      )
    )
    .returning({ id: groups.id });
  if (!archived) throw new NotFoundError('Group not found');
}

export async function restoreGroup(practiceId: string, groupId: string): Promise<Group> {
  const [restored] = await db
    .update(groups)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(groups.practiceId, practiceId), eq(groups.id, groupId), isNull(groups.deletedAt)))
    .returning();
  if (!restored) throw new NotFoundError('Group not found');
  return restored;
}

export async function duplicateGroup(practiceId: string, groupId: string, changedBy?: string): Promise<Group> {
  const source = await getActiveGroup(practiceId, groupId);
  return db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(groups)
      .values({
        practiceId,
        name: `${source.name} (Copy)`,
        description: source.description,
        groupType: source.groupType,
        criteria: source.criteria,
      })
      .returning();

    if (source.groupType === 'static') {
      const sourceMembers = await tx
        .select({ patientId: groupMembers.patientId })
        .from(groupMembers)
        .innerJoin(patients, eq(groupMembers.patientId, patients.id))
        .where(and(eq(groupMembers.groupId, source.id), eq(patients.practiceId, practiceId)));
      if (sourceMembers.length) {
        await tx
          .insert(groupMembers)
          .values(sourceMembers.map(({ patientId }) => ({ groupId: copy.id, patientId })))
          .onConflictDoNothing();
        await tx.insert(groupMembershipHistory).values(
          sourceMembers.map(({ patientId }) => ({
            practiceId,
            groupId: copy.id,
            patientId,
            action: 'added' as const,
            changedBy: changedBy ?? null,
          }))
        );
      }
    }
    return copy;
  });
}

export async function getGroupMembers(
  practiceId: string,
  groupId: string,
  options: { search?: string; limit?: number; offset?: number } = {}
) {
  const group = await getGroupById(practiceId, groupId);
  if (!group) throw new NotFoundError('Group not found');
  const limit = Math.min(Math.max(options.limit ?? 25, 1), PAGE_SIZE_MAX);
  const offset = Math.max(options.offset ?? 0, 0);
  const conditions = [
    ...patientSearchConditions(options.search),
    ...(group.groupType === 'dynamic'
      ? buildPatientConditions(practiceId, group.criteria ?? {})
      : [eq(patients.practiceId, practiceId)]),
  ];

  if (group.groupType === 'static') {
    conditions.push(
      exists(
        db
          .select({ id: groupMembers.id })
          .from(groupMembers)
          .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.patientId, patients.id)))
      )
    );
  }

  const whereClause = and(...conditions);
  const rows = await db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      email: patients.email,
      status: patients.status,
      addedAt:
        group.groupType === 'static'
          ? sql<Date | null>`(
              SELECT gm.added_at FROM group_members gm
              WHERE gm.group_id = ${groupId} AND gm.patient_id = ${patients.id}
              LIMIT 1
            )`
          : sql<Date | null>`NULL`,
    })
    .from(patients)
    .where(whereClause)
    .orderBy(patients.lastName, patients.firstName)
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(patients).where(whereClause);
  return { members: rows, total, limit, offset, groupType: group.groupType };
}

export async function getAvailableGroupPatients(
  practiceId: string,
  groupId: string,
  options: { search?: string; limit?: number; offset?: number } = {}
) {
  const group = await getActiveGroup(practiceId, groupId);
  if (group.groupType !== 'static') throw new ValidationError('Dynamic group members are managed by their filters');

  const conditions = [eq(patients.practiceId, practiceId), ...patientSearchConditions(options.search)];
  conditions.push(
    notInArray(
      patients.id,
      db
        .select({ patientId: groupMembers.patientId })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, groupId))
    )
  );
  const whereClause = and(...conditions);
  const limit = Math.min(Math.max(options.limit ?? 25, 1), PAGE_SIZE_MAX);
  const offset = Math.max(options.offset ?? 0, 0);
  const rows = await db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      email: patients.email,
      status: patients.status,
    })
    .from(patients)
    .where(whereClause)
    .orderBy(patients.lastName, patients.firstName)
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(patients).where(whereClause);
  return { patients: rows, total, limit, offset };
}

export async function getPracticePatientChoices(
  practiceId: string,
  options: { search?: string; limit?: number; offset?: number } = {}
) {
  const whereClause = and(eq(patients.practiceId, practiceId), ...patientSearchConditions(options.search));
  const limit = Math.min(Math.max(options.limit ?? 25, 1), PAGE_SIZE_MAX);
  const offset = Math.max(options.offset ?? 0, 0);
  const rows = await db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      email: patients.email,
      status: patients.status,
    })
    .from(patients)
    .where(whereClause)
    .orderBy(patients.lastName, patients.firstName)
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(patients).where(whereClause);
  return { patients: rows, total, limit, offset };
}

export async function previewGroupCriteria(practiceId: string, criteria: GroupCriteria) {
  const validatedCriteria = normalizeCriteria(criteria);
  const whereClause = and(...buildPatientConditions(practiceId, validatedCriteria));
  const [{ total }] = await db.select({ total: count() }).from(patients).where(whereClause);
  const preview = await db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      status: patients.status,
    })
    .from(patients)
    .where(whereClause)
    .orderBy(patients.lastName, patients.firstName)
    .limit(20);
  return { total, preview };
}

export async function addGroupMembers(
  practiceId: string,
  groupId: string,
  patientIds: string[],
  changedBy?: string
): Promise<number> {
  const uniquePatientIds = [...new Set(patientIds)];
  if (!uniquePatientIds.length) return 0;
  return db.transaction(async (tx) => {
    const [group] = await tx
      .select()
      .from(groups)
      .where(
        and(
          eq(groups.practiceId, practiceId),
          eq(groups.id, groupId),
          isNull(groups.deletedAt),
          isNull(groups.archivedAt)
        )
      )
      .limit(1);
    if (!group) throw new NotFoundError('Group not found');
    if (group.groupType !== 'static') throw new ValidationError('Dynamic group members are managed by their filters');
    const eligiblePatients = await tx
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.practiceId, practiceId), inArray(patients.id, uniquePatientIds)));
    if (eligiblePatients.length !== uniquePatientIds.length) {
      throw new ValidationError('One or more selected patients do not belong to this practice');
    }
    const inserted = await tx
      .insert(groupMembers)
      .values(uniquePatientIds.map((patientId) => ({ groupId, patientId })))
      .onConflictDoNothing()
      .returning({ patientId: groupMembers.patientId });
    if (inserted.length) {
      await tx.insert(groupMembershipHistory).values(
        inserted.map(({ patientId }) => ({
          practiceId,
          groupId,
          patientId,
          action: 'added' as const,
          changedBy: changedBy ?? null,
        }))
      );
    }
    return inserted.length;
  });
}

export async function removeGroupMembers(
  practiceId: string,
  groupId: string,
  patientIds: string[],
  changedBy?: string
): Promise<number> {
  const uniquePatientIds = [...new Set(patientIds)];
  if (!uniquePatientIds.length) return 0;
  return db.transaction(async (tx) => {
    const [group] = await tx
      .select()
      .from(groups)
      .where(
        and(
          eq(groups.practiceId, practiceId),
          eq(groups.id, groupId),
          isNull(groups.deletedAt),
          isNull(groups.archivedAt)
        )
      )
      .limit(1);
    if (!group) throw new NotFoundError('Group not found');
    if (group.groupType !== 'static') throw new ValidationError('Dynamic group members are managed by their filters');
    const removed = await tx
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.patientId, uniquePatientIds)))
      .returning({ patientId: groupMembers.patientId });
    if (removed.length) {
      await tx.insert(groupMembershipHistory).values(
        removed.map(({ patientId }) => ({
          practiceId,
          groupId,
          patientId,
          action: 'removed' as const,
          changedBy: changedBy ?? null,
        }))
      );
    }
    return removed.length;
  });
}

export async function getGroupMembershipHistory(
  practiceId: string,
  groupId: string,
  options: { limit?: number; offset?: number } = {}
) {
  if (!(await getGroupById(practiceId, groupId))) throw new NotFoundError('Group not found');
  const limit = Math.min(Math.max(options.limit ?? 25, 1), PAGE_SIZE_MAX);
  const offset = Math.max(options.offset ?? 0, 0);
  const whereClause = and(
    eq(groupMembershipHistory.practiceId, practiceId),
    eq(groupMembershipHistory.groupId, groupId)
  );
  const history = await db
    .select({
      id: groupMembershipHistory.id,
      patientId: groupMembershipHistory.patientId,
      action: groupMembershipHistory.action,
      changedAt: groupMembershipHistory.changedAt,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      changedByName: users.name,
    })
    .from(groupMembershipHistory)
    .leftJoin(
      patients,
      and(eq(groupMembershipHistory.patientId, patients.id), eq(patients.practiceId, practiceId))
    )
    .leftJoin(users, eq(groupMembershipHistory.changedBy, users.id))
    .where(whereClause)
    .orderBy(desc(groupMembershipHistory.changedAt))
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(groupMembershipHistory).where(whereClause);
  return { history, total, limit, offset };
}

export async function getGroupCampaignHistory(
  practiceId: string,
  groupId: string,
  options: { limit?: number; offset?: number } = {}
) {
  if (!(await getGroupById(practiceId, groupId))) throw new NotFoundError('Group not found');
  const whereClause = and(
    eq(campaigns.practiceId, practiceId),
    eq(campaigns.type, 'group_announcement'),
    isNull(campaigns.deletedAt),
    sql`EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(((${campaigns.audienceFilter} #>> '{}')::jsonb)->'groupIds') = 'array'
            THEN ((${campaigns.audienceFilter} #>> '{}')::jsonb)->'groupIds'
          ELSE '[]'::jsonb
        END
      ) AS selected_group(id)
      WHERE selected_group.id = ${groupId}
    )`
  );
  const limit = Math.min(Math.max(options.limit ?? 25, 1), PAGE_SIZE_MAX);
  const offset = Math.max(options.offset ?? 0, 0);
  const campaignId = sql.raw('"campaigns"."id"');
  const history = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      type: campaigns.type,
      channel: campaigns.channel,
      status: campaigns.status,
      scheduledAt: campaigns.scheduledAt,
      createdAt: campaigns.createdAt,
      totalRecipients: sql<number>`(
        SELECT count(*)::int FROM ${campaignRecipients} cr WHERE cr.campaign_id = ${campaignId}
      )`,
      sentCount: sql<number>`(
        SELECT count(*)::int FROM ${campaignDeliveryEvents} e
        JOIN ${campaignRecipients} cr ON cr.id = e.recipient_id
        WHERE cr.campaign_id = ${campaignId} AND e.event_type = 'sent'
      )`,
      deliveredCount: sql<number>`(
        SELECT count(*)::int FROM ${campaignRecipients} cr
        WHERE cr.campaign_id = ${campaignId} AND cr.status = 'delivered'
      )`,
      bouncedCount: sql<number>`(
        SELECT count(*)::int FROM ${campaignRecipients} cr
        WHERE cr.campaign_id = ${campaignId} AND cr.status = 'bounced'
      )`,
      failedCount: sql<number>`(
        SELECT count(*)::int FROM ${campaignRecipients} cr
        WHERE cr.campaign_id = ${campaignId} AND cr.status = 'failed'
      )`,
    })
    .from(campaigns)
    .where(whereClause)
    .orderBy(desc(campaigns.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(campaigns).where(whereClause);
  return { campaigns: history, total, limit, offset };
}

export async function ensurePracticeGroups(practiceId: string, groupIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(groupIds)];
  if (!uniqueIds.length) return;
  const found = await db
    .select({ id: groups.id })
    .from(groups)
    .where(
      and(
        eq(groups.practiceId, practiceId),
        inArray(groups.id, uniqueIds),
        isNull(groups.deletedAt),
        isNull(groups.archivedAt)
      )
    );
  if (found.length !== uniqueIds.length) throw new ValidationError('One or more groups are unavailable to this practice');
}

export async function getGroupAudienceCondition(practiceId: string, groupIds: string[]): Promise<SQL> {
  const accessibleGroups = await db
    .select({
      id: groups.id,
      groupType: groups.groupType,
      criteria: groups.criteria,
    })
    .from(groups)
    .where(
      and(
        eq(groups.practiceId, practiceId),
        inArray(groups.id, [...new Set(groupIds)]),
        isNull(groups.deletedAt),
        isNull(groups.archivedAt)
      )
    );
  const groupConditions: SQL[] = accessibleGroups.map((group) => {
    if (group.groupType === 'dynamic') {
      const parsedCriteria = groupCriteriaSchema.safeParse(group.criteria ?? {});
      if (!parsedCriteria.success) throw new ValidationError('Stored dynamic group criteria are invalid');
      return and(...buildPatientConditions(practiceId, parsedCriteria.data))!;
    }

    return exists(
      db
        .select({ id: groupMembers.id })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.patientId, patients.id)))
    );
  });
  return groupConditions.length ? or(...groupConditions)! : sql`false`;
}

export async function isPatientInGroups(
  practiceId: string,
  patientId: string,
  groupIds: string[]
): Promise<boolean> {
  if (!groupIds.length) return true;
  const patientIds = await getPatientIdsInGroups(practiceId, groupIds, [patientId]);
  return patientIds.length > 0;
}

export async function getPatientIdsInGroups(
  practiceId: string,
  groupIds: string[],
  candidatePatientIds?: string[]
): Promise<string[]> {
  if (!groupIds.length || (candidatePatientIds && candidatePatientIds.length === 0)) return [];
  const audienceCondition = await getGroupAudienceCondition(practiceId, groupIds);
  const conditions = [
    eq(patients.practiceId, practiceId),
    audienceCondition,
    ...(candidatePatientIds ? [inArray(patients.id, candidatePatientIds)] : []),
  ];
  const patientsInAudience = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(...conditions));
  return patientsInAudience.map(({ id }) => id);
}

export async function ensureRecallAudienceGroups(practiceId: string, groupIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(groupIds)];
  if (!uniqueIds.length) {
    throw new ValidationError('Recall campaigns require a due-recall dynamic group');
  }

  const selectedGroups = await db
    .select({
      id: groups.id,
      groupType: groups.groupType,
      criteria: groups.criteria,
    })
    .from(groups)
    .where(
      and(
        eq(groups.practiceId, practiceId),
        inArray(groups.id, uniqueIds),
        isNull(groups.deletedAt),
        isNull(groups.archivedAt),
      ),
    );

  if (selectedGroups.length !== uniqueIds.length) {
    throw new ValidationError('One or more selected groups are unavailable to this practice');
  }

  for (const group of selectedGroups) {
    const parsedCriteria = groupCriteriaSchema.safeParse(group.criteria ?? {});
    if (group.groupType !== 'dynamic' || !parsedCriteria.success || parsedCriteria.data.hasDueRecall !== true) {
      throw new ValidationError('Recall campaigns can target only dynamic groups with the due Open Dental recall rule');
    }
  }
}

export async function getGroupAnnouncementTemplate(practiceId: string, templateId: string) {
  const [template] = await db
    .select({
      id: templates.id,
      name: templates.name,
      channel: templates.channel,
      content: templates.content,
    })
    .from(templates)
    .innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
    .where(
      and(
        eq(templates.id, templateId),
        eq(templateCategories.slug, 'groups'),
        eq(templates.templateType, 'newsletter'),
        eq(templates.channel, 'email'),
        eq(templates.status, 'published'),
        isNull(templates.deletedAt),
        or(eq(templates.practiceId, practiceId), eq(templates.isSystem, true))
      )
    )
    .limit(1);
  if (!template) throw new NotFoundError('Published group announcement template not found');
  return template;
}

export async function countGroupMembers(practiceId: string, groupId: string): Promise<number> {
  const group = await getGroupById(practiceId, groupId);
  if (!group) throw new NotFoundError('Group not found');
  if (group.groupType === 'dynamic') {
    const [result] = await db
      .select({ total: count() })
      .from(patients)
      .where(and(...buildPatientConditions(practiceId, group.criteria ?? {})));
    return result.total;
  }
  const [result] = await db
    .select({ total: count() })
    .from(groupMembers)
    .innerJoin(patients, eq(groupMembers.patientId, patients.id))
    .where(and(eq(groupMembers.groupId, groupId), eq(patients.practiceId, practiceId)));
  return result.total;
}

export async function getGroupPatientIds(practiceId: string, groupIds: string[]): Promise<string[]> {
  if (!groupIds.length) return [];
  const accessibleGroups = await db
    .select({
      id: groups.id,
      groupType: groups.groupType,
      criteria: groups.criteria,
    })
    .from(groups)
    .where(
      and(
        eq(groups.practiceId, practiceId),
        inArray(groups.id, [...new Set(groupIds)]),
        isNull(groups.deletedAt),
        isNull(groups.archivedAt)
      )
    );
  const patientIds = new Set<string>();

  for (const group of accessibleGroups) {
    if (group.groupType === 'dynamic') {
      const parsedCriteria = groupCriteriaSchema.safeParse(group.criteria ?? {});
      if (!parsedCriteria.success) throw new ValidationError('Stored dynamic group criteria are invalid');
      const rows = await db
        .select({ id: patients.id })
        .from(patients)
        .where(and(...buildPatientConditions(practiceId, parsedCriteria.data)));
      rows.forEach(({ id }) => patientIds.add(id));
    } else {
      const rows = await db
        .select({ patientId: groupMembers.patientId })
        .from(groupMembers)
        .innerJoin(patients, eq(groupMembers.patientId, patients.id))
        .where(and(eq(groupMembers.groupId, group.id), eq(patients.practiceId, practiceId)));
      rows.forEach(({ patientId }) => patientIds.add(patientId));
    }
  }
  return [...patientIds];
}
