/* Biscuit Lane — offline.

   The whole game is one HTML file, so the shell is almost the whole
   job: cache it on install, serve it from cache first, and quietly
   refresh it in the background so the next launch has the new one.

   The Google Fonts stylesheet and its woff2 files are cached the first
   time they are asked for, because a game that works on the underground
   should not lose its typeface there. */
const VERSION = 'biscuit-lane-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(SHELL).catch(() => { /* a missing extra must not fail the install */ }))
    .then(() => self.skipWaiting()));
});

/* The typefaces used to be fetched from Google here, because a service
   worker does not control the page that installed it and a player who
   installed the game and then lost signal would meet the fallback stack
   on their first real launch.

   They are embedded in the page now — subset to the characters this game
   can display, about a hundred kilobytes for seven faces — so there is
   nothing to warm and nothing that leaves the device. See tools/fonts.js.
   Removing this also means the worker no longer has to be allowed to
   talk to a third-party origin at all. */

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => caches.open(VERSION))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  /* same origin only, now that nothing is fetched from anywhere else */
  if (url.origin !== self.location.origin) return;

  e.respondWith(caches.match(req).then(hit => {
    /* Cache first, then repair in the background. The game is a single
       file that changes as a whole, so serving yesterday's copy for one
       launch is a better trade than a blank screen on a bad connection. */
    const live = fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit);
    return hit || live;
  }));
});
