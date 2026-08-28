/* The things that make it an app rather than a page.

   None of this is visible from inside the game, and all of it is the
   kind that rots quietly: an icon renamed, a size that stops matching
   what the manifest claims, a shell entry that no longer exists. The
   browser's answer to any of those is to silently decline to offer the
   install, which nobody would notice for months.

     node test/mobile.js
*/
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const problems = [];
const ok = [];

/* PNG puts its width and height in the IHDR chunk, first thing after
   the signature — so the declared size can be checked against the file */
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

/* ---- the manifest ---- */
let man = null;
try { man = JSON.parse(read('manifest.webmanifest')); ok.push('the manifest parses'); }
catch (e) { problems.push('the manifest does not parse: ' + e.message); }

if (man) {
  [['name', 'Biscuit Lane'], ['display', 'standalone'], ['orientation', 'portrait']]
    .forEach(([k, want]) => {
      if (man[k] !== want) problems.push('manifest ' + k + ' is "' + man[k] + '", wanted "' + want + '"');
    });
  ['start_url', 'scope', 'background_color', 'theme_color'].forEach(k => {
    if (!man[k]) problems.push('manifest has no ' + k);
  });
  if (!Array.isArray(man.icons) || !man.icons.length) problems.push('the manifest lists no icons');
  else {
    let maskable = 0, big = 0;
    man.icons.forEach(ic => {
      const f = path.join(root, ic.src);
      if (!fs.existsSync(f)) { problems.push('manifest icon missing on disk: ' + ic.src); return; }
      const size = pngSize(f);
      const want = +String(ic.sizes).split('x')[0];
      if (!size) problems.push(ic.src + ' is not a PNG');
      else if (size[0] !== want || size[1] !== want) {
        problems.push(ic.src + ' is ' + size.join('x') + ' but the manifest says ' + ic.sizes);
      }
      if (String(ic.purpose).indexOf('maskable') >= 0) maskable++;
      if (want >= 512) big++;
    });
    if (!maskable) problems.push('no maskable icon: Android will crop the mark to a circle');
    if (!big) problems.push('no icon at 512px: the install prompt needs one');
    if (!problems.length) ok.push(man.icons.length + ' icons, all present and the size they claim');
  }
}

/* ---- the service worker ---- */
let sw = null;
try {
  sw = read('sw.js');
  new Function(sw);          /* it has to parse, or it silently never installs */
  ok.push('the service worker parses');
} catch (e) { problems.push('sw.js: ' + e.message); }

if (sw) {
  ['install', 'activate', 'fetch'].forEach(ev => {
    if (sw.indexOf("'" + ev + "'") < 0) problems.push('the worker handles no ' + ev + ' event');
  });
  /* a worker with no fetch handler is not an offline app, and Chrome
     will not offer to install one */
  const shell = (sw.match(/const SHELL = \[([^\]]*)\]/) || [])[1] || '';
  const entries = (shell.match(/'([^']+)'/g) || []).map(s2 => s2.slice(1, -1));
  entries.forEach(e => {
    if (e === './' || e === '/') return;
    if (!fs.existsSync(path.join(root, e))) problems.push('the worker caches a file that is not there: ' + e);
  });
  if (entries.length) ok.push('the shell lists ' + entries.length + ' files and every one exists');
}

/* ---- what the document claims ---- */
const head = read('src/head.html');
[['link rel="manifest"', 'rel="manifest"'],
 ['apple-mobile-web-app-capable', 'apple-mobile-web-app-capable'],
 ['apple-touch-icon', 'rel="apple-touch-icon"'],
 ['theme-color', 'name="theme-color"'],
 ['viewport-fit=cover', 'viewport-fit=cover']].forEach(([label, needle]) => {
  if (head.indexOf(needle) < 0) problems.push('the head has no ' + label);
});
const apple = (head.match(/rel="apple-touch-icon" href="([^"]+)"/) || [])[1];
if (apple && !fs.existsSync(path.join(root, apple))) {
  problems.push('apple-touch-icon points at ' + apple + ', which is not there');
} else if (apple) {
  const s2 = pngSize(path.join(root, apple));
  if (!s2 || s2[0] < 180) problems.push('the apple touch icon is ' + (s2 ? s2.join('x') : 'not a PNG') + ', iOS wants 180');
  else ok.push('the apple touch icon is ' + s2.join('x'));
}

/* the built file has to carry all of it too */
const built = read('index.html');
['rel="manifest"', 'apple-mobile-web-app-capable', 'name="theme-color"'].forEach(n => {
  if (built.indexOf(n) < 0) problems.push('the built game is missing ' + n);
});
if (built.indexOf('serviceWorker') < 0) problems.push('the built game never registers the worker');
ok.push('the built file carries the install metadata');

console.log('the mobile app layer:');
ok.forEach(o => console.log('  ok   ' + o));
if (problems.length) {
  console.log('');
  problems.forEach(p => console.log('  PROBLEM  ' + p));
  process.exitCode = 1;
} else {
  console.log('');
  console.log('installable, and it holds together');
}
