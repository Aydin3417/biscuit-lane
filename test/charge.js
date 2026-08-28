/* Does the pet's move ever fire?

   The one thing joining the two halves of this game is that matching
   your own pet's breed charges its ability: `applyCounts` adds
   CHARGE_FAV per tile of the pet's breed and CHARGE_OTHER per tile of
   anything else, and the HUD says "Match {breed} to charge".

   Nothing had ever checked that the breed is on the board. Twelve of
   the sixty handcrafted levels deal `types: 5` — tile types 0..4 — and
   there are six breeds. A player who adopts the sixth in onboarding is
   told to match a tile that is not dealt, and charges at the slow rate
   for the whole level.

   This walks the greedy solver through real levels, counts the tiles it
   actually clears, and reports how often each breed's meter fills.

     node test/charge.js            the handcrafted lane
     node test/charge.js 61 120     the generated run
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsDir = path.join(__dirname, '..', 'src', 'js');
const read = f => fs.readFileSync(path.join(jsDir, f), 'utf8');
const ctx = {
  console,
  SP: { NONE: 0, ROW: 1, COL: 2, BOMB: 3, RAIN: 4 },
  document: { createElement: () => ({ getContext: () => ({}) }) },
  window: { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 },
  performance: { now: () => Date.now() },
  navigator: { language: 'en' },
  requestAnimationFrame: fn => setTimeout(fn, 16),
  setTimeout, clearTimeout, Math, Date, JSON
};
vm.createContext(ctx);
['00-util.js', '10-data.js', '30-engine.js'].forEach(f =>
  vm.runInContext(read(f).replace(/^.use strict.;?$/m, ''), ctx, { filename: f }));
const X = vm.runInContext(
  '({ makeBoard: typeof makeBoard === "function" ? makeBoard : null,' +
  '   findMatches, specialFor, settle, hasMove, allMoves, swapTiles,' +
  '   eachCell, openCell, levelDef, tilesOfType, commonType, shuffleTypes, brambleCount,' +
  '   mulberry, GK, PUP, BREEDS,' +
  '   CHARGE_FAV: typeof CHARGE_FAV === "number" ? CHARGE_FAV : null,' +
  '   CHARGE_OTHER: typeof CHARGE_OTHER === "number" ? CHARGE_OTHER : null,' +
  '   favTypeFor: typeof favTypeFor === "function" ? favTypeFor : null })', ctx);
const {
  makeBoard, findMatches, specialFor, settle, hasMove, allMoves, swapTiles,
  eachCell, openCell, levelDef, tilesOfType, commonType, shuffleTypes, brambleCount,
  mulberry, GK, PUP, BREEDS, favTypeFor
} = X;
const SP = ctx.SP;

/* the rates the game charges at, read from the source where it has them */
const FAV = X.CHARGE_FAV === null ? 4.2 : X.CHARGE_FAV;
const OTHER = X.CHARGE_OTHER === null ? 0.55 : X.CHARGE_OTHER;
/* before there was a favTypeFor, the favourite was the breed index flat */
const favOf = (breed, types) => favTypeFor ? favTypeFor(breed, types) : breed;

let cloneSeq = 1;
function cloneBoard(B) {
  const C = { w: B.w, h: B.h, types: B.types, def: B.def, exits: B.exits,
    pupQueue: B.pupQueue || 0, rng: mulberry(cloneSeq++ * 2654435761 >>> 0), cell: [] };
  for (let r = 0; r < B.h; r++) {
    const row = [];
    for (let c = 0; c < B.w; c++) {
      const s = B.cell[r][c];
      row.push({ hole: s.hole, crate: s.crate, mud: s.mud, ice: s.ice, bram: s.bram, r, c,
        tile: s.tile ? { id: s.tile.id, type: s.tile.type, sp: s.tile.sp, x: 0, y: 0, dying: 0 } : null });
    }
    C.cell.push(row);
  }
  return C;
}
function hitCell(B, r, c, out, touched) {
  const cell = B.cell[r] && B.cell[r][c];
  if (!cell || cell.hole) return;
  const key = r + ':' + c;
  if (touched.has(key)) return;
  touched.add(key);
  if (cell.crate > 0) { cell.crate--; if (cell.crate === 0) out.crate++; return; }
  if (cell.ice > 0) { cell.ice--; return; }
  const t = cell.tile;
  if (!t || t.type === PUP) return;
  if (t.sp !== SP.NONE) out.chain.push({ r, c, sp: t.sp, type: t.type });
  cell.tile = null;
  out.count++;
  out.collect[t.type] = (out.collect[t.type] || 0) + 1;
  if (cell.mud > 0) { cell.mud--; out.mud++; }
  if (cell.bram > 0) { cell.bram--; out.bram++; }
  [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([r2, c2]) => {
    const n = B.cell[r2] && B.cell[r2][c2];
    if (n && n.crate > 0) { n.crate--; if (n.crate === 0) out.crate++; }
  });
}
function specialKeys(B, r, c, sp, type) {
  const keys = [];
  if (sp === SP.ROW) for (let i = 0; i < B.w; i++) keys.push(r + ':' + i);
  else if (sp === SP.COL) for (let i = 0; i < B.h; i++) keys.push(i + ':' + c);
  else if (sp === SP.BOMB) { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) keys.push((r + dr) + ':' + (c + dc)); }
  else if (sp === SP.RAIN) {
    const tt = (type === undefined || type < 0) ? commonType(B) : type;
    tilesOfType(B, tt).forEach(([rr, cc]) => keys.push(rr + ':' + cc));
  }
  return keys;
}
function blast(B, keys, tally) {
  let wave = Array.from(keys), guard = 0;
  while (wave.length && guard++ < 24) {
    const out = { chain: [], collect: {}, mud: 0, crate: 0, bram: 0, count: 0 };
    const touched = new Set();
    wave.forEach(k => { const p = k.split(':'); hitCell(B, +p[0], +p[1], out, touched); });
    tally.mud += out.mud; tally.crate += out.crate; tally.bram += out.bram; tally.count += out.count;
    for (const k in out.collect) tally.collect[k] = (tally.collect[k] || 0) + out.collect[k];
    const next = [];
    out.chain.forEach(s => specialKeys(B, s.r, s.c, s.sp, s.type).forEach(k => next.push(k)));
    wave = next;
  }
}
function collectPups(B, tally) {
  let got = 0;
  for (let c = 0; c < B.w; c++) {
    const r = B.exits[c];
    if (r < 0) continue;
    const cell = B.cell[r][c];
    if (cell.tile && cell.tile.type === PUP) { cell.tile = null; tally.rescued++; B.pupQueue = (B.pupQueue || 0) + 1; got++; }
  }
  return got;
}
function settleFully(B, tally) { for (let d = 0; d < 14; d++) { settle(B); if (!collectPups(B, tally)) return; } }
function resolve(B, swapCells, tally) {
  let guard = 0;
  while (guard++ < 60) {
    const groups = findMatches(B);
    if (!groups.length) break;
    const keys = new Set(); const specials = [];
    groups.forEach(g => {
      const sp = specialFor(g);
      let at = null;
      if (sp !== SP.NONE) {
        if (swapCells) for (const sc of swapCells) if (g.cells.some(p => p[0] === sc[0] && p[1] === sc[1])) { at = sc; break; }
        if (!at) at = g.cells[Math.floor(g.cells.length / 2)];
        specials.push({ r: at[0], c: at[1], sp }); tally.made++;
      }
      g.cells.forEach(p => { if (!(at && p[0] === at[0] && p[1] === at[1])) keys.add(p[0] + ':' + p[1]); });
    });
    blast(B, keys, tally);
    specials.forEach(s => { const cell = B.cell[s.r][s.c]; if (cell.tile) cell.tile.sp = s.sp; });
    swapCells = null;
    settleFully(B, tally);
  }
}
const blankTally = () => ({ collect: {}, mud: 0, crate: 0, bram: 0, count: 0, rescued: 0, made: 0, chain: [] });
function mkGoals(def) { return def.goals.map(g => ({ kind: g[0], arg: g[1], need: g[2], have: 0 })); }
function applyTally(goals, tally, score, B) {
  goals.forEach(g => {
    if (g.kind === GK.COLLECT) g.have += tally.collect[g.arg] || 0;
    else if (g.kind === GK.MUD) g.have += tally.mud;
    else if (g.kind === GK.CRATE) g.have += tally.crate;
    else if (g.kind === GK.BRAMBLE) g.have = Math.max(0, g.need - brambleCount(B));
    else if (g.kind === GK.RESCUE) g.have += tally.rescued;
    else if (g.kind === GK.SCORE) g.have = score;
  });
}
const met = goals => goals.every(g => g.have >= g.need);
function moveValue(goals, tally, scoreGain) {
  let v = 0;
  goals.forEach(g => {
    const left = Math.max(0, g.need - g.have);
    if (left <= 0) return;
    let got = 0;
    if (g.kind === GK.COLLECT) got = tally.collect[g.arg] || 0;
    else if (g.kind === GK.MUD) got = tally.mud;
    else if (g.kind === GK.CRATE) got = tally.crate;
    else if (g.kind === GK.BRAMBLE) got = tally.bram * 2;
    else if (g.kind === GK.RESCUE) got = tally.rescued * 8;
    else if (g.kind === GK.SCORE) got = scoreGain / 260;
    v += Math.min(got, left) * 10;
  });
  v += tally.count * 0.35; v += tally.made * 6;
  return v;
}
function bestMove(B, goals) {
  const moves = allMoves(B);
  if (!moves.length) return null;
  let best = null, bestV = -1;
  for (const m of moves) {
    const C = cloneBoard(B);
    swapTiles(C, m[0], m[1]);
    const t = blankTally();
    resolve(C, [m[0], m[1]], t);
    const v = moveValue(goals, t, t.count * 62);
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}

/* Play the level and return, per breed, how many times the meter filled. */
function chargeRun(n, seed) {
  const def = levelDef(n);
  const B = makeBoard(def, seed);
  B.pupQueue = 0;
  const goals = mkGoals(def);
  let moves = def.moves, score = 0;
  const charge = new Array(BREEDS.length).fill(0);
  const fires = new Array(BREEDS.length).fill(0);
  const scoreOnly = goals.length > 0 && goals.every(g => g.kind === GK.SCORE);
  while (moves > 0 && (scoreOnly || !met(goals))) {
    if (!hasMove(B)) { let g = 0; do { shuffleTypes(B); } while (!hasMove(B) && g++ < 50); }
    const m = bestMove(B, goals);
    if (!m) break;
    swapTiles(B, m[0], m[1]);
    moves--;
    const t = blankTally();
    resolve(B, [m[0], m[1]], t);
    score += t.count * 62;
    applyTally(goals, t, score, B);
    for (let b = 0; b < BREEDS.length; b++) {
      const fav = favOf(b, B.types);
      let add = 0;
      for (const k in t.collect) add += (+k === fav ? FAV : OTHER) * t.collect[k];
      charge[b] += add;
      while (charge[b] >= 100) { charge[b] -= 100; fires[b]++; }
    }
  }
  return fires;
}

const first = +(process.argv[2] || 1);
const last = +(process.argv[3] || 60);
const games = +(process.argv[4] || 3);

const total = new Array(BREEDS.length).fill(0);
const byTypes = {};
let levels = 0;
for (let n = first; n <= last; n++) {
  const def = levelDef(n);
  levels++;
  const k = 'types ' + def.types;
  if (!byTypes[k]) byTypes[k] = { n: 0, fires: new Array(BREEDS.length).fill(0) };
  byTypes[k].n++;
  for (let g = 0; g < games; g++) {
    const f = chargeRun(n, n * 104729 + g * 7717);
    for (let b = 0; b < BREEDS.length; b++) { total[b] += f[b] / games; byTypes[k].fires[b] += f[b] / games; }
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log('the pet move, levels ' + first + '-' + last + ', ' + games + ' games each');
console.log('');
console.log(pad('breed', 14) + pad('type', 6) + 'times the meter fills per level');
BREEDS.forEach((b, i) => console.log(pad(b.en, 14) + pad(i, 6) + (total[i] / levels).toFixed(2)));
console.log('');
console.log(pad('', 22) + BREEDS.map(b => pad(b.en.slice(0, 5), 7)).join(''));
Object.keys(byTypes).sort().forEach(k => {
  const g = byTypes[k];
  console.log(pad(k + ' (' + g.n + ' levels)', 22) +
    BREEDS.map((b, i) => pad((g.fires[i] / g.n).toFixed(2), 7)).join(''));
});

/* Judged inside each colour count, not over the run.

   The fault this test was written for lived on the twelve five-colour
   levels, and forty-eight six-colour ones sat on top of it: over the
   whole lane the worst breed still measured 80% of the best, which
   reads as fine. Inside `types 5` it was 33%. A group is the level a
   player is on, so a group is what has to hold. */
console.log('');
let worst = 1;
Object.keys(byTypes).sort().forEach(k => {
  const g = byTypes[k];
  const lo = Math.min.apply(null, g.fires), hi = Math.max.apply(null, g.fires);
  const spread = hi > 0 ? lo / hi : 1;
  worst = Math.min(worst, spread);
  console.log(pad(k, 22) + 'worst breed gets ' + Math.round(spread * 100) + '% of the best');
});
if (worst < 0.8) {
  console.log('FAIL: which breed you adopted decides how often your pet plays');
  process.exitCode = 1;
} else {
  console.log('every breed charges within 20% of every other, on every board');
}
