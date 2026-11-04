import 'server-only';
import type { MessagingAdapter, SendMessageOptions, SendMessageResult } from './adapter';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

interface ResendEmailAdapterOptions {
  apiKey?: string;
  fromEmail?: string;
  replyTo?: string;
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
}

interface ResendEmailResponse {
  id?: unknown;
}

export class ResendEmailAdapter implements MessagingAdapter {
  readonly channel = 'email' as const;
  readonly configured: boolean;

  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly replyTo: string | undefined;
  private readonly fetcher: (input: string, init?: RequestInit) => Promise<Response>;

  constructor(options: ResendEmailAdapterOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.RESEND_API_KEY ?? '';
    this.fromEmail = options.fromEmail ?? process.env.RESEND_FROM_EMAIL ?? '';
    this.replyTo = options.replyTo ?? process.env.RESEND_REPLY_TO;
    this.fetcher = options.fetcher ?? fetch;
    this.configured = Boolean(this.apiKey && this.fromEmail);
  }

  async send(options: SendMessageOptions): Promise<SendMessageResult> {
    if (!this.configured) {
      return { success: false, errorMessage: 'Resend email provider is not configured' };
    }
    if (!options.subject?.trim()) {
      return { success: false, errorMessage: 'Email subject is required' };
    }

    const body: Record<string, string | string[]> = {
      from: this.fromEmail,
      to: [options.to],
      subject: options.subject,
      text: options.body,
    };
    if (options.html) body.html = options.html;
    if (this.replyTo) body.reply_to = this.replyTo;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

    let response: Response;
    try {
      response = await this.fetcher(RESEND_EMAILS_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return { success: false, errorMessage: 'Resend email request failed' };
    }

    if (!response.ok) {
      return {
        success: false,
        errorMessage: `Resend rejected the email (HTTP ${response.status})`,
      };
    }

    let result: ResendEmailResponse;
    try {
      result = await response.json() as ResendEmailResponse;
    } catch {
      return { success: false, errorMessage: 'Resend returned an invalid response' };
    }

    if (typeof result.id !== 'string' || result.id.length === 0) {
      return { success: false, errorMessage: 'Resend response did not include a message ID' };
    }

    return { success: true, providerMessageId: result.id };
  }
}
