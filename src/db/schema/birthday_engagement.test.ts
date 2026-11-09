import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { birthdayMessageOccurrences } from './birthday_engagement';

describe('birthday message occurrence schema', () => {
  it('enforces one birthday occurrence per campaign, patient, and birthday year', () => {
    const config = getTableConfig(birthdayMessageOccurrences);
    const constraint = config.uniqueConstraints.find(
      (item) => item.getName() === 'uq_birthday_engagement_occurrence'
    );
    expect(constraint?.columns.map((column) => column.name)).toEqual([
      'campaign_id',
      'patient_id',
      'birthday_year',
    ]);
  });
});
