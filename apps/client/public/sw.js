// Keeps a copy of the game's files on the device, so the second visit starts fast and a match
// against bots works without a connection. Only this site's own files are kept; calls to the game
// server always go to the network.
const CACHE = 'tu-toc-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

async function keep(key, response) {
  if (response.ok && response.type === 'basic') (await caches.open(CACHE)).put(key, response.clone());
  return response;
}

// The page itself: always the newest when online, the saved copy when not. Every route is the same page.
async function page(request) {
  const home = self.registration.scope;
  try {
    return await keep(home, await fetch(request));
  } catch {
    return (await caches.match(home)) ?? Response.error();
  }
}

// Files under assets/ carry a fingerprint of their content in the name, so a saved copy is never stale.
async function fingerprinted(request) {
  return (await caches.match(request)) ?? keep(request, await fetch(request));
}

// Models, portraits and icons: answer from the saved copy at once and refresh it for next time.
async function refreshed(request) {
  const saved = await caches.match(request);
  const fresh = fetch(request).then((response) => keep(request, response));
  if (!saved) return fresh;
  fresh.catch(() => undefined);
  return saved;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.respondWith(page(request));
  else if (url.pathname.includes('/assets/')) event.respondWith(fingerprinted(request));
  else event.respondWith(refreshed(request));
});
