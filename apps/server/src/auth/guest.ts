import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

/**
 * Guest accounts need no sign-up and no database: the token is a random player id plus an HMAC of it.
 * Whoever holds the token is that player. Accounts that survive a change of device come in phase 5.
 */

function sign(playerId: string): string {
  return createHmac('sha256', config.tokenSecret).update(playerId).digest('base64url');
}

export function issueGuest(): { playerId: string; token: string } {
  const playerId = randomUUID();
  return { playerId, token: `${playerId}.${sign(playerId)}` };
}

/** The player id a token proves, or null when the token is malformed or forged. */
export function verifyGuest(token: unknown): string | null {
  if (typeof token !== 'string' || token.length > 200) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const playerId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(playerId));
  return given.length === expected.length && timingSafeEqual(given, expected) ? playerId : null;
}
