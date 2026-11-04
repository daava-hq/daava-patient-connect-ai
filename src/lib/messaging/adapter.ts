/**
 * Abstract messaging provider adapter.
 * All provider implementations must satisfy this interface.
 * Providers return a providerMessageId only — delivery confirmation
 * comes via webhooks or polling, not the send call.
 */
export interface SendMessageOptions {
  to: string; // phone number or email address
  body: string;
  subject?: string; // email only
  html?: string; // email only
  idempotencyKey?: string;
}

export interface SendMessageResult {
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
}

export interface MessagingAdapter {
  channel: 'sms' | 'email';
  configured: boolean;
  send(options: SendMessageOptions): Promise<SendMessageResult>;
}
