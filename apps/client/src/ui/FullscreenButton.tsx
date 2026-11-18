import { tr } from '@/i18n';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useTouchLayout } from '@/hooks/useTouchLayout';
import { launchedAsApp } from '@/lib/install';

/**
 * On a phone in a browser: hides the address bar and turns the game sideways. Shown only while there
 * is something to gain, so not on a desktop, not in the installed app and not once the screen is full.
 */
export function FullscreenButton({ className = '' }: { className?: string }) {
  const touch = useTouchLayout();
  const fullscreen = useFullscreen();
  if (!touch || !fullscreen.supported || fullscreen.active || launchedAsApp) return null;
  return (
    <button
      type="button"
      onClick={() => void fullscreen.enter()}
      className={`glass-panel cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold text-primary ${className}`}
    >
      {tr('Toàn màn hình')}
    </button>
  );
}
