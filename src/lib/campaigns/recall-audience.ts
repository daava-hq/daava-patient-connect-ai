import type { AudienceFilter } from '@/db/schema/campaigns';

export type RecallChannel = 'sms' | 'email';

export function withRecallAudienceDefaults(
  channel: RecallChannel,
  audienceFilter: AudienceFilter,
): AudienceFilter {
  const normalized = {
    ...audienceFilter,
    patientStatuses: ['Patient'],
    destinationChannel: channel,
  };

  if (channel === 'sms') {
    normalized.consentSms = true;
    delete normalized.consentEmail;
  } else {
    normalized.consentEmail = true;
    delete normalized.consentSms;
  }

  return normalized;
}
