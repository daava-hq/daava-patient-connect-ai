import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResendEmailAdapter } from './resend-adapter';

describe('ResendEmailAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends plain-text and HTML content with the sender, reply-to, and idempotency key', async () => {
    const fetcher = vi.fn(
      async (_input: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: 'resend-message-1' }), { status: 200 })
    );
    const adapter = new ResendEmailAdapter({
      apiKey: 'secret-key',
      fromEmail: 'reminders@example.test',
      replyTo: 'support@example.test',
      fetcher,
    });

    const result = await adapter.send({
      to: 'patient@example.test',
      subject: 'Appointment reminder',
      body: 'Your appointment is tomorrow.',
      html: '<p>Your appointment is tomorrow.</p>',
      idempotencyKey: 'reminder-1',
    });

    expect(result).toEqual({ success: true, providerMessageId: 'resend-message-1' });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(request?.headers).toMatchObject({
      Authorization: 'Bearer secret-key',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'reminder-1',
    });
    expect(JSON.parse(String(request?.body))).toEqual({
      from: 'reminders@example.test',
      to: ['patient@example.test'],
      subject: 'Appointment reminder',
      text: 'Your appointment is tomorrow.',
      html: '<p>Your appointment is tomorrow.</p>',
      reply_to: 'support@example.test',
    });
  });

  it('does not send when provider settings are missing or subject is empty', async () => {
    const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => new Response());
    const unconfigured = new ResendEmailAdapter({ fetcher });
    const missingSubject = new ResendEmailAdapter({
      apiKey: 'secret-key',
      fromEmail: 'reminders@example.test',
      fetcher,
    });

    expect(unconfigured.configured).toBe(false);
    await expect(unconfigured.send({ to: 'patient@example.test', body: 'Reminder' }))
      .resolves.toMatchObject({ success: false });
    await expect(missingSubject.send({ to: 'patient@example.test', body: 'Reminder' }))
      .resolves.toEqual({ success: false, errorMessage: 'Email subject is required' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not expose provider response details on a rejected request', async () => {
    const fetcher = vi.fn(
      async (_input: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ message: 'Sensitive provider response' }), { status: 422 })
    );
    const adapter = new ResendEmailAdapter({
      apiKey: 'secret-key',
      fromEmail: 'reminders@example.test',
      fetcher,
    });

    await expect(adapter.send({
      to: 'patient@example.test',
      subject: 'Appointment reminder',
      body: 'Reminder',
    })).resolves.toEqual({
      success: false,
      errorMessage: 'Resend rejected the email (HTTP 422)',
    });
  });

  it('returns a generic failure when the network request throws', async () => {
    const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => {
      throw new Error('request included private data');
    });
    const adapter = new ResendEmailAdapter({
      apiKey: 'secret-key',
      fromEmail: 'reminders@example.test',
      fetcher,
    });

    await expect(adapter.send({
      to: 'patient@example.test',
      subject: 'Appointment reminder',
      body: 'Reminder',
    })).resolves.toEqual({
      success: false,
      errorMessage: 'Resend email request failed',
    });
  });
});
