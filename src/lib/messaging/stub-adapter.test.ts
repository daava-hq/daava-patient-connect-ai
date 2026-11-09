import { afterEach, describe, expect, it, vi } from 'vitest';
import { AwsSesEmailAdapter } from './aws-ses-adapter';
import { getAdapter, StubEmailAdapter, StubSmsAdapter } from './stub-adapter';

describe('stub messaging adapters', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('never reports an unconfigured provider send as accepted', async () => {
    const email = await new StubEmailAdapter().send({
      to: 'patient@example.test',
      subject: 'Appointment reminder',
      body: 'Reminder',
    });
    const sms = await new StubSmsAdapter().send({
      to: '+15555550100',
      body: 'Reminder',
    });

    expect(email.success).toBe(false);
    expect(email.providerMessageId).toBeUndefined();
    expect(sms.success).toBe(false);
    expect(sms.providerMessageId).toBeUndefined();
  });

  it('uses AWS SES when its region and sender are configured', () => {
    vi.stubEnv('AWS_REGION', 'us-east-1');
    vi.stubEnv('AWS_SES_FROM_EMAIL', 'reminders@example.test');

    expect(getAdapter('email')).toBeInstanceOf(AwsSesEmailAdapter);
  });

  it('uses the stub email adapter when AWS SES is not configured', () => {
    vi.stubEnv('AWS_REGION', '');
    vi.stubEnv('AWS_SES_FROM_EMAIL', '');

    expect(getAdapter('email')).toBeInstanceOf(StubEmailAdapter);
  });
});
