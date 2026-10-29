#!/usr/bin/env node
/**
 * Generate a registration link for an organisation.
 *
 * Usage:
 *   node scripts/gen-register-link.mjs <orgId> [baseUrl]
 *
 * Example:
 *   node scripts/gen-register-link.mjs 6491dab3-9535-4fb9-b7ec-7fc7a2c57b74
 *   node scripts/gen-register-link.mjs 6491dab3-... https://app.patientconnect.com
 *
 * Set REGISTER_TOKEN_SECRET in your environment (or .env.local is loaded automatically
 * when running via `dotenv -e .env.local node scripts/gen-register-link.mjs`).
 */

import { createHmac } from 'node:crypto';

const [, , orgId, baseUrl = 'http://localhost:3000'] = process.argv;

if (!orgId) {
  console.error('Usage: node scripts/gen-register-link.mjs <orgId> [baseUrl]');
  process.exit(1);
}

const secret = process.env.REGISTER_TOKEN_SECRET;
if (!secret || secret.length < 16) {
  console.error('REGISTER_TOKEN_SECRET env var is missing or too short (min 16 chars).');
  process.exit(1);
}

const payload = JSON.stringify({
  orgId,
  exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
});

const b64 = Buffer.from(payload).toString('base64url');
const sig = createHmac('sha256', secret).update(b64).digest('hex');
const token = `${b64}.${sig}`;
const url = `${baseUrl}/register?org=${token}`;

console.log('\nRegistration link (valid 7 days):\n');
console.log(url);
console.log();
