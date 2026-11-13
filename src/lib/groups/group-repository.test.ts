import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
    update: vi.fn(),
  },
}));

import { db } from '@/db';
import {
  getGroupPatientIds,
  getPatientIdsInGroups,
  getPracticeGroupOptions,
  getRecallAudienceGroupOptions,
  ensureRecallAudienceGroups,
  ensurePracticeGroups,
  isPatientInGroups,
  addGroupMembers,
  archiveGroup,
} from './group-repository';

const practiceId = '93a17272-fc4e-4e84-a229-981477a39114';
const groupId = '4b8cb22d-468e-4590-9c88-90ad1153306c';
const patientId = '383167da-f647-4808-917c-b2adf60bd9ca';

function query(rows: unknown[]) {
  const builder = {
    from: vi.fn(),
    where: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.where.mockResolvedValue(rows);
  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('group repository', () => {
  it('returns active group options scoped to the requested practice', async () => {
    const options = [{ id: groupId, name: 'Recall patients', groupType: 'static' }];
    const builder = {
      from: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn().mockResolvedValue(options),
    };
    builder.from.mockReturnValue(builder);
    builder.where.mockReturnValue(builder);
    vi.mocked(db.select).mockReturnValue(builder as never);

    await expect(getPracticeGroupOptions(practiceId)).resolves.toEqual(options);
    expect(builder.where).toHaveBeenCalledTimes(1);
  });

  it('returns only active dynamic groups configured for due Open Dental recalls', async () => {
    const rows = [
      { id: groupId, name: 'Due recalls', groupType: 'dynamic', criteria: { hasDueRecall: true } },
      { id: '729171c1-c444-4ed7-a1ba-f2b0c1a4116a', name: 'All patients', groupType: 'dynamic', criteria: {} },
      { id: 'd4e2ebcc-7db4-4886-a9e1-9af0d29a9091', name: 'Static group', groupType: 'static', criteria: {} },
    ];
    const builder = {
      from: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn().mockResolvedValue(rows),
    };
    builder.from.mockReturnValue(builder);
    builder.where.mockReturnValue(builder);
    vi.mocked(db.select).mockReturnValue(builder as never);

    await expect(getRecallAudienceGroupOptions(practiceId)).resolves.toEqual([
      { id: groupId, name: 'Due recalls', groupType: 'dynamic' },
    ]);
  });

  it('rejects selected groups that are not active in the requested practice', async () => {
    vi.mocked(db.select).mockReturnValue(query([]) as never);

    await expect(ensurePracticeGroups(practiceId, [groupId])).rejects.toThrow(
      'One or more groups are unavailable to this practice'
    );
  });

  it('rejects Recall audiences that do not use the approved due-recall dynamic rule', async () => {
    vi.mocked(db.select).mockReturnValue(query([{
      id: groupId,
      groupType: 'dynamic',
      criteria: { patientStatuses: ['Patient'] },
    }]) as never);

    await expect(ensureRecallAudienceGroups(practiceId, [groupId])).rejects.toThrow(
      'Recall campaigns can target only dynamic groups with the due Open Dental recall rule',
    );
  });

  it('resolves dynamic membership from validated rules, without storing patient copies', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(query([{ id: groupId, groupType: 'dynamic', criteria: { patientStatuses: ['Patient'] } }]) as never)
      .mockReturnValueOnce(query([{ id: patientId }, { id: '729171c1-c444-4ed7-a1ba-f2b0c1a4116a' }]) as never);

    const members = await getGroupPatientIds(practiceId, [groupId]);

    expect(members).toEqual([patientId, '729171c1-c444-4ed7-a1ba-f2b0c1a4116a']);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('treats a patient as outside the audience when no active selected group resolves', async () => {
    const groupQuery = query([]);
    const patientQuery = {
      from: vi.fn(),
      where: vi.fn(),
    };
    patientQuery.from.mockReturnValue(patientQuery);
    patientQuery.where.mockResolvedValue([]);
    vi.mocked(db.select)
      .mockReturnValueOnce(groupQuery as never)
      .mockReturnValueOnce(patientQuery as never);

    await expect(isPatientInGroups(practiceId, patientId, [groupId])).resolves.toBe(false);
    expect(patientQuery.where).toHaveBeenCalledTimes(1);
  });

  it('resolves group audiences only among the candidate patients in the same practice', async () => {
    const candidateIds = [patientId, '729171c1-c444-4ed7-a1ba-f2b0c1a4116a'];
    vi.mocked(db.select)
      .mockReturnValueOnce(query([
        { id: groupId, groupType: 'dynamic', criteria: { patientStatuses: ['Patient'] } },
      ]) as never)
      .mockReturnValueOnce(query([{ id: patientId }]) as never);

    await expect(getPatientIdsInGroups(practiceId, [groupId], candidateIds)).resolves.toEqual([patientId]);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('adds static members idempotently and records only newly inserted membership events', async () => {
    const groupQuery = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([{ id: groupId, practiceId, groupType: 'static', archivedAt: null }]),
    };
    groupQuery.from.mockReturnValue(groupQuery);
    groupQuery.where.mockReturnValue(groupQuery);
    const patientQuery = query([{ id: patientId }]);
    const insertBuilder = {
      values: vi.fn(),
      onConflictDoNothing: vi.fn(),
      returning: vi.fn().mockResolvedValue([{ patientId }]),
    };
    insertBuilder.values.mockReturnValue(insertBuilder);
    insertBuilder.onConflictDoNothing.mockReturnValue(insertBuilder);
    const historyInsert = { values: vi.fn().mockResolvedValue(undefined) };

    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(groupQuery)
        .mockReturnValueOnce(patientQuery),
      insert: vi.fn()
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(historyInsert),
    };
    vi.mocked(db.transaction).mockImplementation(async (callback) => callback(tx as never) as never);

    const added = await addGroupMembers(practiceId, groupId, [patientId, patientId], '1822f16f-5e33-4a81-8c37-3a4e52569728');

    expect(added).toBe(1);
    expect(insertBuilder.values).toHaveBeenCalledWith([{ groupId, patientId }]);
    expect(historyInsert.values).toHaveBeenCalledWith([
      expect.objectContaining({ practiceId, groupId, patientId, action: 'added' }),
    ]);
  });

  it('archives a group without deleting its membership or history', async () => {
    const updateBuilder = {
      set: vi.fn(),
      where: vi.fn(),
      returning: vi.fn().mockResolvedValue([{ id: groupId }]),
    };
    updateBuilder.set.mockReturnValue(updateBuilder);
    updateBuilder.where.mockReturnValue(updateBuilder);
    vi.mocked(db.update).mockReturnValue(updateBuilder as never);

    await archiveGroup(practiceId, groupId);

    expect(updateBuilder.set).toHaveBeenCalledWith(
      expect.objectContaining({ archivedAt: expect.any(Date), updatedAt: expect.any(Date) })
    );
    expect(updateBuilder.set).not.toHaveBeenCalledWith(expect.objectContaining({ deletedAt: expect.any(Date) }));
  });
});
