/* Dev-only helper: the page POSTs a canvas data URL here and it lands
   on disk as a PNG, so the art can be looked at instead of guessed at. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'shots');
fs.mkdirSync(outDir, { recursive: true });

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end('post only'); return; }

  const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'shot')
    .replace(/[^a-z0-9._-]/gi, '_');
  let body = '';
  req.on('data', d => { body += d; if (body.length > 40e6) req.destroy(); });
  req.on('end', () => {
    const b64 = body.slice(body.indexOf(',') + 1);
    const file = path.join(outDir, name.endsWith('.png') ? name : name + '.png');
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log('wrote ' + file + '  ' + (fs.statSync(file).size / 1024).toFixed(1) + ' KB');
    res.writeHead(200); res.end('ok');
  });
}).listen(5174, () => console.log('shot server on http://localhost:5174'));
