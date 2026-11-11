import { describe, expect, it } from 'vitest';
import sampleDataCatalog from './catalog.json';
import { parseNewsletterDocument } from '@/lib/newsletters/newsletter-content';

describe('sample practice data catalog', () => {
  it('defines unique patient fixtures and birthdays visible in the next-seven-days range', () => {
    const patientNumbers = sampleDataCatalog.patients.map(({ patientNumber }) => patientNumber);
    const appointmentNumbers = sampleDataCatalog.patients.map(({ appointmentNumber }) => appointmentNumber);

    expect(new Set(patientNumbers).size).toBe(patientNumbers.length);
    expect(new Set(appointmentNumbers).size).toBe(appointmentNumbers.length);
    expect(sampleDataCatalog.patients.some(({ birthdayOffsetDays }) => birthdayOffsetDays <= 6)).toBe(true);
  });

  it('keeps every configured group and campaign connected to the sample catalog', () => {
    const patientNumbers = new Set(sampleDataCatalog.patients.map(({ patientNumber }) => patientNumber));
    const groupKeys = new Set(sampleDataCatalog.groups.map(({ key }) => key));

    for (const group of sampleDataCatalog.groups) {
      expect(group.name).toMatch(/^Sample Data:/);
      expect(group.patientNumbers.length).toBeGreaterThan(0);
      expect(group.patientNumbers.every((patientNumber) => patientNumbers.has(patientNumber))).toBe(true);
    }

    for (const newsletter of sampleDataCatalog.newsletters) {
      expect(newsletter.name).toMatch(/^Sample Data:/);
      expect(newsletter.groupKeys.every((key) => groupKeys.has(key))).toBe(true);
      expect(() => parseNewsletterDocument(newsletter.content)).not.toThrow();
    }

    for (const announcement of sampleDataCatalog.announcements) {
      expect(announcement.name).toMatch(/^Sample Data:/);
      expect(groupKeys.has(announcement.groupKey)).toBe(true);
      expect(() => parseNewsletterDocument(announcement.content)).not.toThrow();
    }

    expect(sampleDataCatalog.birthdayCampaign.enabled).toBe(false);
  });
});
