/**
 * Apps such as Zalo, Facebook or TikTok open links in a browser of their own, built into the app.
 * Those cannot go full screen or turn the picture sideways, which the game needs on a phone.
 */
const IN_APP =
  /Zalo|FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|TikTok|musical_ly|BytedanceWebview|MicroMessenger|Snapchat/i;

/** True when the page is shown inside another app's built-in browser. */
export function inAppBrowser(userAgent: string = navigator.userAgent): boolean {
  return IN_APP.test(userAgent);
}

/**
 * A link that asks the phone to open this page in its real browser, or null where no such link
 * exists. Android understands an `intent:` link; recent iPhones understand `x-safari-https:`.
 */
export function openInBrowserLink(
  href: string = window.location.href,
  userAgent: string = navigator.userAgent,
): string | null {
  const url = new URL(href);
  if (url.protocol !== 'https:') return null;
  const rest = `${url.host}${url.pathname}${url.search}`;
  if (/Android/i.test(userAgent)) {
    return `intent://${rest}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(href)};end`;
  }
  if (/iPhone|iPad|iPod/i.test(userAgent)) return `x-safari-https://${rest}`;
  return null;
}
