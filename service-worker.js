// Planet Slide service worker: makes the app open with no internet connection.
//
// How updates work: every time the app opens with a connection, it asks the server for the
// newest index.html and shows that. With no connection (or a very slow one) it shows the copy
// saved on the phone. Saved scores live in the phone's storage and are never touched here.
//
// You only need to change SHELL_VERSION if you add, rename or replace the icon or manifest files.
const SHELL_VERSION = 'planet-slide-v3';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      // Only tidy up this game's own old copies. Other pages on the same github.io site
      // (your personal page, other apps) share this storage, so their caches are left alone.
      .then(keys => Promise.all(keys.filter(k => k.startsWith('planet-slide-') && k !== SHELL_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function freshPage(request) {
  // Newest page from the server, saved for next time. Falls back to the saved copy if the
  // connection is missing, or after 3 seconds if it is too slow.
  return caches.open(SHELL_VERSION).then(cache => {
    const saved = cache.match('./');
    const network = fetch(request, { cache: 'no-cache' }).then(response => {
      if (response.ok) cache.put('./', response.clone());
      return response;
    });
    const slow = new Promise(resolve => setTimeout(resolve, 3000)).then(() => saved);
    return Promise.race([network.catch(() => saved), slow.then(page => page || network)])
      .then(page => page || saved);
  });
}

function savedFirst(request) {
  // Icons, the manifest and fonts: use the saved copy, otherwise fetch and save it.
  return caches.open(SHELL_VERSION).then(cache =>
    cache.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    }))
  );
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const isPage = request.mode === 'navigate' ||
    (new URL(request.url).origin === self.location.origin && /(\/|index\.html)$/.test(new URL(request.url).pathname));
  event.respondWith(isPage ? freshPage(request) : savedFirst(request));
});
