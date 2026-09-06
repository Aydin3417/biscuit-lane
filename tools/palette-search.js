/* Six colours that survive colour blindness.

   The first standing question in design/DIRECTION.md: beagle blue and
   sable purple sit 6.6 dE apart for a deuteranope, which is to say
   indistinguishable. Moving one hue does not fix it — separate the
   purple and siamese/pug becomes the new closest pair. All six have to
   be chosen together, which is a search rather than an opinion.

   The thing that makes it hard is what colour blindness actually does.
   Deuteranopia and protanopia collapse the red-green axis, so under
   them a palette has only two axes left to spread six colours along:
   lightness, and blue-yellow. Tritanopia takes the blue-yellow one and
   leaves red-green and lightness. There is no hue arrangement that
   fixes this, because the problem is not hue. **Lightness is the only
   channel all three kinds of colour blindness keep**, so any palette
   that works has its six colours at six clearly different lightnesses.

   That is a real and visible cost, and this tool is honest about it
   rather than pretending a clever hue trick exists.

   What it optimises: the *minimum* pairwise distance across all four
   ways of seeing, because a palette is only as good as its worst pair.
   What it holds: each colour stays in its own hue neighbourhood, so
   Marmalade is still ginger and Siamese is still teal — the breeds are
   named for these colours and the room art uses them.

     node tools/palette-search.js              search, print candidates
     node tools/palette-search.js --hue 30     allow more hue drift
*/
const fs = require('fs');
const path = require('path');
const { deltaE, simulate, lab } = require('../test/_colour.js');

/* deltaE converts to Lab on every call, and the search asks for sixty
   pairs across four ways of seeing, sixty thousand times. Memoising the
   Lab of a colour-under-a-vision turns the whole search from minutes
   into seconds; the values are pure functions of a hex string. */
const labCache = new Map();
function labOf(hex, v) {
  const k = v ? v + hex : hex;
  let L = labCache.get(k);
  if (!L) { L = lab(simulate(hex, v)); labCache.set(k, L); }
  return L;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const ROOT = path.join(__dirname, '..');
const data = fs.readFileSync(path.join(ROOT, 'src', 'js', '10-data.js'), 'utf8');
const current = [...data.matchAll(/gem: '(#[0-9A-Fa-f]{6})', gem2: '(#[0-9A-Fa-f]{6})'/g)].map(m => m[1]);
const names = [...data.matchAll(/id: '([a-z]+)', species: '(?:cat|dog)'/g)].map(m => m[1]);

const HUE_DRIFT = +((process.argv.find(a => /^--hue$/.test(a)) && process.argv[process.argv.indexOf('--hue') + 1]) || 22);
const VISIONS = [null, 'protanopia', 'deuteranopia', 'tritanopia'];

/* Unconstrained, the search spends every bit of the game's warmth: it
   drives marmalade to a dark blood red and beagle to navy, because
   lightness is the only channel all three kinds of colour blindness
   keep and the cheapest way to separate six colours is to push them to
   the extremes of it.

   That is a correct answer to the question asked and the wrong answer
   to the question meant. --keep-tone asks the one that matters: how far
   can separation go *without leaving the world this game lives in* —
   the same band of lightness and saturation the current six sit in,
   which is what makes it a warm afternoon rather than a test card. */
const KEEP_TONE = process.argv.includes('--keep-tone');

/* ---------- hsl <-> hex ---------- */
function hex2hsl(hex) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16) / 255,
    g = parseInt(n.slice(2, 4), 16) / 255,
    b = parseInt(n.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [h, s, l];
}
function hsl2hex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}

/* ---------- scoring ---------- */

/* the worst pair, over every way of seeing. A palette is exactly as
   good as the two tiles hardest to tell apart. */
function score(pal) {
  let worst = Infinity, where = '';
  for (const v of VISIONS) {
    const seen = pal.map(c => labOf(c, v));
    for (let i = 0; i < seen.length; i++) {
      for (let j = i + 1; j < seen.length; j++) {
        const d = dist(seen[i], seen[j]);
        if (d < worst) { worst = d; where = (v || 'normal') + ' ' + names[i] + '/' + names[j]; }
      }
    }
  }
  return { min: worst, where };
}

/* a tile is drawn on a wooden tray and carries a dark face; a colour
   that is nearly white or nearly black stops being a tile colour */
const base = current.map(hex2hsl);

/* the tonal world the game already lives in, measured rather than
   asserted, with a little room either side */
const lo = a => Math.min.apply(null, a), hi = a => Math.max.apply(null, a);
const TONE = {
  lMin: lo(base.map(b => b[2])) - 0.06, lMax: hi(base.map(b => b[2])) + 0.06,
  sMin: lo(base.map(b => b[1])) - 0.10, sMax: hi(base.map(b => b[1])) + 0.10
};
const BOUND = KEEP_TONE
  ? { lMin: TONE.lMin, lMax: TONE.lMax, sMin: TONE.sMin, sMax: TONE.sMax }
  : { lMin: 0.28, lMax: 0.80, sMin: 0.32, sMax: 0.95 };

const usable = hex => {
  const [, s, l] = hex2hsl(hex);
  return l >= BOUND.lMin - 0.001 && l <= BOUND.lMax + 0.001 &&
         s >= BOUND.sMin - 0.001 && s <= BOUND.sMax + 0.001;
};

function randomPalette(rnd) {
  return base.map(([h, s, l]) => {
    let hex, guard = 0;
    do {
      hex = hsl2hex(
        h + (rnd() - 0.5) * 2 * HUE_DRIFT,
        Math.max(BOUND.sMin, Math.min(BOUND.sMax, s + (rnd() - 0.5) * 0.5)),
        Math.max(BOUND.lMin, Math.min(BOUND.lMax, l + (rnd() - 0.5) * 0.5)));
    } while (!usable(hex) && guard++ < 30);
    return hex;
  });
}

/* Randomised hill climbing with restarts. The space is small and the
   objective is a min over 60 pairs, which is spiky and full of plateaus
   — a gradient would be lying, and this converges in a second. */
function climb(rnd, rounds) {
  let pal = randomPalette(rnd);
  let best = score(pal).min;
  for (let step = 0; step < rounds; step++) {
    const heat = 1 - step / rounds;
    const i = Math.floor(rnd() * pal.length);
    const [h0, s0, l0] = base[i];
    const [h, s, l] = hex2hsl(pal[i]);
    const cand = hsl2hex(
      Math.max(h0 - HUE_DRIFT, Math.min(h0 + HUE_DRIFT, h + (rnd() - 0.5) * 18 * heat)),
      Math.max(BOUND.sMin, Math.min(BOUND.sMax, s + (rnd() - 0.5) * 0.22 * heat)),
      Math.max(BOUND.lMin, Math.min(BOUND.lMax, l + (rnd() - 0.5) * 0.22 * heat)));
    if (!usable(cand)) continue;
    const trial = pal.slice(); trial[i] = cand;
    const sc = score(trial).min;
    if (sc > best) { best = sc; pal = trial; }
  }
  return pal;
}

/* a plain deterministic generator, so a run can be repeated */
function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const now = score(current);
console.log('bugünkü palet');
console.log('  en zayıf çift  ' + now.min.toFixed(1) + '   (' + now.where + ')');
VISIONS.forEach(v => {
  const seen = current.map(c => labOf(c, v));
  let w = Infinity;
  for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) {
    w = Math.min(w, dist(seen[i], seen[j]));
  }
  console.log('    ' + (v || 'normal').padEnd(14) + w.toFixed(1));
});

console.log('\naranıyor (hue ±' + HUE_DRIFT + '°)…');
const found = [];
for (let seed = 1; seed <= 260; seed++) {
  const rnd = mulberry(seed * 7919);
  const pal = climb(rnd, 4000);
  const sc = score(pal);
  /* how far it moved from the game that exists, so the cheapest good
     answer can be preferred over the merely highest-scoring one */
  const drift = pal.reduce((a, c, i) => a + deltaE(c, current[i]), 0) / pal.length;
  found.push({ pal, min: sc.min, where: sc.where, drift });
}
found.sort((a, b) => b.min - a.min);

/* keep the best, then the best that stays closest to today's colours */
const top = found[0];
const near = found.filter(f => f.min >= top.min - 4).sort((a, b) => a.drift - b.drift)[0];
const picks = [['en ayrık', top]];
if (near && near !== top) picks.push(['en az değişen (yakın skorla)', near]);

picks.forEach(([label, f]) => {
  console.log('\n--- ' + label + ' ---');
  console.log('  en zayıf çift  ' + f.min.toFixed(1) + '   (' + f.where + ')   ' +
    'bugünden ortalama sapma ' + f.drift.toFixed(0) + ' dE');
  VISIONS.forEach(v => {
    const seen = f.pal.map(c => labOf(c, v));
    let w = Infinity;
    for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) {
      w = Math.min(w, dist(seen[i], seen[j]));
    }
    console.log('    ' + (v || 'normal').padEnd(14) + w.toFixed(1));
  });
  console.log('');
  f.pal.forEach((c, i) => {
    const [h, s, l] = hex2hsl(c);
    const [h0, , l0] = hex2hsl(current[i]);
    console.log('    ' + names[i].padEnd(11) + current[i] + ' -> ' + c +
      '   hue ' + Math.round(h0) + '->' + Math.round(h) +
      '   light ' + Math.round(l0 * 100) + '->' + Math.round(l * 100) + '%');
  });
});

/* Written out so the art-direction round can carry them: the question
   stops being "what should the colours be" and becomes "here are the
   measured options, which one reads as this game". */
const outFile = path.join(ROOT, 'design', 'palette-candidates.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const asRow = f => ({
  worstPair: +f.min.toFixed(1), where: f.where, driftFromToday: +f.drift.toFixed(0),
  colours: f.pal.map((c, i) => ({ id: names[i], from: current[i], to: c }))
});
fs.writeFileSync(outFile, JSON.stringify({
  why: 'Measured answers to standing question 1 in DIRECTION.md. Not decisions.',
  hueDrift: HUE_DRIFT, keepTone: KEEP_TONE,
  today: { worstPair: +now.min.toFixed(1), where: now.where },
  candidates: picks.map(([label, f]) => Object.assign({ label }, asRow(f)))
}, null, 1) + '\n');
console.log('');
console.log('design/palette-candidates.json yazildi');

console.log('\nNot: bu bir öneri, karar değil. Renkler oynanış olduğu kadar kimlik de');
console.log('taşıyor — Marmalade zencefil, Siamese açık, Sable koyu olmalı. Son sözü');
console.log('sanat yönü söyler; buradaki iş, hangi seçeneklerin ölçüm olarak mümkün');
console.log('olduğunu göstermek.');
