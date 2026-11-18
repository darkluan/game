import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

/**
 * A player's token is their id plus an HMAC of it: whoever holds the token is that player, and
 * checking one needs no database. Signing in with Google hands out the token of the linked account.
 */

function sign(playerId: string): string {
  return createHmac('sha256', config.tokenSecret).update(playerId).digest('base64url');
}

export function tokenFor(playerId: string): string {
  return `${playerId}.${sign(playerId)}`;
}

export function issueGuest(): { playerId: string; token: string } {
  const playerId = randomUUID();
  return { playerId, token: tokenFor(playerId) };
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
