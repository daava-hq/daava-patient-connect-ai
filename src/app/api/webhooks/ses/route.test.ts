import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  verifySnsEnvelope: vi.fn(),
  isValidSnsActionUrl: vi.fn(),
  recordSesCampaignEvent: vi.fn(),
}));

vi.mock('@/lib/messaging/ses-sns-verification', () => ({
  verifySnsEnvelope: mocks.verifySnsEnvelope,
  isValidSnsActionUrl: mocks.isValidSnsActionUrl,
}));
vi.mock('@/lib/campaigns/provider-events', () => ({
  recordSesCampaignEvent: mocks.recordSesCampaignEvent,
}));

import { POST } from './route';

const topicArn = 'arn:aws:sns:us-east-1:123456789012:newsletter-events';
const envelope = {
  Type: 'Notification',
  Message: JSON.stringify({
    eventType: 'Delivery',
    mail: { messageId: 'ses-message-id' },
    delivery: { timestamp: '2026-11-09T12:01:00.000Z' },
  }),
  MessageId: 'sns-event-id',
  TopicArn: topicArn,
  Timestamp: '2026-11-09T12:01:00.000Z',
  SignatureVersion: '2',
  Signature: 'signature',
  SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc.pem',
};

describe('/api/webhooks/ses', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('fails closed until the expected SNS topic is configured', async () => {
    vi.stubEnv('NEWSLETTER_SES_SNS_TOPIC_ARN', '');
    const response = await POST(new NextRequest('http://localhost/api/webhooks/ses', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(503);
  });

  it('rejects notifications with an invalid SNS signature', async () => {
    vi.stubEnv('NEWSLETTER_SES_SNS_TOPIC_ARN', topicArn);
    mocks.verifySnsEnvelope.mockResolvedValue(false);
    const response = await POST(new NextRequest('http://localhost/api/webhooks/ses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
    }));
    expect(response.status).toBe(403);
    expect(mocks.recordSesCampaignEvent).not.toHaveBeenCalled();
  });

  it('records delivery events without claiming they were provider-accepted in this request', async () => {
    vi.stubEnv('NEWSLETTER_SES_SNS_TOPIC_ARN', topicArn);
    mocks.verifySnsEnvelope.mockResolvedValue(true);
    mocks.recordSesCampaignEvent.mockResolvedValue('recorded');
    const response = await POST(new NextRequest('http://localhost/api/webhooks/ses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
    }));

    expect(response.status).toBe(200);
    expect(mocks.recordSesCampaignEvent).toHaveBeenCalledWith({
      providerEventId: 'sns-event-id',
      providerMessageId: 'ses-message-id',
      eventType: 'delivery',
      occurredAt: new Date('2026-11-09T12:01:00.000Z'),
      permanentBounce: false,
      unsubscribe: false,
    });
  });
});
