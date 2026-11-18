import { tr } from '@/i18n';
import { useInstallStore } from '@/lib/install';

/**
 * Offers to install the game as an app, so it has its own icon and nobody has to remember the
 * address. Shows a button where the browser supports it, and instructions on iPhone and iPad.
 */
export function InstallButton() {
  const state = useInstallStore((s) => s.state);
  const install = useInstallStore((s) => s.install);
  if (state === 'available') {
    return (
      <button type="button" onClick={() => void install()} className="btn btn-ghost cut-corners text-sm">
        {tr('Cài game ra màn hình chính')}
      </button>
    );
  }
  if (state === 'ios') {
    return (
      <p className="text-xs text-muted-foreground">
        {tr('Để ghim game ra màn hình chính: bấm nút Chia sẻ của Safari rồi chọn "Thêm vào Màn hình chính".')}
      </p>
    );
  }
  return null;
}
