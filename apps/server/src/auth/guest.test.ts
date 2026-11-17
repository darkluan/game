import { describe, expect, it } from 'vitest';
import { issueGuest, verifyGuest } from './guest.js';

describe('guest tokens', () => {
  it('verifies a token it issued', () => {
    const { playerId, token } = issueGuest();
    expect(verifyGuest(token)).toBe(playerId);
  });

  it('gives every guest a different id', () => {
    expect(issueGuest().playerId).not.toBe(issueGuest().playerId);
  });

  it('rejects a token whose player id was swapped', () => {
    const a = issueGuest();
    const b = issueGuest();
    const forged = `${b.playerId}.${a.token.split('.')[1]}`;
    expect(verifyGuest(forged)).toBeNull();
  });

  it.each([undefined, null, 42, '', 'no-dot', '.sig', 'id.', 'x'.repeat(500)])('rejects malformed input %j', (bad) => {
    expect(verifyGuest(bad)).toBeNull();
  });
});
