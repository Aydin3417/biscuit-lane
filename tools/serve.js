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

/* Resolves to a stop function. A port already in use means somebody
   else is serving this same directory — which is the normal case when a
   developer has `npm run serve` open — so that is success, not failure. */
function listen(port) {
  return new Promise(resolve => {
    const s = createServer();
    s.once('error', e => {
      if (e.code === 'EADDRINUSE') resolve({ started: false, stop: () => {} });
      else throw e;
    });
    s.listen(port, () => resolve({ started: true, stop: () => s.close() }));
  });
}

module.exports = { createServer, listen, PORT };

if (require.main === module) {
  createServer().listen(PORT, () => console.log('serving on http://localhost:' + PORT));
}
