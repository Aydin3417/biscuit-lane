/* Playwright, the browser it launches and the address it visits, in one
   place.

   Eight dev tools each carried the same four lines: a path into a
   sibling project's node_modules on one particular machine, a Chrome
   binary at a Windows-only path, and a base URL on port 5173 — which
   this repository has never served. Nothing in tools/ ran on a fresh
   clone, and the thirty-nine checks in test/integration.html quietly
   stopped being run at all.

   Playwright is a devDependency now, so `require('playwright')` is the
   answer and `npm install` is the setup. PLAYWRIGHT and CHROME still
   override, so an installation borrowed from somewhere else keeps
   working exactly as it did. */
const serve = require('./serve.js');

const PW_PATH = process.env.PLAYWRIGHT || 'playwright';
let pw;
try {
  pw = require(PW_PATH);
} catch (e) {
  console.error('playwright is not installed.\n' +
    '  npm install\n' +
    '  npx playwright install chromium\n' +
    'or point PLAYWRIGHT at an existing installation.');
  process.exit(1);
}

/* Playwright ships its own Chromium, so a browser path is an override
   rather than a requirement. The old default was a Windows-only path
   that made every tool fail on any other machine. */
const CHROME = process.env.CHROME || null;
const BASE = (process.env.BASE || 'http://localhost:' + serve.PORT).replace(/\/$/, '');

const launch = opts => pw.chromium.launch(
  Object.assign({}, CHROME ? { executablePath: CHROME } : null, opts));

/* Put the static server up unless one is already there, or unless BASE
   points somewhere this process has no business starting. */
const serveIfLocal = () =>
  /^http:\/\/(localhost|127\.0\.0\.1):/.test(BASE)
    ? serve.listen(+BASE.split(':')[2])
    : Promise.resolve({ started: false, stop: () => {} });

module.exports = {
  chromium: pw.chromium,
  devices: pw.devices,
  launch,
  base: BASE,
  at: p => BASE + (p.startsWith('/') ? p : '/' + p),
  serve: serveIfLocal
};
