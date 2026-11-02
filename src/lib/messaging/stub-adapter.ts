import 'server-only';
import { MessagingAdapter, SendMessageOptions, SendMessageResult } from './adapter';
import { logInfo } from '@/lib/logger';
import { ResendEmailAdapter } from './resend-adapter';

/**
 * Stub SMS adapter used until a real provider (e.g., Twilio) is configured.
 * Records every send attempt in the log without making external calls.
 * Never report messages as delivered — stub sends resolve as 'dispatched' only.
 */
export class StubSmsAdapter implements MessagingAdapter {
  readonly channel = 'sms' as const;
  readonly configured = false;

  async send(options: SendMessageOptions): Promise<SendMessageResult> {
    logInfo('StubSmsAdapter.send: provider is not configured', { bodyLength: options.body.length });

    return {
      success: false,
      errorMessage: 'SMS provider is not configured',
    };
  }
}

/**
 * Stub email adapter used until a real provider (e.g., SendGrid) is configured.
 */
export class StubEmailAdapter implements MessagingAdapter {
  readonly channel = 'email' as const;
  readonly configured = false;

  async send(options: SendMessageOptions): Promise<SendMessageResult> {
    logInfo('StubEmailAdapter.send: provider is not configured', {
      subjectLength: options.subject?.length ?? 0,
      bodyLength: options.body.length,
    });

    return {
      success: false,
      errorMessage: 'Email provider is not configured',
    };
  }
}

/** Returns the configured adapter for a channel. Swap for real providers when credentials are set. */
export function getAdapter(channel: 'sms' | 'email'): MessagingAdapter {
  if (channel === 'sms') return new StubSmsAdapter();
  const resendAdapter = new ResendEmailAdapter();
  return resendAdapter.configured ? resendAdapter : new StubEmailAdapter();
}
