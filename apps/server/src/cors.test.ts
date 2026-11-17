import { describe, expect, it } from 'vitest';
import { corsHeadersFor } from './cors.js';

const allow = (origin: string | null, allowed: string[], production: boolean) =>
  corsHeadersFor(origin, allowed, production)['Access-Control-Allow-Origin'];

describe('corsHeadersFor', () => {
  it('allows only listed origins in production', () => {
    expect(allow('https://game.example', ['https://game.example'], true)).toBe('https://game.example');
    expect(allow('https://evil.example', ['https://game.example'], true)).toBe('null');
  });

  it('denies every origin in production when the list is empty', () => {
    expect(allow('https://game.example', [], true)).toBe('null');
  });

  it('allows any origin in development when the list is empty', () => {
    expect(allow('http://localhost:5173', [], false)).toBe('http://localhost:5173');
  });

  it('still enforces a list given in development', () => {
    expect(allow('http://localhost:9999', ['http://localhost:5173'], false)).toBe('null');
  });

  it('never allows a request without an origin', () => {
    expect(allow(null, [], false)).toBe('null');
  });
});
