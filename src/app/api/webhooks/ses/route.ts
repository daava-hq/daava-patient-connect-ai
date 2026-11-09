import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordSesCampaignEvent, type SesCampaignEventType } from '@/lib/campaigns/provider-events';
import { logError } from '@/lib/logger';
import {
  isValidSnsActionUrl,
  verifySnsEnvelope,
} from '@/lib/messaging/ses-sns-verification';

const envelopeSchema = z.object({
  Type: z.enum(['Notification', 'SubscriptionConfirmation', 'UnsubscribeConfirmation']),
  Message: z.string().max(200000),
  MessageId: z.string().min(1).max(200),
  TopicArn: z.string().min(1).max(500),
  Timestamp: z.string().datetime(),
  SignatureVersion: z.enum(['1', '2']),
  Signature: z.string().min(1).max(2000),
  SigningCertURL: z.string().url().max(2048),
  SubscribeURL: z.string().url().max(2048).optional(),
  Token: z.string().max(1000).optional(),
  Subject: z.string().max(500).optional(),
}).strict();

interface SesEventPayload {
  eventType?: string;
  notificationType?: string;
  mail?: { messageId?: string };
  bounce?: { bounceType?: string; timestamp?: string };
  delivery?: { timestamp?: string };
  complaint?: { timestamp?: string };
  open?: { timestamp?: string };
  click?: { timestamp?: string };
  subscription?: { timestamp?: string; subscriptionStatus?: string; unsubscribeAll?: boolean };
  reject?: { timestamp?: string };
}

const supportedEvents: Record<string, SesCampaignEventType> = {
  delivery: 'delivery',
  bounce: 'bounce',
  complaint: 'complaint',
  open: 'open',
  click: 'click',
  subscription: 'subscription',
  reject: 'reject',
};

export async function POST(req: NextRequest) {
  const expectedTopicArn = process.env.NEWSLETTER_SES_SNS_TOPIC_ARN;
  if (!expectedTopicArn) {
    return NextResponse.json({ error: 'Newsletter event notifications are not configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, 'utf8') > 256000) {
    return NextResponse.json({ error: 'Notification is too large' }, { status: 413 });
  }

  let rawEnvelope: unknown;
  try {
    rawEnvelope = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Notification must be valid JSON' }, { status: 400 });
  }
  const parsed = envelopeSchema.safeParse(rawEnvelope);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid notification envelope' }, { status: 400 });
  }
  const envelope = parsed.data;

  try {
    if (!await verifySnsEnvelope(envelope, expectedTopicArn)) {
      return NextResponse.json({ error: 'Invalid notification signature' }, { status: 403 });
    }

    if (envelope.Type === 'SubscriptionConfirmation') {
      if (!envelope.SubscribeURL || !isValidSnsActionUrl(envelope.SubscribeURL, expectedTopicArn)) {
        return NextResponse.json({ error: 'Invalid subscription confirmation URL' }, { status: 400 });
      }
      const response = await fetch(envelope.SubscribeURL, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return NextResponse.json({ error: 'Unable to confirm event subscription' }, { status: 502 });
      return NextResponse.json({ data: { subscription: 'confirmed' } });
    }
    if (envelope.Type !== 'Notification') {
      return NextResponse.json({ data: { ignored: true } });
    }

    let payload: SesEventPayload;
    try {
      payload = JSON.parse(envelope.Message) as SesEventPayload;
    } catch {
      return NextResponse.json({ error: 'SES event message must be valid JSON' }, { status: 400 });
    }
    const rawEventType = (payload.eventType ?? payload.notificationType ?? '').toLowerCase();
    const eventType = supportedEvents[rawEventType];
    const providerMessageId = payload.mail?.messageId;
    if (!eventType || !providerMessageId) {
      return NextResponse.json({ data: { ignored: true } });
    }
    const subscription = payload.subscription;
    const unsubscribe = eventType === 'subscription' && (
      subscription?.unsubscribeAll === true ||
      subscription?.subscriptionStatus?.toUpperCase() === 'OPT_OUT'
    );
    if (eventType === 'subscription' && !unsubscribe) {
      return NextResponse.json({ data: { ignored: true } });
    }

    const eventDetails = payload[rawEventType as keyof SesEventPayload];
    const eventTimestamp = eventDetails && typeof eventDetails === 'object' && 'timestamp' in eventDetails
      ? eventDetails.timestamp
      : undefined;
    const parsedTimestamp = typeof eventTimestamp === 'string' ? new Date(eventTimestamp) : new Date(envelope.Timestamp);
    const occurredAt = Number.isNaN(parsedTimestamp.getTime()) ? new Date(envelope.Timestamp) : parsedTimestamp;
    const result = await recordSesCampaignEvent({
      providerEventId: envelope.MessageId,
      providerMessageId,
      eventType,
      occurredAt,
      permanentBounce: eventType === 'bounce' && payload.bounce?.bounceType?.toLowerCase() === 'permanent',
      unsubscribe,
    });
    return NextResponse.json({ data: { result } });
  } catch (error) {
    logError('SES newsletter event processing failed', error);
    return NextResponse.json({ error: 'Unable to process SES event' }, { status: 500 });
  }
}
