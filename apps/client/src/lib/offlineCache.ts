/**
 * Starts the service worker (public/sw.js) that keeps the game's files on the device. Only in a
 * deployed build: during development it would serve stale files.
 */
export function startOfflineCache(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    // Resolved from the page's base address, so it is found from any route such as /r/CODE.
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => {
      // Not allowed here (private window, old browser): the game works the same, just without the saved copy.
    });
  });
}
