/**
 * Goes to the home screen by loading the page afresh, not by switching screens inside the running
 * app. After an error that is the safe way back: if the game was updated while this tab was open,
 * the running copy may be asking for files or speaking a protocol that no longer exist, and only a
 * fresh load picks up the new code.
 */
export function reloadHome(): void {
  window.location.assign(new URL('.', document.baseURI).href);
}
