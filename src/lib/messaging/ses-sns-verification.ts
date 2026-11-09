import { X509Certificate, verify as verifySignature } from 'node:crypto';

export interface SnsEnvelope {
  Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation';
  Message: string;
  MessageId: string;
  TopicArn: string;
  Timestamp: string;
  SignatureVersion: '1' | '2';
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
  Token?: string;
  Subject?: string;
}

const certificateCache = new Map<string, { certificate: X509Certificate; expiresAt: number }>();

export function buildSnsSigningString(envelope: SnsEnvelope): string {
  const fields = envelope.Type === 'Notification'
    ? ['Message', 'MessageId', ...(envelope.Subject ? ['Subject'] : []), 'Timestamp', 'TopicArn', 'Type']
    : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];
  return fields.map((field) => `${field}\n${envelope[field as keyof SnsEnvelope] ?? ''}\n`).join('');
}

export async function verifySnsEnvelope(envelope: SnsEnvelope, expectedTopicArn: string): Promise<boolean> {
  if (envelope.TopicArn !== expectedTopicArn || !isValidAwsSigningCertificateUrl(envelope.SigningCertURL, expectedTopicArn)) {
    return false;
  }
  if (envelope.Type !== 'Notification' &&
      (!envelope.SubscribeURL || !envelope.Token || !isValidSnsActionUrl(envelope.SubscribeURL, expectedTopicArn))) {
    return false;
  }
  if (!['1', '2'].includes(envelope.SignatureVersion)) return false;

  const certificate = await getCertificate(envelope.SigningCertURL);
  if (!certificate) return false;
  const algorithm = envelope.SignatureVersion === '1' ? 'RSA-SHA1' : 'RSA-SHA256';
  return verifySignature(
    algorithm,
    Buffer.from(buildSnsSigningString(envelope), 'utf8'),
    certificate.publicKey,
    Buffer.from(envelope.Signature, 'base64'),
  );
}

export function isValidAwsSigningCertificateUrl(value: string, topicArn: string): boolean {
  const region = topicArn.match(/^arn:aws:sns:([a-z0-9-]+):\d{12}:[A-Za-z0-9_-]+$/)?.[1];
  if (!region) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === `sns.${region}.amazonaws.com` &&
      !url.port &&
      !url.username &&
      !url.password &&
      /^\/SimpleNotificationService-[A-Za-z0-9]+\.pem$/.test(url.pathname) &&
      !url.search &&
      !url.hash;
  } catch {
    return false;
  }
}

export function isValidSnsActionUrl(value: string, topicArn: string): boolean {
  const region = topicArn.match(/^arn:aws:sns:([a-z0-9-]+):\d{12}:[A-Za-z0-9_-]+$/)?.[1];
  if (!region) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === `sns.${region}.amazonaws.com` &&
      !url.port &&
      !url.username &&
      !url.password;
  } catch {
    return false;
  }
}

async function getCertificate(url: string): Promise<X509Certificate | null> {
  const cached = certificateCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.certificate;

  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) return null;
  const pem = await response.text();
  if (pem.length > 20000 || !pem.includes('-----BEGIN CERTIFICATE-----')) return null;
  const certificate = new X509Certificate(pem);
  certificateCache.set(url, { certificate, expiresAt: Date.now() + 10 * 60 * 1000 });
  return certificate;
}
