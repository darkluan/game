import { tr } from '@/i18n';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useTouchLayout } from '@/hooks/useTouchLayout';
import { launchedAsApp } from '@/lib/install';

/**
 * The whole game, menus included, is laid out for a phone held sideways. On a touch device held
 * upright this covers every screen and asks for the turn; where the browser allows it, one tap
 * turns the picture and fills the screen.
 */
export function RotateNotice() {
  const touch = useTouchLayout();
  const fullscreen = useFullscreen();
  if (!touch) return null;
  return (
    <div className="fixed inset-0 z-50 hidden flex-col items-center justify-center gap-4 bg-background p-6 text-center text-lg font-semibold text-foreground portrait:flex">
      {tr('Hãy xoay ngang điện thoại để chơi.')}
      {fullscreen.supported && !launchedAsApp && (
        <button type="button" onClick={() => void fullscreen.enter()} className="btn btn-primary cut-corners text-sm">
          {tr('Xoay ngang và toàn màn hình')}
        </button>
      )}
    </div>
  );
}
