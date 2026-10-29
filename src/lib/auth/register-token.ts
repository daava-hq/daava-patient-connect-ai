/**
 * Encode/decode organisation-scoped registration tokens.
 *
 * The token is a Base64URL-encoded JSON payload signed with an HMAC-SHA256
 * signature using REGISTER_TOKEN_SECRET.  It never exposes the raw org UUID
 * to the browser; the signature prevents forgery.
 *
 * Format (before Base64URL encoding):
 *   { orgId, exp } + "." + hex(HMAC-SHA256(payload))
 */

import { env } from '@/lib/env';
import { createHmac } from 'crypto';

interface TokenPayload {
  orgId: string;
  /** Unix epoch seconds */
  exp: number;
}

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function b64url(s: string): string {
  return Buffer.from(s).toString('base64url');
}

function fromB64url(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf8');
}

function sign(data: string): string {
  return createHmac('sha256', env.REGISTER_TOKEN_SECRET).update(data).digest('hex');
}

export function encodeOrgToken(orgId: string): string {
  const payload: TokenPayload = {
    orgId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function decodeOrgToken(token: string): { orgId: string } {
  const dot = token.lastIndexOf('.');
  if (dot === -1) throw new Error('Invalid token format');

  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expectedSig = sign(payloadB64);
  if (sig !== expectedSig) throw new Error('Invalid token signature');

  const payload: TokenPayload = JSON.parse(fromB64url(payloadB64));
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');

  return { orgId: payload.orgId };
}
