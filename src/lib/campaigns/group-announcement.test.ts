import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({ db: { transaction: mocks.transaction } }));

import { createAnnouncementDraft } from './campaign-service';

describe('createAnnouncementDraft', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a group announcement campaign independent of newsletter campaigns', async () => {
    const insertedValues: Array<Record<string, unknown>> = [];
    let insertCount = 0;
    const tx = {
      insert: vi.fn(() => ({
        values: (values: Record<string, unknown>) => {
          insertedValues.push(values);
          return {
            returning: async () => {
              insertCount += 1;
              return insertCount === 1
                ? [{ id: 'template-snapshot-id' }]
                : [{ id: 'announcement-id', type: values.type }];
            },
          };
        },
      })),
    };
    mocks.transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx)
    );

    const campaign = await createAnnouncementDraft({
      practiceId: 'c678c32c-2eeb-47ae-95ff-3938bc40e54b',
      name: 'Spring announcement',
      groupId: '93a17272-fc4e-4e84-a229-981477a39114',
      template: {
        name: 'Group update',
        subject: 'News from {{practice.name}}',
        body: 'Hello {{patient.firstName}}',
        content: {
          subject: 'News from {{practice.name}}',
          sections: [{ blocks: [{ type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}' } }] }],
        },
      },
    });

    expect(insertedValues[1]).toEqual(expect.objectContaining({
      type: 'group_announcement',
      audienceFilter: {
        groupIds: ['93a17272-fc4e-4e84-a229-981477a39114'],
        patientStatuses: ['Patient'],
        consentEmail: true,
      },
    }));
    expect(campaign.type).toBe('group_announcement');
  });
});
