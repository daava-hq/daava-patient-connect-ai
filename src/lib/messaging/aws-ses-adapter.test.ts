import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SendEmailCommandInput } from '@aws-sdk/client-sesv2';
import { AwsSesEmailAdapter } from './aws-ses-adapter';

describe('AwsSesEmailAdapter', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends plain-text and HTML content with the sender and reply-to', async () => {
    const sendEmail = vi.fn(async (_input: SendEmailCommandInput) => ({
      MessageId: 'ses-message-1',
    }));
    const adapter = new AwsSesEmailAdapter({
      region: 'us-east-1',
      fromEmail: 'reminders@example.test',
      replyTo: 'support@example.test',
      sendEmail,
    });

    const result = await adapter.send({
      to: 'patient@example.test',
      subject: 'Appointment reminder',
      body: 'Your appointment is tomorrow.',
      html: '<p>Your appointment is tomorrow.</p>',
      idempotencyKey: 'reminder-1',
    });

    expect(result).toEqual({ success: true, providerMessageId: 'ses-message-1' });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith({
      FromEmailAddress: 'reminders@example.test',
      Destination: { ToAddresses: ['patient@example.test'] },
      Content: {
        Simple: {
          Subject: { Data: 'Appointment reminder', Charset: 'UTF-8' },
          Body: {
            Text: { Data: 'Your appointment is tomorrow.', Charset: 'UTF-8' },
            Html: { Data: '<p>Your appointment is tomorrow.</p>', Charset: 'UTF-8' },
          },
        },
      },
      ReplyToAddresses: ['support@example.test'],
    });
  });

  it('enables SES contact-list unsubscribe preferences when configured', async () => {
    const sendEmail = vi.fn(async (_input: SendEmailCommandInput) => ({
      MessageId: 'ses-message-with-list',
    }));
    const adapter = new AwsSesEmailAdapter({
      region: 'us-east-1',
      fromEmail: 'newsletter@example.test',
      contactListName: 'PatientConnect',
      unsubscribeTopicName: 'Newsletters',
      sendEmail,
    });

    await adapter.send({
      to: 'patient@example.test',
      subject: 'Practice newsletter',
      body: 'Newsletter content',
    });

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      ListManagementOptions: {
        ContactListName: 'PatientConnect',
        TopicName: 'Newsletters',
      },
    }));
  });

  it('does not send when provider settings are missing or subject is empty', async () => {
    const sendEmail = vi.fn(async (_input: SendEmailCommandInput) => ({ MessageId: 'message-1' }));
    const unconfigured = new AwsSesEmailAdapter({ sendEmail });
    const missingSubject = new AwsSesEmailAdapter({
      region: 'us-east-1',
      fromEmail: 'reminders@example.test',
      sendEmail,
    });

    expect(unconfigured.configured).toBe(false);
    await expect(unconfigured.send({ to: 'patient@example.test', body: 'Reminder' }))
      .resolves.toEqual({
        success: false,
        errorMessage: 'AWS SES email provider is not configured',
      });
    await expect(missingSubject.send({ to: 'patient@example.test', body: 'Reminder' }))
      .resolves.toEqual({ success: false, errorMessage: 'Email subject is required' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not expose provider response details when the request fails', async () => {
    const sendEmail = vi.fn(async (_input: SendEmailCommandInput) => {
      throw new Error('Provider response included private data');
    });
    const adapter = new AwsSesEmailAdapter({
      region: 'us-east-1',
      fromEmail: 'reminders@example.test',
      sendEmail,
    });

    await expect(adapter.send({
      to: 'patient@example.test',
      subject: 'Appointment reminder',
      body: 'Reminder',
    })).resolves.toEqual({
      success: false,
      errorMessage: 'AWS SES email request failed',
    });
  });

  it('fails when SES does not return a message ID', async () => {
    const sendEmail = vi.fn(async (_input: SendEmailCommandInput) => ({}));
    const adapter = new AwsSesEmailAdapter({
      region: 'us-east-1',
      fromEmail: 'reminders@example.test',
      sendEmail,
    });

    await expect(adapter.send({
      to: 'patient@example.test',
      subject: 'Appointment reminder',
      body: 'Reminder',
    })).resolves.toEqual({
      success: false,
      errorMessage: 'AWS SES response did not include a message ID',
    });
  });
});
