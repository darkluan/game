import { create } from 'zustand';

/** Chrome's event offering to install the page as an app. Not in the standard DOM types. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type InstallState =
  /** The browser can install the game right now: show the button. */
  | 'available'
  /** iPhone or iPad: there is no install prompt, only the Share menu. Show the instructions. */
  | 'ios'
  /** Already running as an installed app. */
  | 'installed'
  /** This browser has not offered to install (or cannot). */
  | 'unavailable';

interface InstallStore {
  state: InstallState;
  install: () => Promise<void>;
}

let deferred: BeforeInstallPromptEvent | null = null;

function initialState(): InstallState {
  const standalone =
    window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'installed';
  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios ? 'ios' : 'unavailable';
}

export const useInstallStore = create<InstallStore>((set) => ({
  state: initialState(),
  install: async () => {
    const event = deferred;
    if (!event) return;
    deferred = null;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // A dismissed prompt cannot be shown again until the browser offers a new one.
    set({ state: outcome === 'accepted' ? 'installed' : 'unavailable' });
  },
}));

/**
 * Starts listening for the browser's install offer. Call once at startup, before rendering: the
 * event fires early and is lost if nobody is listening.
 */
export function watchInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep the browser's own mini-banner from showing; the game offers its own button instead.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    useInstallStore.setState({ state: 'available' });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    useInstallStore.setState({ state: 'installed' });
  });
}
