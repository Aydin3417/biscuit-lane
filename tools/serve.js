/* A plain static server for the test pages. The browser suite drives the
   built game inside an iframe, and file:// will not let it reach in.

     node tools/serve.js

   It is also required as a module by tools/_pw.js, so the browser suite
   can put its own server up rather than failing on a clean clone
   because nobody had started one in another terminal. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const PORT = +(process.env.PORT || 8181);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.png': 'image/png', '.json': 'application/json',
                '.webmanifest': 'application/manifest+json' };

function createServer() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/test/integration.html';
    const file = path.join(root, p);
    if (!file.startsWith(root)) { res.writeHead(403); res.end('no'); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
}

/* Resolves to a stop function.

   A port in use is usually a developer with `npm run serve` open in
   another terminal, and borrowing that is the right answer. But "in
   use" is not the same as "serving this": a socket left in TIME_WAIT by
   a previous run also refuses the bind, and assuming that was a server
   makes the browser suite fail thirty seconds later with a navigation
   timeout and nothing pointing at the cause. Ask first, and say so if
   the answer is no. */
function listen(port, tries) {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', e => {
      if (e.code !== 'EADDRINUSE') return reject(e);
      probe(port).then(ok => {
        if (ok) return resolve({ started: false, stop: () => {} });
        /* a lingering socket clears on its own in a moment */
        if ((tries || 0) < 5) {
          setTimeout(() => listen(port, (tries || 0) + 1).then(resolve, reject), 400);
          return;
        }
        reject(new Error('port ' + port + ' is taken by something that is not this repo.\n' +
          '  free it, or set PORT to another one'));
      });
    });
    s.listen(port, () => resolve({ started: true, stop: () => s.close() }));
  });
}

/* Does whatever holds the port serve this repository? */
function probe(port) {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port, path: '/manifest.webmanifest', timeout: 1500 },
      res => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

module.exports = { createServer, listen, probe, PORT };

if (require.main === module) {
  createServer().listen(PORT, () => console.log('serving on http://localhost:' + PORT));
}
