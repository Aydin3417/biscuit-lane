/* Put the typefaces inside the file.

   The game claims to be one self-contained page that works offline, and
   for everything it draws that is true — every animal and every sound is
   made at runtime. The typefaces were the exception: two `<link>` tags
   to fonts.googleapis.com, fetched over the network on first paint.

   That is three separate problems wearing one hat.

   It breaks the promise. An app installed from a store and opened for
   the first time without a connection falls back to whatever sans-serif
   the phone has, and a game whose whole first impression is warmth and
   hand-drawn roundness opens in Roboto.

   It is a privacy disclosure. A font request carries the player's IP
   address to a third party, which for an offline single-player game with
   no accounts and no telemetry is the only thing that ever leaves the
   device — and the only reason the store listing would have to mention
   anybody else at all.

   And it is slow where it hurts: a render-blocking stylesheet on a
   cold cache, before the first frame.

   So the faces are subset to the characters this game actually uses —
   read out of the string tables rather than guessed at — and embedded.
   Grandstander and Karla are both under the SIL Open Font License, which
   permits this; the licence text travels with them.

     node tools/fonts.js          fetch, subset, write src/fonts.css
     node tools/fonts.js --check  report what is embedded, fetch nothing
*/
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'fonts.css');

/* The faces the stylesheet actually asks for. Karla's italic was in the
   request and is used nowhere — there is not one font-style:italic in
   the whole stylesheet — so it is not carried. */
const FACES = [
  ['Grandstander', 400], ['Grandstander', 600], ['Grandstander', 700], ['Grandstander', 800],
  ['Karla', 400], ['Karla', 500], ['Karla', 700]
];

/* Every character the game can put on screen, gathered from the places
   it can come from. Subsetting to a guessed alphabet is how a Turkish
   player meets a missing ğ. */
function charset() {
  const chars = new Set();
  const add = s => { for (const ch of String(s)) chars.add(ch); };

  const srcDir = path.join(ROOT, 'src', 'js');
  for (const f of fs.readdirSync(srcDir)) {
    const text = fs.readFileSync(path.join(srcDir, f), 'utf8');
    /* every single- and double-quoted literal and every template chunk:
       wider than the strings alone, which is the safe direction */
    (text.match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g) || []).forEach(add);
  }
  ['body.html', 'head.html', 'style.css'].forEach(f => {
    const p = path.join(ROOT, 'src', f);
    if (fs.existsSync(p)) add(fs.readFileSync(p, 'utf8'));
  });

  /* and the ones a player types: a pet name can be anything, so the
     Latin and Turkish alphabets go in whole rather than only the letters
     that happen to appear in the shipped copy */
  add('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
  add('çğıöşüÇĞİÖŞÜâîû');
  add('0123456789');
  add(' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~');
  add('·×—–…’‘“”€₺');

  /* keep it to what a font can hold: no control characters, no
     astral-plane emoji (the game draws its own icons) */
  const out = [];
  chars.forEach(ch => {
    const cp = ch.codePointAt(0);
    if (cp < 0x20 || cp === 0x7f) return;
    if (cp > 0x2fff) return;
    out.push(ch);
  });
  return out.sort().join('');
}

const CSS_URL = (fam, w) =>
  'https://fonts.googleapis.com/css2?family=' + fam + ':wght@' + w + '&display=swap';

/* Google serves woff2 only to user agents that admit to supporting it */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchFace(fam, weight) {
  const css = await (await fetch(CSS_URL(fam, weight), { headers: { 'User-Agent': UA } })).text();
  /* the latin-ext block carries the Turkish letters; take every source
     the sheet offers and keep the last, which is the widest */
  const urls = css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2/g) || [];
  if (!urls.length) throw new Error(fam + ' ' + weight + ': woff2 bulunamadı');
  const res = await fetch(urls[urls.length - 1], { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(fam + ' ' + weight + ': ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

function subset(buf, chars) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-font-'));
  const inFile = path.join(tmp, 'in.woff2');
  const outFile = path.join(tmp, 'out.woff2');
  const txtFile = path.join(tmp, 'chars.txt');
  fs.writeFileSync(inFile, buf);
  fs.writeFileSync(txtFile, chars, 'utf8');
  execFileSync('python3', ['-m', 'fontTools.subset', inFile,
    '--text-file=' + txtFile,
    '--flavor=woff2',
    '--layout-features=kern,liga',
    '--output-file=' + outFile], { stdio: 'pipe' });
  const out = fs.readFileSync(outFile);
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}

(async () => {
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(OUT)) { console.log('src/fonts.css yok'); process.exit(1); }
    const css = fs.readFileSync(OUT, 'utf8');
    const faces = (css.match(/@font-face/g) || []).length;
    console.log(faces + ' yüz gömülü, ' + Math.round(css.length / 1024) + ' KB');
    return;
  }

  const chars = charset();
  console.log(chars.length + ' karakter alt kümesi');

  let css = '/* Generated by tools/fonts.js — do not edit by hand.\n\n' +
    '   Grandstander and Karla, subset to the ' + chars.length + ' characters this\n' +
    '   game can display and embedded so the first frame needs no network.\n' +
    '   Both are under the SIL Open Font License 1.1, which permits\n' +
    '   embedding and redistribution; the fonts are unmodified apart from\n' +
    '   having glyphs removed.\n\n' +
    '   Regenerate with: node tools/fonts.js */\n';

  let total = 0;
  for (const [fam, weight] of FACES) {
    const raw = await fetchFace(fam, weight);
    const small = subset(raw, chars);
    total += small.length;
    console.log('  ' + fam.padEnd(14) + weight + '   ' +
      String(Math.round(raw.length / 1024)).padStart(4) + ' KB -> ' +
      String(Math.round(small.length / 1024)).padStart(3) + ' KB');
    css += '\n@font-face{font-family:"' + fam + '";font-style:normal;font-weight:' + weight +
      ';font-display:swap;src:url(data:font/woff2;base64,' +
      small.toString('base64') + ') format("woff2")}\n';
  }

  fs.writeFileSync(OUT, css);
  console.log('\n' + FACES.length + ' yüz, ' + Math.round(total / 1024) + ' KB ham, ' +
    Math.round(css.length / 1024) + ' KB base64 ile');
  console.log('src/fonts.css yazıldı');
})().catch(e => { console.error(e.message); process.exit(1); });
