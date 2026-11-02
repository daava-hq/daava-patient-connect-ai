import { describe, expect, it } from 'vitest';
import { StubEmailAdapter, StubSmsAdapter } from './stub-adapter';

describe('stub messaging adapters', () => {
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
});
