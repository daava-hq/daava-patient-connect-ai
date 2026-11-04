import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

interface AppointmentConfirmationClaims {
  purpose: 'appointment-confirmation';
  reminderId: string;
  exp: number;
}

function sign(payload: string): Buffer {
  return createHmac('sha256', env.APPOINTMENT_CONFIRMATION_TOKEN_SECRET).update(payload).digest();
}

export function createAppointmentConfirmationToken(
  reminderId: string,
  now = new Date()
): string {
  const claims: AppointmentConfirmationClaims = {
    purpose: 'appointment-confirmation',
    reminderId,
    exp: Math.floor(now.getTime() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${sign(payload).toString('base64url')}`;
}

export function readAppointmentConfirmationToken(
  token: string,
  now = new Date()
): AppointmentConfirmationClaims {
  if (token.length > 2048) throw new Error('Invalid confirmation link');

  const separator = token.lastIndexOf('.');
  if (separator <= 0) throw new Error('Invalid confirmation link');

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(signature)) {
    throw new Error('Invalid confirmation link');
  }
  const expected = sign(payload);
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    throw new Error('Invalid confirmation link');
  }
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) {
    throw new Error('Invalid confirmation link');
  }

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid confirmation link');
  }
  if (
    typeof claims !== 'object' ||
    claims === null ||
    !('purpose' in claims) ||
    claims.purpose !== 'appointment-confirmation' ||
    !('reminderId' in claims) ||
    typeof claims.reminderId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claims.reminderId) ||
    !('exp' in claims) ||
    typeof claims.exp !== 'number' ||
    !Number.isSafeInteger(claims.exp) ||
    claims.exp <= Math.floor(now.getTime() / 1000)
  ) {
    throw new Error('Confirmation link has expired or is invalid');
  }

  return claims as AppointmentConfirmationClaims;
}
