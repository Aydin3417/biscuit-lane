/* See a candidate palette on the actual board.

   A colour decision made from hex codes and a distance metric is a
   colour decision made blind. This applies a candidate from
   design/palette-candidates.json to the real breed table, rebuilds,
   photographs the board and the room, and then puts everything back
   exactly as it was.

   Nothing is left behind: the source file is restored from a copy taken
   before the edit, and the bundle is rebuilt from the restored source,
   whether the run succeeds or throws.

     node tools/palette-preview.js            every candidate
     node tools/palette-preview.js 0          just the first
*/
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'js', '10-data.js');
const OUT = path.join(ROOT, 'shots', 'palette');
const node = process.execPath;

const cands = JSON.parse(fs.readFileSync(path.join(ROOT, 'design', 'palette-candidates.json'), 'utf8'));
const only = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);

/* The darker half of each tile moves with the top half, by the same
   relationship it has today: gem2 is a shade of gem, and a candidate
   that only moved gem would leave every tile with a mismatched face. */
function shadeLike(fromGem, fromGem2, toGem) {
  const px = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = px(fromGem), [r2, g2, b2] = px(fromGem2), [r3, g3, b3] = px(toGem);
  const k = (a, b) => (a === 0 ? 0 : b / a);
  const mul = [k(r1, r2), k(g1, g2), k(b1, b2)];
  const out = [r3 * mul[0], g3 * mul[1], b3 * mul[2]]
    .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'));
  return '#' + out.join('');
}

const original = fs.readFileSync(DATA, 'utf8');
let restored = false;
const restore = () => {
  if (restored) return;
  restored = true;
  fs.writeFileSync(DATA, original);
  execFileSync(node, [path.join(ROOT, 'build.js')], { stdio: 'ignore' });
};
process.on('exit', restore);
process.on('SIGINT', () => { restore(); process.exit(130); });

fs.mkdirSync(OUT, { recursive: true });

try {
  /* today, for the comparison */
  execFileSync(node, [path.join(ROOT, 'build.js')], { stdio: 'ignore' });
  shoot('today');

  cands.candidates.forEach((c, i) => {
    if (only.length && only.indexOf(i) < 0) return;
    let src = original;
    c.colours.forEach(col => {
      const re = new RegExp("gem: '" + col.from + "', gem2: '(#[0-9A-Fa-f]{6})'");
      const m = src.match(re);
      if (!m) throw new Error(col.id + ' (' + col.from + ') tabloda bulunamadı');
      src = src.replace(re, "gem: '" + col.to + "', gem2: '" +
        shadeLike(col.from, m[1], col.to) + "'");
    });
    fs.writeFileSync(DATA, src);
    execFileSync(node, [path.join(ROOT, 'build.js')], { stdio: 'ignore' });
    const tag = String(i) + '-' + c.label.replace(/[^a-z]+/gi, '-').replace(/^-|-$/g, '');
    shoot(tag);
    console.log('  ' + tag + '   en zayıf ' + c.worstPair);
  });
} finally {
  restore();
}

console.log('\n' + OUT);
console.log('kaynak geri alındı, paket yeniden derlendi');

function shoot(tag) {
  execFileSync(node, [path.join(__dirname, 'shot-palette.js'), tag], { stdio: 'inherit' });
}
