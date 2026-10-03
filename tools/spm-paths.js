/* Swift Package paths written on Windows, made readable on a Mac.

     node tools/spm-paths.js        (run by `npm run sync`, after cap sync)

   `npx cap sync ios` writes ios/App/CapApp-SPM/Package.swift with paths
   built by the operating system it runs on, so on Windows every plugin
   came out as "..\..\..\node_modules\@capacitor\app". Xcode resolves a
   package path the POSIX way, where a backslash is just a character in a
   file name — so the project this repository hands to a Mac could not
   find a single Capacitor plugin, and nothing on Windows could notice.
   Found reading the file on 30 Sep 2026, before anyone had tried to
   build it.

   Only `path:` arguments are touched, and only their backslashes. */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'ios', 'App', 'CapApp-SPM', 'Package.swift');
if (!fs.existsSync(file)) { console.log('no iOS Swift package, nothing to fix'); process.exit(0); }
const src = fs.readFileSync(file, 'utf8');
let n = 0;
const out = src.replace(/path:\s*"([^"]*)"/g, (m, p) => {
  if (p.indexOf('\\') < 0) return m;
  n++;
  return 'path: "' + p.split('\\').join('/') + '"';
});
if (n) fs.writeFileSync(file, out);
console.log(n ? 'Package.swift: ' + n + ' path(s) turned to forward slashes' : 'Package.swift paths already portable');
