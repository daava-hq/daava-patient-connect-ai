import { describe, expect, it } from 'vitest';
import {
  buildSnsSigningString,
  isValidAwsSigningCertificateUrl,
  isValidSnsActionUrl,
  type SnsEnvelope,
} from './ses-sns-verification';

const topicArn = 'arn:aws:sns:us-east-1:123456789012:newsletter-events';

const notification: SnsEnvelope = {
  Type: 'Notification',
  Message: '{"eventType":"Delivery"}',
  MessageId: 'message-id',
  TopicArn: topicArn,
  Timestamp: '2026-11-09T12:00:00.000Z',
  SignatureVersion: '2',
  Signature: 'signature',
  SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc123.pem',
};

describe('SES SNS signature validation', () => {
  it('builds the canonical SNS notification string in AWS field order', () => {
    expect(buildSnsSigningString(notification)).toBe(
      'Message\n{"eventType":"Delivery"}\n' +
      'MessageId\nmessage-id\n' +
      'Timestamp\n2026-11-09T12:00:00.000Z\n' +
      `TopicArn\n${topicArn}\n` +
      'Type\nNotification\n',
    );
  });

  it('accepts only HTTPS SNS certificate URLs from the configured topic region', () => {
    expect(isValidAwsSigningCertificateUrl(notification.SigningCertURL, topicArn)).toBe(true);
    expect(isValidAwsSigningCertificateUrl('https://attacker.example/SimpleNotificationService-abc.pem', topicArn)).toBe(false);
    expect(isValidAwsSigningCertificateUrl('https://sns.us-west-2.amazonaws.com/SimpleNotificationService-abc.pem', topicArn)).toBe(false);
    expect(isValidAwsSigningCertificateUrl('https://sns.us-east-1.amazonaws.com.evil.test/SimpleNotificationService-abc.pem', topicArn)).toBe(false);
  });

  it('restricts subscription confirmation requests to the configured SNS region', () => {
    expect(isValidSnsActionUrl('https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription', topicArn)).toBe(true);
    expect(isValidSnsActionUrl('http://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription', topicArn)).toBe(false);
    expect(isValidSnsActionUrl('https://attacker.example/confirm', topicArn)).toBe(false);
  });
});
