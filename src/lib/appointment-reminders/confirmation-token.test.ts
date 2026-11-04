import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { APPOINTMENT_CONFIRMATION_TOKEN_SECRET: 'test-appointment-confirmation-secret-at-least-32-chars' },
}));

import {
  createAppointmentConfirmationToken,
  readAppointmentConfirmationToken,
} from './confirmation-token';

const reminderId = 'c2bc15a1-926b-42f8-b9f7-ecb2a1e8e1ae';

describe('appointment confirmation tokens', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips an appointment reminder capability with an expiry', () => {
    const now = new Date('2026-11-04T12:00:00.000Z');
    const token = createAppointmentConfirmationToken(reminderId, now);

    expect(readAppointmentConfirmationToken(token, now)).toMatchObject({
      purpose: 'appointment-confirmation',
      reminderId,
      exp: Math.floor(now.getTime() / 1000) + 30 * 24 * 60 * 60,
    });
  });

  it('rejects a modified token', () => {
    const token = createAppointmentConfirmationToken(reminderId);
    const modifiedToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

    expect(() => readAppointmentConfirmationToken(modifiedToken)).toThrow('Invalid confirmation link');
  });

  it('rejects expired links', () => {
    const now = new Date('2026-11-04T12:00:00.000Z');
    const token = createAppointmentConfirmationToken(reminderId, now);
    const expiredAt = new Date(now.getTime() + 30 * 24 * 60 * 60_000);

    expect(() => readAppointmentConfirmationToken(token, expiredAt)).toThrow(
      'Confirmation link has expired or is invalid'
    );
  });
});
