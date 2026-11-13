import { describe, expect, it } from 'vitest';
import { withRecallAudienceDefaults } from './recall-audience';

describe('Recall audience defaults', () => {
  it('forces active patients, SMS consent, and an SMS destination', () => {
    expect(withRecallAudienceDefaults('sms', {
      groupIds: ['group-id'],
      patientStatuses: ['Inactive'],
      consentSms: false,
      consentEmail: true,
    })).toEqual({
      groupIds: ['group-id'],
      patientStatuses: ['Patient'],
      consentSms: true,
      destinationChannel: 'sms',
    });
  });

  it('forces active patients and email consent for email campaigns', () => {
    expect(withRecallAudienceDefaults('email', {
      groupIds: ['group-id'],
      consentSms: true,
      consentEmail: false,
    })).toEqual({
      groupIds: ['group-id'],
      patientStatuses: ['Patient'],
      consentEmail: true,
      destinationChannel: 'email',
    });
  });
});
