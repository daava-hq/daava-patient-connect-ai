import { describe, it, expect, vi } from 'vitest';
import { canTransition } from '@/lib/campaigns/campaign-service';
import { filterByConsent } from '@/lib/campaigns/audience-service';
import { interpolateTemplate, extractTemplateVariables } from '@/lib/campaigns/template-repository';

describe('Engagement Engine Unit Tests', () => {
  describe('Campaign State Machine', () => {
    it('allows valid state transitions', () => {
      expect(canTransition('draft', 'scheduled')).toBe(true);
      expect(canTransition('draft', 'processing')).toBe(true);
      expect(canTransition('scheduled', 'processing')).toBe(true);
      expect(canTransition('scheduled', 'cancelled')).toBe(true);
      expect(canTransition('processing', 'completed')).toBe(true);
      expect(canTransition('processing', 'partially_failed')).toBe(true);
      expect(canTransition('processing', 'failed')).toBe(true);
      expect(canTransition('failed', 'scheduled')).toBe(true);
    });

    it('rejects invalid state transitions', () => {
      expect(canTransition('completed', 'draft')).toBe(false);
      expect(canTransition('completed', 'processing')).toBe(false);
      expect(canTransition('cancelled', 'scheduled')).toBe(false);
      expect(canTransition('draft', 'completed')).toBe(false);
    });
  });

  describe('Consent and Opt-out Filtering', () => {
    it('separates consenting and opted-out patients for SMS', () => {
      const patients = [
        { id: '1', firstName: 'Alice', lastName: 'Smith', email: 'a@ex.com', phoneMobile: '555-0101', phoneHome: null, smsConsent: true, emailConsent: false, status: 'Patient', dateOfBirth: '1990-01-01' },
        { id: '2', firstName: 'Bob', lastName: 'Jones', email: 'b@ex.com', phoneMobile: '555-0102', phoneHome: null, smsConsent: false, emailConsent: true, status: 'Patient', dateOfBirth: '1985-05-12' },
      ];

      const { consenting, opted_out } = filterByConsent(patients, 'sms');
      expect(consenting).toHaveLength(1);
      expect(consenting[0].id).toBe('1');
      expect(opted_out).toHaveLength(1);
      expect(opted_out[0].id).toBe('2');
    });

    it('separates consenting and opted-out patients for Email', () => {
      const patients = [
        { id: '1', firstName: 'Alice', lastName: 'Smith', email: 'a@ex.com', phoneMobile: '555-0101', phoneHome: null, smsConsent: true, emailConsent: false, status: 'Patient', dateOfBirth: '1990-01-01' },
        { id: '2', firstName: 'Bob', lastName: 'Jones', email: 'b@ex.com', phoneMobile: '555-0102', phoneHome: null, smsConsent: false, emailConsent: true, status: 'Patient', dateOfBirth: '1985-05-12' },
      ];

      const { consenting, opted_out } = filterByConsent(patients, 'email');
      expect(consenting).toHaveLength(1);
      expect(consenting[0].id).toBe('2');
      expect(opted_out).toHaveLength(1);
      expect(opted_out[0].id).toBe('1');
    });
  });

  describe('Template Interpolation and Variable Extraction', () => {
    it('extracts unique template variables correctly', () => {
      const body = 'Hello {{first_name}}, your appointment at {{practice_name}} is confirmed.';
      const vars = extractTemplateVariables(body);
      expect(vars).toEqual(['first_name', 'practice_name']);
    });

    it('interpolates template variables correctly', () => {
      const body = 'Hello {{first_name}}, welcome to {{practice_name}}!';
      const { rendered, missingVariables } = interpolateTemplate(body, {
        first_name: 'Jane',
        practice_name: 'Smile Dental',
      });
      expect(rendered).toBe('Hello Jane, welcome to Smile Dental!');
      expect(missingVariables).toHaveLength(0);
    });

    it('reports missing variables during interpolation', () => {
      const body = 'Hello {{first_name}}, your code is {{code}}.';
      const { rendered, missingVariables } = interpolateTemplate(body, {
        first_name: 'John',
      });
      expect(rendered).toBe('Hello John, your code is {{code}}.');
      expect(missingVariables).toEqual(['code']);
    });
  });
});
