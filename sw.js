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

/* The typefaces come from Google, and a service worker does not control
   the page that installed it — so on the visit that installs this, the
   fonts are never asked for through here and never land in the cache.
   A player who installs the game and then loses signal would get the
   fallback stack on their first real launch. So the stylesheet is
   fetched here and the woff2 files it names are pulled in behind it. */
function warmFonts(cache) {
  const css = 'https://fonts.googleapis.com/css2?family=Grandstander:wght@400;600;700;800' +
    '&family=Karla:ital,wght@0,400;0,500;0,700;1,400&display=swap';
  return fetch(css, { mode: 'cors' })
    .then(res => {
      if (!res || !res.ok) return null;
      const copy = res.clone();
      return cache.put(css, copy).then(() => res.text());
    })
    .then(text => {
      if (!text) return null;
      const urls = (text.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) || [])
        .map(u => u.replace(/['"]$/, ''));
      return Promise.all([...new Set(urls)].map(u =>
        fetch(u, { mode: 'cors' }).then(r => (r && r.ok) ? cache.put(u, r) : null).catch(() => null)));
    })
    .catch(() => null);
}

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => caches.open(VERSION))
    .then(c => warmFonts(c))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !isFont) return;

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
