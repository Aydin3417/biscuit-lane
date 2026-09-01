/* Assembles the web payload a native shell wraps.

     node tools/pack.js        ->  www/

   build.js is left alone deliberately. It turns src/ into
   biscuit-lane.html and index.html, those two files are byte-checked in
   CI, and the whole point of them is that they do not move. This is the
   separate, later job: take what the build produced and lay out the
   directory Capacitor copies into the app.

   The game is one self-contained file, so this is almost entirely a
   copy. What it is really for is making sure the things beside that
   file — the manifest, the icons, the worker — are the ones the shipped
   app gets, rather than whatever happened to be in the repository root
   at the time. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');

/* The service worker stays out of the native build on purpose. Inside a
   WebView the app is already local — the cache it manages is a second
   copy of files that never travel, and its cache-first rule would pin
   an old build across an app update. It remains the right answer for
   the web version, which is still the thing build.js produces. */
const FILES = ['index.html', 'manifest.webmanifest'];
const DIRS = ['icons'];

const missing = FILES.filter(f => !fs.existsSync(path.join(root, f)));
if (missing.length) {
  console.error('missing: ' + missing.join(', ') + '\n  run: node build.js');
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

let bytes = 0;
FILES.forEach(f => {
  fs.copyFileSync(path.join(root, f), path.join(out, f));
  bytes += fs.statSync(path.join(out, f)).size;
});
DIRS.forEach(d => {
  fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
  fs.readdirSync(path.join(out, d)).forEach(f => { bytes += fs.statSync(path.join(out, d, f)).size; });
});

/* A native shell has no service worker to unregister itself, so any
   worker a player's WebView picked up from an earlier web visit would
   outlive the install. Nothing here registers one; this asserts it. */
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
if (/serviceWorker\s*\.\s*register/.test(html) && !/catch/.test(html)) {
  console.error('index.html registers a service worker without a guard');
  process.exit(1);
}

console.log('packed www/  ' + (bytes / 1024).toFixed(1) + ' KB  (' +
  (FILES.length + DIRS.length) + ' entries)');
