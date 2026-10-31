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
}

export interface SendMessageResult {
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
}

export interface MessagingAdapter {
  channel: 'sms' | 'email';
  send(options: SendMessageOptions): Promise<SendMessageResult>;
}
