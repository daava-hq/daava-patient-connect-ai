import 'server-only';
import {
  SESv2Client,
  SendEmailCommand,
  type SendEmailCommandInput,
  type SendEmailCommandOutput,
} from '@aws-sdk/client-sesv2';
import type { MessagingAdapter, SendMessageOptions, SendMessageResult } from './adapter';

type SendEmail = (
  input: SendEmailCommandInput
) => Promise<Pick<SendEmailCommandOutput, 'MessageId'>>;

interface AwsSesEmailAdapterOptions {
  region?: string;
  fromEmail?: string;
  replyTo?: string;
  contactListName?: string;
  unsubscribeTopicName?: string;
  sendEmail?: SendEmail;
}

export class AwsSesEmailAdapter implements MessagingAdapter {
  readonly channel = 'email' as const;
  readonly configured: boolean;

  private readonly fromEmail: string;
  private readonly replyTo: string | undefined;
  private readonly contactListName: string | undefined;
  private readonly unsubscribeTopicName: string | undefined;
  private readonly sendEmail: SendEmail;

  constructor(options: AwsSesEmailAdapterOptions = {}) {
    const region = options.region ?? process.env.AWS_REGION ?? '';
    this.fromEmail = options.fromEmail ?? process.env.AWS_SES_FROM_EMAIL ?? '';
    this.replyTo = options.replyTo ?? process.env.AWS_SES_REPLY_TO;
    this.contactListName = options.contactListName ?? process.env.AWS_SES_CONTACT_LIST_NAME;
    this.unsubscribeTopicName = options.unsubscribeTopicName ?? process.env.AWS_SES_NEWSLETTER_TOPIC_NAME;
    this.configured = Boolean(region && this.fromEmail);

    if (options.sendEmail) {
      this.sendEmail = options.sendEmail;
    } else {
      let client: SESv2Client | undefined;
      this.sendEmail = (input) => {
        client ??= new SESv2Client({ region });
        return client.send(new SendEmailCommand(input));
      };
    }
  }

  async send(options: SendMessageOptions): Promise<SendMessageResult> {
    if (!this.configured) {
      return { success: false, errorMessage: 'AWS SES email provider is not configured' };
    }
    if (!options.subject?.trim()) {
      return { success: false, errorMessage: 'Email subject is required' };
    }

    const input: SendEmailCommandInput = {
      FromEmailAddress: this.fromEmail,
      Destination: { ToAddresses: [options.to] },
      Content: {
        Simple: {
          Subject: { Data: options.subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: options.body, Charset: 'UTF-8' },
            ...(options.html ? { Html: { Data: options.html, Charset: 'UTF-8' } } : {}),
          },
        },
      },
      ...(this.contactListName ? {
        ListManagementOptions: {
          ContactListName: this.contactListName,
          ...(this.unsubscribeTopicName ? { TopicName: this.unsubscribeTopicName } : {}),
        },
      } : {}),
      ...(this.replyTo ? { ReplyToAddresses: [this.replyTo] } : {}),
    };

    let result: Pick<SendEmailCommandOutput, 'MessageId'>;
    try {
      result = await this.sendEmail(input);
    } catch {
      return { success: false, errorMessage: 'AWS SES email request failed' };
    }

    if (typeof result.MessageId !== 'string' || result.MessageId.length === 0) {
      return { success: false, errorMessage: 'AWS SES response did not include a message ID' };
    }

    return { success: true, providerMessageId: result.MessageId };
  }
}
