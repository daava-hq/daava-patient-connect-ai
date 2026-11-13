import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  getPatientIdsInGroups: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({ db: { select: mocks.select } }));
vi.mock('@/lib/groups/group-repository', () => ({
  ensurePracticeGroups: vi.fn(),
  getGroupAudienceCondition: vi.fn(),
  getPatientIdsInGroups: mocks.getPatientIdsInGroups,
  isPatientInGroups: vi.fn(),
}));

import { practices } from '@/db/schema/practices';
import { birthdayCampaigns, birthdayMessageOccurrences } from '@/db/schema/birthday_engagement';
import { patients } from '@/db/schema/patients';
import { getUpcomingBirthdayMessages, previewBirthdayTemplate } from './birthday-service';

const practiceId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';
const templateId = 'f7d352f9-9049-451e-a11a-7ac47d6d3d9b';
const groupId = '5f5297c3-1d15-4858-9d3e-80691372da91';

function mockUpcomingBirthdayQueries(
  campaign: Record<string, unknown>,
  patient: Record<string, unknown>,
  occurrences: Record<string, unknown>[] = [],
) {
  mocks.select.mockImplementation(() => {
    let rows: Record<string, unknown>[] = [];
    const query = { from: vi.fn(), where: vi.fn() };
    query.from.mockImplementation((table: unknown) => {
      rows = table === birthdayCampaigns
        ? [campaign]
        : table === patients
          ? [patient]
          : table === birthdayMessageOccurrences
            ? occurrences
            : [];
      return query;
    });
    query.where.mockImplementation(() => Promise.resolve(rows));
    return query;
  });
}

describe('previewBirthdayTemplate', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the practice website from the saved practice settings', async () => {
    const practice = {
      id: practiceId,
      name: 'Smile Dental',
      phone: null,
      address: null,
      email: 'hello@smile.example.test',
      website: 'https://smile.example.test',
      timezone: 'UTC',
    };
    const template = {
      id: templateId,
      name: 'Birthday Greeting with Special Offer',
      channel: 'email',
      content: {
        subject: 'Happy birthday, {{patient.firstName}}',
        body: 'Email us at {{practice.email}} or visit {{practice.website}}',
      },
      variables: ['patient.firstName', 'practice.website'],
      status: 'published',
      isSystem: true,
    };

    mocks.select.mockImplementation((selection: Record<string, unknown>) => {
      let source: Record<string, unknown> = {};
      const projectedSource = () =>
        Object.fromEntries(Object.keys(selection).map((key) => [key, source[key]]));
      const query = {
        from: vi.fn(),
        innerJoin: vi.fn(),
        where: vi.fn(),
        limit: vi.fn(),
        orderBy: vi.fn(),
      };
      query.from.mockImplementation((table: unknown) => {
        source = table === practices ? practice : template;
        return query;
      });
      query.innerJoin.mockImplementation(() => query);
      query.where.mockImplementation(() => query);
      query.limit.mockImplementation(() => Promise.resolve([projectedSource()]));
      query.orderBy.mockImplementation(() => Promise.resolve([projectedSource()]));
      return query;
    });

    const result = await previewBirthdayTemplate({
      practiceId,
      templateId,
      firstName: 'Taylor',
      birthdayDate: '2026-11-12',
    });

    expect(result.body).toBe(
      'Email us at hello@smile.example.test or visit https://smile.example.test'
    );
    expect(result.unresolved).toEqual([]);
  });
});

describe('getUpcomingBirthdayMessages', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calculates the next scheduled birthday from enabled campaigns', async () => {
    const campaign = {
      id: 'campaign-id',
      name: 'Birthday email',
      channel: 'email',
      daysBefore: 3,
      localDeliveryTime: '09:00',
      eligibilityRules: {},
    };
    const patient = {
      id: 'patient-id',
      firstName: 'Taylor',
      lastName: 'Example',
      dateOfBirth: '1990-03-10',
    };

    mockUpcomingBirthdayQueries(campaign, patient);

    const result = await getUpcomingBirthdayMessages(
      'practice-id',
      'UTC',
      new Date('2026-03-01T12:00:00.000Z')
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      campaignName: 'Birthday email',
      channel: 'email',
      firstName: 'Taylor',
      lastName: 'Example',
      birthdayDate: '2026-03-10',
      scheduledFor: new Date('2026-03-07T09:00:00.000Z'),
      status: 'scheduled',
    });
  });

  it('ignores legacy group filters and schedules all eligible patients', async () => {
    const campaign = {
      id: 'campaign-id',
      name: 'Birthday email',
      channel: 'email',
      daysBefore: 3,
      localDeliveryTime: '09:00',
      eligibilityRules: { groupIds: [groupId] },
    };
    const patient = {
      id: 'patient-id',
      firstName: 'Taylor',
      lastName: 'Example',
      dateOfBirth: '1990-03-10',
    };
    mockUpcomingBirthdayQueries(campaign, patient);

    const result = await getUpcomingBirthdayMessages(
      practiceId,
      'UTC',
      new Date('2026-03-01T12:00:00.000Z')
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      campaignName: 'Birthday email',
      firstName: 'Taylor',
      birthdayDate: '2026-03-10',
    });
    expect(mocks.getPatientIdsInGroups).not.toHaveBeenCalled();
  });

  it('uses the persisted occurrence status after a birthday email is sent', async () => {
    const campaign = {
      id: 'campaign-id',
      name: 'Birthday email',
      channel: 'email',
      daysBefore: 3,
      localDeliveryTime: '09:00',
      eligibilityRules: {},
    };
    const patient = {
      id: 'patient-id',
      firstName: 'Taylor',
      lastName: 'Example',
      dateOfBirth: '1990-03-10',
    };
    mockUpcomingBirthdayQueries(campaign, patient, [{
      id: 'persisted-occurrence-id',
      campaignId: 'campaign-id',
      patientId: 'patient-id',
      birthdayYear: 2026,
      scheduledFor: new Date('2026-03-07T09:00:00.000Z'),
      status: 'sent',
    }]);

    const result = await getUpcomingBirthdayMessages(
      'practice-id',
      'UTC',
      new Date('2026-03-01T12:00:00.000Z')
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'persisted-occurrence-id',
      status: 'sent',
      scheduledFor: new Date('2026-03-07T09:00:00.000Z'),
    });
  });
});
