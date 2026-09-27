/* Tamlik display service worker.
   Shell: network first, cache fallback, so the screen keeps playing when the Wi-Fi drops.
   Film parts (/v/) are cached by the page itself (Cache Storage 'tamlik-film'); names change with the film. */
const SHELL = 'tamlik-shell-v3', FILM = 'tamlik-film';
const ASSETS = ['./', './film.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== FILM).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.txt')) return;              // always from the network
  if (url.pathname.includes('/v/')) return;                        // the page keeps the film parts in Cache Storage itself
  if (url.pathname.includes('/live/')) return;                      // the real-time version fetches its own libraries
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./')))
  );
});
