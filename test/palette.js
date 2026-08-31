/* The colours, judged as gameplay rather than as taste.

   This file exists because an art direction is about to be handed to
   this game by something that cannot play it. Six tile colours are not
   decoration: the player tells one tile from another by looking, and a
   palette where two of them sit close together makes every board harder
   in a way no difficulty measurement in this project can see. The solver
   in test/_solver.js compares type indices. It has never once looked at
   a colour, so every clear rate in the README was measured by a player
   who cannot be confused.

   So the guardrail has to be here, and it has to run before a colour
   change is allowed to land.

   Colour distance is CIE76 dE in Lab. dE2000 is the better metric and
   this is not it; CIE76 over-reports distance for saturated colours,
   which is most of this palette, so the numbers below are read against
   this palette's own history rather than against a textbook. It is a
   screening test and it says so.

     node test/palette.js
     node test/palette.js --bless    record today as the baseline
*/
const fs = require('fs');
const path = require('path');
const { contrast, deltaE, simulate } = require('./_colour.js');

/* ---------- what the game actually uses ---------- */

const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');

/* the tile colours, read out of the breed table rather than restated */
const data = src(path.join('js', '10-data.js'));
const gems = [...data.matchAll(/gem: '(#[0-9A-Fa-f]{6})', gem2: '(#[0-9A-Fa-f]{6})'/g)]
  .map(m => ({ gem: m[1], gem2: m[2] }));
const names = [...data.matchAll(/id: '([a-z]+)', species: '(?:cat|dog)'/g)].map(m => m[1]);

/* the tokens, read out of the stylesheet the same way */
const css = src('style.css');
function tokensOf(text) {
  const out = {};
  [...text.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,8})/g)].forEach(m => out[m[1]] = m[2]);
  return out;
}
function blockAt(marker) {
  const at = css.indexOf(marker);
  if (at < 0) return '';
  return css.slice(at, css.indexOf('}', at));
}
const light = tokensOf(blockAt(':root{'));
/* the dusk theme redefines a subset; anything it does not name it keeps */
const dusk = Object.assign({}, light, tokensOf(blockAt('[data-theme="dusk"]')));

/* ---------- the checks ---------- */

const faults = [], notes = [];

/* Every tile against every other tile, with normal vision and without.

   This is measured against a recorded baseline rather than against an
   ideal, and the difference matters.

   With normal vision the closest pair sits at 37 and there is a real
   floor to hold. With deuteranopia — the common kind, about one man in
   sixteen — beagle and void collapse to 6.6, which is to say a
   deuteranope cannot tell those two tiles apart by colour at all. That
   is not a regression somebody introduced; it is how this palette has
   always been, and choosing six hues that stay separate under three
   kinds of colour blindness is a design job rather than a threshold.

   What this file can do meanwhile is stop anybody making it worse. The
   baseline is design/palette-baseline.json, written with --bless. A
   change that moves a number down is a fault; a change that moves one
   up is an improvement, and blessing records it as the new floor.

   The board does not rest on colour alone: each of the six tiles is
   drawn in its own silhouette — round, square, hex, shield, gem, clover
   — and those are always on. Settings carry an extra symbol layer on
   top, off by default. So the standing gap costs a deuteranope the
   glance rather than the game. */
const FLOOR = 22;
const VISIONS = [null, 'protanopia', 'deuteranopia', 'tritanopia'];
const BLESS = process.argv.includes('--bless');
const BASE_PATH = path.join(__dirname, '..', 'design', 'palette-baseline.json');
const baseline = fs.existsSync(BASE_PATH) ? JSON.parse(fs.readFileSync(BASE_PATH, 'utf8')) : null;
const measured = {};

console.log('tile colours, ' + gems.length + ' of them');
console.log('');
console.log('vision          closest pair                   dE    was');
console.log('--------------  ----------------------------  ----  -----');
for (const v of VISIONS) {
  let worst = { d: Infinity, a: -1, b: -1 };
  for (let i = 0; i < gems.length; i++) {
    for (let j = i + 1; j < gems.length; j++) {
      const d = deltaE(simulate(gems[i].gem, v), simulate(gems[j].gem, v));
      if (d < worst.d) worst = { d, a: i, b: j };
    }
  }
  const key = v || 'normal';
  const pair = (names[worst.a] || worst.a) + ' / ' + (names[worst.b] || worst.b);
  measured[key] = { d: +worst.d.toFixed(1), pair };
  const was = baseline && baseline.tiles && baseline.tiles[key];
  console.log(key.padEnd(16) + pair.padEnd(30) +
    worst.d.toFixed(1).padStart(4) + '  ' + (was ? was.d.toFixed(1).padStart(5) : '    -'));

  if (!v && worst.d < FLOOR) {
    faults.push('with normal vision, ' + pair + ' are only ' +
      worst.d.toFixed(1) + ' apart (floor ' + FLOOR + ')');
  }
  /* half a dE is below what anyone can see and above what rounding
     moves, so it is the width of "unchanged" */
  if (was && worst.d < was.d - 0.5) {
    faults.push(key + ' got worse: ' + pair + ' ' + was.d.toFixed(1) + ' -> ' + worst.d.toFixed(1));
  }
}
if (measured.deuteranopia && measured.deuteranopia.d < 15) {
  notes.push('standing gap: ' + measured.deuteranopia.pair + ' are ' +
    measured.deuteranopia.d.toFixed(1) +
    ' apart with deuteranopia — told apart by silhouette, not by colour');
}

/* the darker half of a tile has to stay attached to its own top half;
   a shade that drifts is a tile that reads as two colours */
gems.forEach((g, i) => {
  const d = deltaE(g.gem, g.gem2);
  if (d > 42) notes.push((names[i] || i) + ' sits ' + d.toFixed(0) + ' from its own shade');
});

/* Text on the ground it is actually printed on. Only the pairs the
   stylesheet really uses; inventing pairs would invent failures. */
const PAIRS = [
  ['text', 'bg', 4.5], ['text', 'surface', 4.5], ['text-dim', 'surface', 4.5],
  ['text-faint', 'surface', 3.0], ['accent-strong', 'surface', 4.5],
  ['accent-ink', 'accent', 4.5], ['text', 'surface-2', 4.5]
];
console.log('');
console.log('text contrast');
[['light', light], ['dusk', dusk]].forEach(([label, t]) => {
  PAIRS.forEach(([fg, bg, need]) => {
    if (!t[fg] || !t[bg]) return;
    const r = contrast(t[fg], t[bg]);
    const ok = r >= need;
    if (!ok) faults.push(label + ': --' + fg + ' on --' + bg + ' is ' + r.toFixed(2) + ':1, needs ' + need);
    if (label === 'light' || !ok) {
      console.log('  ' + (ok ? 'ok  ' : 'BAD ') + (fg + ' on ' + bg).padEnd(30) +
        r.toFixed(2) + ':1' + (label === 'dusk' ? '  (dusk)' : ''));
    }
  });
});

console.log('');
notes.forEach(n => console.log('  note  ' + n));
faults.forEach(f => console.log('  x  ' + f));

if (BLESS) {
  fs.mkdirSync(path.dirname(BASE_PATH), { recursive: true });
  fs.writeFileSync(BASE_PATH, JSON.stringify({
    why: 'What the palette measured when it was last deliberately looked at. ' +
         'test/palette.js fails if a colour change moves any of these down.',
    tiles: measured,
    gems: gems.map((g, i) => ({ id: names[i] || i, gem: g.gem, gem2: g.gem2 }))
  }, null, 1) + '\n');
  console.log('design/palette-baseline.json yazildi');
}
console.log(faults.length ? faults.length + ' sorun' : 'the palette holds where it was left');
process.exit(faults.length ? 1 : 0);
