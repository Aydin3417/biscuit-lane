/* A plain static server for the test pages. The browser suite drives the
   built game inside an iframe, and file:// will not let it reach in. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.png': 'image/png', '.json': 'application/json',
                '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/test/integration.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); res.end('no'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(8181, () => console.log('serving on http://localhost:8181'));
