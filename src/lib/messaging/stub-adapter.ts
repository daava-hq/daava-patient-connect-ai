import 'server-only';
import { MessagingAdapter, SendMessageOptions, SendMessageResult } from './adapter';
import { logInfo, logError } from '@/lib/logger';

/**
 * Stub SMS adapter used until a real provider (e.g., Twilio) is configured.
 * Records every send attempt in the log without making external calls.
 * Never report messages as delivered — stub sends resolve as 'dispatched' only.
 */
export class StubSmsAdapter implements MessagingAdapter {
  readonly channel = 'sms' as const;

  async send(options: SendMessageOptions): Promise<SendMessageResult> {
    // Redact destination from logs per privacy policy
    const redacted = options.to.slice(0, 4) + '****';
    logInfo('StubSmsAdapter.send: would send SMS', { to: redacted, bodyLength: options.body.length });

    return {
      success: true,
      providerMessageId: `stub-sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }
}

/**
 * Stub email adapter used until a real provider (e.g., SendGrid) is configured.
 */
export class StubEmailAdapter implements MessagingAdapter {
  readonly channel = 'email' as const;

  async send(options: SendMessageOptions): Promise<SendMessageResult> {
    const redacted = options.to.replace(/^([^@]{2}).*@/, '$1***@');
    logInfo('StubEmailAdapter.send: would send email', {
      to: redacted,
      subject: options.subject,
      bodyLength: options.body.length,
    });

    return {
      success: true,
      providerMessageId: `stub-email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }
}

/** Returns the configured adapter for a channel. Swap for real providers when credentials are set. */
export function getAdapter(channel: 'sms' | 'email'): MessagingAdapter {
  if (channel === 'sms') return new StubSmsAdapter();
  return new StubEmailAdapter();
}
