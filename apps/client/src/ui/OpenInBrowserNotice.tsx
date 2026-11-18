import { tr } from '@/i18n';
import { inAppBrowser, openInBrowserLink } from '@/lib/inAppBrowser';
import { useState } from 'react';

/**
 * Shown over everything when the game was opened inside another app (a link tapped in Zalo,
 * Facebook, TikTok…). The browser built into those apps cannot turn sideways or fill the screen, so
 * this sends the player to the phone's real browser, and lets them stay if they insist.
 */
export function OpenInBrowserNotice() {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  if (dismissed || !inAppBrowser()) return null;
  const link = openInBrowserLink();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // Clipboard blocked: the menu route below still works.
      setCopied(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 overflow-y-auto bg-background p-6 text-center text-foreground">
      <h1 className="text-xl font-bold text-primary">{tr('Hãy mở game bằng trình duyệt')}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {tr(
          'Bạn đang mở game bên trong một ứng dụng khác (Zalo, Facebook…). Ở đây game không xoay ngang và không mở toàn màn hình được.',
        )}
      </p>
      {link && (
        <a href={link} className="btn btn-primary cut-corners text-sm">
          {tr('Mở bằng trình duyệt')}
        </a>
      )}
      <button type="button" onClick={() => void copy()} className="btn btn-ghost rounded-md text-sm">
        {copied ? tr('Đã chép link') : tr('Chép link của game')}
      </button>
      <p className="max-w-sm text-xs text-muted-foreground">
        {tr('Hoặc bấm dấu ⋯ ở góc trên màn hình rồi chọn "Mở bằng trình duyệt".')}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="cursor-pointer text-xs text-muted-foreground underline"
      >
        {tr('Vẫn chơi ở đây')}
      </button>
    </div>
  );
}
