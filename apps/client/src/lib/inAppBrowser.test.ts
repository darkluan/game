import { describe, expect, it } from 'vitest';
import { inAppBrowser, openInBrowserLink } from './inAppBrowser';

const ZALO_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 Zalo android/12100735';
const FACEBOOK_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E236 [FBAN/FBIOS;FBAV/450.0]';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

describe('inAppBrowser', () => {
  it('recognises the browser built into Zalo and Facebook, and leaves real browsers alone', () => {
    expect(inAppBrowser(ZALO_ANDROID)).toBe(true);
    expect(inAppBrowser(FACEBOOK_IPHONE)).toBe(true);
    expect(inAppBrowser(CHROME_ANDROID)).toBe(false);
    expect(inAppBrowser(SAFARI_IPHONE)).toBe(false);
  });
});

describe('openInBrowserLink', () => {
  const page = 'https://game.example/r/ABCDE?x=1';

  it('builds an intent link on Android that falls back to the page itself', () => {
    expect(openInBrowserLink(page, ZALO_ANDROID)).toBe(
      `intent://game.example/r/ABCDE?x=1#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(page)};end`,
    );
  });

  it('builds a Safari link on an iPhone', () => {
    expect(openInBrowserLink(page, FACEBOOK_IPHONE)).toBe('x-safari-https://game.example/r/ABCDE?x=1');
  });

  it('has no link to offer on a desktop or for a page that is not https', () => {
    expect(openInBrowserLink(page, 'Mozilla/5.0 (Macintosh)')).toBeNull();
    expect(openInBrowserLink('http://localhost:5199/', ZALO_ANDROID)).toBeNull();
  });
});
