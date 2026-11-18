import { describe, expect, it } from 'vitest';
import { ChatLimiter, CHAT_TEXT_MAX, cleanChatText, parseLobbyChat, parseMatchChat } from '../src/index.js';

describe('chat messages from the network', () => {
  it('accepts a known phrase and a mark on the map', () => {
    expect(parseMatchChat({ k: 'quick', id: 'help' })).toEqual({ k: 'quick', id: 'help' });
    expect(parseMatchChat({ k: 'ping', type: 'retreat', x: 3, z: -4, extra: 'dropped' })).toEqual({
      k: 'ping',
      type: 'retreat',
      x: 3,
      z: -4,
    });
    expect(parseLobbyChat('hello')).toEqual({ id: 'hello' });
    expect(parseMatchChat({ k: 'text', text: '  đi  rừng\nnhé ' })).toEqual({ k: 'text', text: 'đi rừng nhé' });
    expect(parseLobbyChat({ text: 'chờ mình 1 phút' })).toEqual({ text: 'chờ mình 1 phút' });
  });

  it('refuses anything else', () => {
    for (const raw of [
      null,
      'help',
      { k: 'quick', id: 'free text' },
      { k: 'quick', id: 'hello' },
      { k: 'ping', type: 'attack', x: Number.NaN, z: 0 },
      { k: 'ping', type: 'attack', x: 1e9, z: 0 },
      { k: 'ping', type: 'attack', x: '1', z: 0 },
      { k: 'ping', type: 'dance', x: 1, z: 0 },
      { k: 'ping', x: 1, z: 0 },
      { k: 'text', text: '   ' },
      { k: 'text', text: 42 },
      { k: 'say', text: 'hi' },
    ]) {
      expect(parseMatchChat(raw), JSON.stringify(raw)).toBeNull();
    }
    expect(parseLobbyChat('help')).toBeNull();
    expect(parseLobbyChat({ id: 'hello' })).toBeNull();
    expect(parseLobbyChat({ text: '\u0000\u0007' })).toBeNull();
  });
});

describe('ChatLimiter', () => {
  it('lets a short burst through, then one message a second', () => {
    const limiter = new ChatLimiter();
    expect([0, 10, 20].map((t) => limiter.allow('a', t))).toEqual([true, true, true]);
    // Another player is not affected.
    expect(limiter.allow('b', 20)).toBe(true);
  });

  it('silences a player who keeps pushing, for a while', () => {
    const limiter = new ChatLimiter();
    for (const t of [0, 10, 20]) limiter.allow('a', t);
    expect(limiter.allow('a', 30)).toBe(false);
    // Still silenced although a token has come back.
    expect(limiter.allow('a', 2000)).toBe(false);
    expect(limiter.allow('a', 5100)).toBe(true);
  });
});

describe('typed chat', () => {
  it('is cut to the limit, counting whole characters', () => {
    const long = 'ờ'.repeat(CHAT_TEXT_MAX + 30);
    expect([...cleanChatText(long)]).toHaveLength(CHAT_TEXT_MAX);
  });

  it('stars out blocked words, however they are cased or accented, and nothing else', () => {
    expect(cleanChatText('FUCK this')).toBe('**** this');
    expect(cleanChatText('đéo chơi nữa')).toBe('*** chơi nữa');
    expect(cleanChatText('vcl thật')).toBe('*** thật');
    // Ordinary words that only look like blocked ones without their accents.
    expect(cleanChatText('mua 2 lon nước, đủ rồi')).toBe('mua 2 lon nước, đủ rồi');
    expect(cleanChatText('classic assassin')).toBe('classic assassin');
    expect(cleanChatText('chào các bạn buổi sáng, đeo giáp vào')).toBe('chào các bạn buổi sáng, đeo giáp vào');
  });

  it('leaves a link as plain words: nothing in it is turned into markup', () => {
    expect(cleanChatText('xem <b>http://x.example</b>')).toBe('xem <b>http://x.example</b>');
  });
});
