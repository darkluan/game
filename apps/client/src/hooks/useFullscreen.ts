import { useSyncExternalStore } from 'react';

/** Locking the screen's direction is not in the standard DOM types; only some phones allow it. */
type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };

function subscribe(onChange: () => void): () => void {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
}

/**
 * Fills the whole screen, hiding the browser's address bar, and turns the picture sideways where
 * the phone allows it. Must be called from a tap. iPhones allow neither; there the game has to be
 * added to the home screen instead.
 */
async function enter(): Promise<void> {
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    // Only works while full screen, and not on every device; the "turn your phone" notice covers the rest.
    await (screen.orientation as LockableOrientation).lock?.('landscape');
  } catch {
    // Refused by the browser: nothing to undo, the game stays as it was.
  }
}

function leave(): void {
  void document.exitFullscreen().catch(() => undefined);
}

/** Whether the page fills the screen, whether this browser can do that at all, and how to switch. */
export function useFullscreen(): {
  supported: boolean;
  active: boolean;
  enter: () => Promise<void>;
  leave: () => void;
} {
  const active = useSyncExternalStore(subscribe, () => document.fullscreenElement !== null);
  return { supported: document.fullscreenEnabled === true, active, enter, leave };
}
