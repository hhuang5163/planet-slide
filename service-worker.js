// Planet Slide service worker: lets the game open with no internet connection.
//
// Safety rules this file follows, so it cannot affect anything else on the same site:
//  - It only answers requests for files inside its own folder, plus the game's two Google Fonts
//    files (so the fonts work offline). Everything else (your other pages, other sites) is passed
//    straight to the browser untouched.
//  - It only creates, reads and deletes caches whose names start with "planet-slide-".
//  - It never touches cookies, localStorage, IndexedDB or other sites' data.
//
// How updates work: when the game opens with a connection it shows the newest index.html
// from the server; with no connection (or after 3 slow seconds) it shows the saved copy.
// Saved scores live in the browser's storage and are never touched here.
const SHELL_VERSION = 'planet-slide-v15';
const PREFIX = 'planet-slide-';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== SHELL_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function freshPage(request) {
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
  return caches.open(SHELL_VERSION).then(cache =>
    cache.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    }))
  );
}

self.addEventListener('fetch', event => {
  const request = event.request;
  // Anything that is not a plain read of a file in this game's folder is left alone.
  const fonts = request.url.startsWith('https://fonts.googleapis.com/') || request.url.startsWith('https://fonts.gstatic.com/');
  if (request.method !== 'GET' || !(fonts || request.url.startsWith(self.registration.scope))) return;
  const path = new URL(request.url).pathname;
  const isPage = request.mode === 'navigate' || /(\/|index\.html)$/.test(path);
  event.respondWith(isPage ? freshPage(request) : savedFirst(request));
});
