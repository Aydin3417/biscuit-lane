/* A PNG with its alpha channel taken out.

   A canvas only ever exports RGBA, and the App Store refuses an app icon
   that carries an alpha channel at all, opaque or not (ITMS-90717). The
   1024 icon tools/icon.js wrote was RGBA with every alpha at 255: fine to
   look at, refused at upload. Found on 4 Oct 2026 by reading the file's
   header before anybody had tried to upload it.

   Only what a canvas produces is handled: 8 bits a channel, RGBA, not
   interlaced. Anything else is handed back untouched. */
const zlib = require('zlib');

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function opaquePng(buf) {
  let p = 8, ihdr = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') ihdr = Buffer.from(data);
    else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  if (!ihdr || ihdr[8] !== 8 || ihdr[9] !== 6 || ihdr[12] !== 0) return buf;
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const out = Buffer.alloc(h * (1 + w * 3));
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? line[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
      let add = 0;
      if (f === 1) add = a;
      else if (f === 2) add = b;
      else if (f === 3) add = (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        add = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      line[i] = (line[i] + add) & 255;
    }
    const o = y * (1 + w * 3);
    out[o] = 0;
    for (let x = 0; x < w; x++) {
      out[o + 1 + x * 3] = line[x * 4];
      out[o + 2 + x * 3] = line[x * 4 + 1];
      out[o + 3 + x * 3] = line[x * 4 + 2];
    }
    prev = line;
  }
  ihdr[9] = 2;                                   /* colour type: RGB */
  return Buffer.concat([
    buf.subarray(0, 8),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(out, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

module.exports = { opaquePng };
