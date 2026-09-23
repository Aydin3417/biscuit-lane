/* Cut a generated sheet of separate things into one picture each.

   The image tools answer "three pieces of furniture on white" with one
   picture of three things. This keys the white out, finds the empty
   columns between the things, and writes each run of occupied columns
   to art/cut-<name>.png trimmed to what is in it, in the order named.

     node tools/art-cut.js <sheet.png> <name> [name ...]
*/
const path = require('path');
const fs = require('fs');
const { launch } = require('./_pw.js');

const [sheet, ...names] = process.argv.slice(2);
if (!sheet || !names.length) { console.error('usage: node tools/art-cut.js <sheet> <name> [name ...]'); process.exit(1); }
const ART = path.join(__dirname, '..', 'art');

(async () => {
  const buf = fs.readFileSync(sheet);
  const mime = /\.png$/i.test(sheet) ? 'image/png' : 'image/jpeg';
  const browser = await launch();
  const page = await browser.newPage();
  const parts = await page.evaluate(async ({ src, want }) => {
    const im = new Image(); im.src = src; await im.decode();
    const w = im.naturalWidth, h = im.naturalHeight;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, w, h), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const m = Math.min(p[i], p[i + 1], p[i + 2]);
      if (m >= 246) p[i + 3] = 0;
      else if (m >= 226) p[i + 3] = Math.round(255 * (246 - m) / 20);
    }
    x.putImageData(d, 0, 0);
    /* a column is occupied if enough of it is opaque to be a thing and
       not a stray speck of the generator's noise */
    const colFull = new Array(w).fill(0);
    for (let cx = 0; cx < w; cx++) {
      let n = 0;
      for (let cy = 0; cy < h; cy++) if (p[(cy * w + cx) * 4 + 3] > 40) n++;
      colFull[cx] = n > 3;
    }
    const runs = [];
    for (let cx = 0; cx < w; ) {
      if (!colFull[cx]) { cx++; continue; }
      let e = cx; while (e < w && colFull[e]) e++;
      runs.push([cx, e]); cx = e;
    }
    /* merge runs split by a thin gap inside one thing until there are as
       many as asked for: always the closest pair first */
    while (runs.length > want) {
      let best = 0, gap = Infinity;
      for (let i = 0; i < runs.length - 1; i++) { const g = runs[i + 1][0] - runs[i][1]; if (g < gap) { gap = g; best = i; } }
      runs.splice(best, 2, [runs[best][0], runs[best + 1][1]]);
    }
    return runs.map(([a, b]) => {
      let top = h, bot = 0;
      for (let cy = 0; cy < h; cy++) for (let cx = a; cx < b; cx++) {
        if (p[(cy * w + cx) * 4 + 3] > 40) { if (cy < top) top = cy; if (cy > bot) bot = cy; }
      }
      const pad = 4, x0 = Math.max(0, a - pad), y0 = Math.max(0, top - pad);
      const cw = Math.min(w, b + pad) - x0, ch = Math.min(h, bot + pad) - y0;
      const o = document.createElement('canvas'); o.width = cw; o.height = ch;
      o.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
      return { w: cw, h: ch, uri: o.toDataURL('image/png') };
    });
  }, { src: 'data:' + mime + ';base64,' + buf.toString('base64'), want: names.length });
  await browser.close();
  if (parts.length !== names.length) console.log('found ' + parts.length + ' things for ' + names.length + ' names');
  parts.forEach((pt, i) => {
    if (!names[i]) return;
    const f = path.join(ART, 'cut-' + names[i] + '.png');
    fs.writeFileSync(f, Buffer.from(pt.uri.split(',')[1], 'base64'));
    console.log('  ' + path.basename(f) + ' ' + pt.w + 'x' + pt.h);
  });
})().catch(e => { console.error(e.message); process.exit(1); });
