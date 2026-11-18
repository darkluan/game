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
        Cài game ra màn hình chính
      </button>
    );
  }
  if (state === 'ios') {
    return (
      <p className="text-xs text-muted-foreground">
        Để ghim game ra màn hình chính: bấm nút <span className="font-semibold text-foreground">Chia sẻ</span> của
        Safari rồi chọn <span className="font-semibold text-foreground">Thêm vào Màn hình chính</span>.
      </p>
    );
  }
  return null;
}
