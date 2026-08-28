/* brambles creep: the patch takes one more cell every BRAMBLE_EVERY
   moves, exactly as the game does it */
let creepTick = 0;
function creep(B, goals, t) {
  const g = goals.find(x => (x.kind !== undefined ? x.kind : x[0]) === GK.BRAMBLE);
  if (!g) return;
  if (brambleCount(B) === 0) return;
  creepTick++;
  if (creepTick % BRAMBLE_EVERY !== 0) return;
  spreadBramble(B);
}

/* Difficulty tuner.

   For each level it lets the solver play with a generous move budget and
   records how many moves it actually needs. A level is well-tuned when a
   strong player needs roughly TARGET of the budget: enough slack to
   recover from a bad board, not so much that the level ends on move three.

   Prints a corrected level table. It does not write anything itself.

   Usage: node test/tune.js [first] [last] [runs]
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsDir = path.join(__dirname, '..', 'src', 'js');
const read = f => fs.readFileSync(path.join(jsDir, f), 'utf8');
const ctx = {
  console, SP: { NONE: 0, ROW: 1, COL: 2, BOMB: 3, RAIN: 4 },
  document: { createElement: () => ({ getContext: () => ({}) }) },
  window: { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 },
  performance: { now: () => Date.now() }, navigator: { language: 'en' },
  requestAnimationFrame: fn => 0, setTimeout, clearTimeout, Math, Date, JSON
};
vm.createContext(ctx);
['00-util.js', '10-data.js', '30-engine.js'].forEach(f =>
  vm.runInContext(read(f).replace(/^'use strict';?$/m, ''), ctx, { filename: f }));
const E = vm.runInContext(
  '({ makeBoard, findMatches, specialFor, settle, hasMove, allMoves, swapTiles,' +
  '   openCell, levelDef, mapStock, tilesOfType, commonType, shuffleTypes, spreadBramble, brambleCount, BRAMBLE_EVERY,' +
  '   mulberry, GK, PUP, SP, LEVELS, PUPS_IN_PLAY })', ctx);
const {
  makeBoard, findMatches, specialFor, settle, hasMove, allMoves, swapTiles,
  openCell, levelDef, mapStock, tilesOfType, commonType, shuffleTypes, spreadBramble, brambleCount, BRAMBLE_EVERY,
  mulberry, GK, PUP, SP, LEVELS, PUPS_IN_PLAY
} = E;

/* ---- shared sim core (same as ai.js) ---- */
let cloneSeq = 1;
function cloneBoard(B) {
  const C = { w: B.w, h: B.h, types: B.types, def: B.def, exits: B.exits, pupQueue: B.pupQueue || 0, rng: mulberry((cloneSeq++ * 2654435761) >>> 0), cell: [] };
  for (let r = 0; r < B.h; r++) {
    const row = [];
    for (let c = 0; c < B.w; c++) {
      const s = B.cell[r][c];
      row.push({ hole: s.hole, crate: s.crate, mud: s.mud, ice: s.ice, bram: s.bram, r, c, tile: s.tile ? { id: s.tile.id, type: s.tile.type, sp: s.tile.sp, x: 0, y: 0, dying: 0 } : null });
    }
    C.cell.push(row);
  }
  return C;
}
function hitCell(B, r, c, out, touched) {
  const cell = B.cell[r] && B.cell[r][c];
  if (!cell || cell.hole) return;
  const k = r + ':' + c; if (touched.has(k)) return; touched.add(k);
  if (cell.crate > 0) { cell.crate--; if (!cell.crate) out.crate++; return; }
  if (cell.ice > 0) { cell.ice--; return; }
  const t = cell.tile; if (!t || t.type === PUP) return;
  if (t.sp !== SP.NONE) out.chain.push({ r, c, sp: t.sp, type: t.type });
  cell.tile = null; out.count++;
  out.collect[t.type] = (out.collect[t.type] || 0) + 1;
  if (cell.mud > 0) { cell.mud--; out.mud++; }
  if (cell.bram > 0) { cell.bram--; out.bram++; }
  [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([a, b]) => {
    const n = B.cell[a] && B.cell[a][b];
    if (n && n.crate > 0) { n.crate--; if (!n.crate) out.crate++; }
  });
}
function specialKeys(B, r, c, sp, type) {
  const keys = [];
  if (sp === SP.ROW) for (let i = 0; i < B.w; i++) keys.push(r + ':' + i);
  else if (sp === SP.COL) for (let i = 0; i < B.h; i++) keys.push(i + ':' + c);
  else if (sp === SP.BOMB) { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) keys.push((r + dr) + ':' + (c + dc)); }
  else if (sp === SP.RAIN) { const tt = (type === undefined || type < 0) ? commonType(B) : type; tilesOfType(B, tt).forEach(([a, b]) => keys.push(a + ':' + b)); }
  return keys;
}
function blast(B, keys, tally) {
  let wave = Array.from(keys), guard = 0;
  while (wave.length && guard++ < 24) {
    const out = { chain: [], collect: {}, mud: 0, crate: 0, bram: 0, count: 0 };
    const touched = new Set();
    wave.forEach(k => { const [r, c] = k.split(':').map(Number); hitCell(B, r, c, out, touched); });
    tally.mud += out.mud; tally.crate += out.crate; tally.bram += out.bram; tally.count += out.count;
    for (const k in out.collect) tally.collect[k] = (tally.collect[k] || 0) + out.collect[k];
    const next = []; out.chain.forEach(s => specialKeys(B, s.r, s.c, s.sp, s.type).forEach(k => next.push(k)));
    wave = next;
  }
}
function collectPups(B, tally) {
  let got = 0;
  for (let c = 0; c < B.w; c++) {
    const r = B.exits[c]; if (r < 0) continue;
    const cell = B.cell[r][c];
    if (cell.tile && cell.tile.type === PUP) { cell.tile = null; tally.rescued++; B.pupQueue = (B.pupQueue || 0) + 1; got++; }
  }
  return got;
}
function settleFully(B, t) { for (let d = 0; d < 14; d++) { settle(B); if (!collectPups(B, t)) return; } }
function resolve(B, swapCells, tally) {
  let guard = 0;
  while (guard++ < 60) {
    const groups = findMatches(B); if (!groups.length) break;
    const keys = new Set(), specials = [];
    groups.forEach(g => {
      const sp = specialFor(g); let at = null;
      if (sp !== SP.NONE) {
        if (swapCells) for (const sc of swapCells) if (g.cells.some(([r, c]) => r === sc[0] && c === sc[1])) { at = sc; break; }
        if (!at) at = g.cells[Math.floor(g.cells.length / 2)];
        specials.push({ r: at[0], c: at[1], sp }); tally.made++;
      }
      g.cells.forEach(([r, c]) => { if (!(at && r === at[0] && c === at[1])) keys.add(r + ':' + c); });
    });
    blast(B, keys, tally);
    specials.forEach(s => { const cell = B.cell[s.r][s.c]; if (cell.tile) cell.tile.sp = s.sp; });
    swapCells = null; settleFully(B, tally);
  }
}
const blank = () => ({ collect: {}, mud: 0, crate: 0, bram: 0, count: 0, rescued: 0, made: 0 });
const met = g => g.every(x => x.have >= x.need);
function applyTally(goals, t, score, B) {
  goals.forEach(g => {
    if (g.kind === GK.COLLECT) g.have += t.collect[g.arg] || 0;
    else if (g.kind === GK.MUD) g.have += t.mud;
    else if (g.kind === GK.CRATE) g.have += t.crate;
    else if (g.kind === GK.BRAMBLE) g.have = Math.max(0, g.need - brambleCount(B));
    else if (g.kind === GK.BRAMBLE) g.have = Math.max(0, g.need - brambleCount(B));
    else if (g.kind === GK.RESCUE) g.have += t.rescued;
    else if (g.kind === GK.SCORE) g.have = score;
  });
}
function scoreMove(goals, t, gain) {
  let v = 0;
  goals.forEach(g => {
    const left = Math.max(0, g.need - g.have); if (left <= 0) return;
    let got = 0;
    if (g.kind === GK.COLLECT) got = t.collect[g.arg] || 0;
    else if (g.kind === GK.MUD) got = t.mud;
    else if (g.kind === GK.CRATE) got = t.crate;
    else if (g.kind === GK.BRAMBLE) got = t.bram * 2;
    else if (g.kind === GK.BRAMBLE) got = t.bram;
    else if (g.kind === GK.RESCUE) got = t.rescued * 8;
    else if (g.kind === GK.SCORE) got = gain / 260;
    v += Math.min(got, left) * 10;
  });
  return v + t.count * .35 + t.made * 6;
}
function bestMove(B, goals) {
  const moves = allMoves(B); if (!moves.length) return null;
  let best = null, bv = -1;
  for (const m of moves) {
    const C = cloneBoard(B); swapTiles(C, m[0], m[1]);
    const t = blank(); resolve(C, [m[0], m[1]], t);
    const v = scoreMove(goals, t, t.count * 62);
    if (v > bv) { bv = v; best = m; }
  }
  return best;
}

/* ---- play with a generous budget; report moves needed ---- */
function movesNeeded(def, goalsSpec, seed, cap) {
  const B = makeBoard(def, seed); B.pupQueue = 0;
  const goals = goalsSpec.map(g => ({ kind: g[0], arg: g[1], need: g[2], have: 0 }));
  const rescue = goalsSpec.find(g => g[0] === GK.RESCUE);
  if (rescue) {
    for (let i = 0; i < Math.min(PUPS_IN_PLAY, rescue[2] + 2); i++) {
      const spots = [];
      for (let c = 0; c < B.w; c++) for (let r = Math.min(2, B.h - 1); r < Math.min(5, B.h); r++) {
        const cell = openCell(B, r, c);
        if (cell && cell.tile && cell.tile.type >= 0 && cell.tile.sp === SP.NONE && cell.ice === 0) { spots.push(cell); break; }
      }
      if (spots.length) spots[(Math.random() * spots.length) | 0].tile.type = PUP;
    }
  }
  creepTick = 0;
  let used = 0, score = 0, cleared = 0;
  while (used < cap && !met(goals)) {
    if (!hasMove(B)) {
      let g = 0; do { shuffleTypes(B); } while (!hasMove(B) && g++ < 50);
      const t = blank(); resolve(B, null, t); score += t.count * 62; cleared += t.count; applyTally(goals, t, score, B);
      continue;
    }
    const m = bestMove(B, goals); if (!m) break;
    swapTiles(B, m[0], m[1]); used++;
    const t = blank(); resolve(B, [m[0], m[1]], t);
    score += t.count * 62; cleared += t.count;
    applyTally(goals, t, score, B);
    creep(B, goals, t);
  }
  return { used: met(goals) ? used : Infinity, score, perMove: cleared / Math.max(1, used) };
}
const median = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };

/* ---- tune ---- */
const TARGET = 0.72;                 // solver should need ~72% of the budget
const A = +(process.argv[2] || 1), Bn = +(process.argv[3] || 40), RUNS = +(process.argv[4] || 7);

console.log('lvl  kind        moves  needed  perMove  ->  suggestion');
console.log('---  ----------  -----  ------  -------  --  ----------');
const out = [];
for (let n = A; n <= Bn; n++) {
  const def = levelDef(n);
  const stock = mapStock(def);
  const cap = Math.max(60, def.moves * 3);
  const needs = [], pers = [];
  for (let i = 0; i < RUNS; i++) {
    const r = movesNeeded(def, def.goals, n * 104729 + i * 7717, cap);
    needs.push(r.used); pers.push(r.perMove);
  }
  const finite = needs.filter(x => isFinite(x));
  const need = finite.length ? median(finite) : Infinity;
  const perMove = median(pers);
  const want = def.moves * TARGET;

  /* what can be scaled: collect and score counts, and rescue counts.
     mud and crate are bounded by the map, so those move the move-count. */
  const scalable = def.goals.some(g => g[0] === GK.COLLECT || g[0] === GK.SCORE || g[0] === GK.RESCUE);
  const bounded = def.goals.some(g => g[0] === GK.MUD || g[0] === GK.CRATE);

  let newGoals = def.goals.map(g => g.slice());
  let newMoves = def.moves;
  let note = 'ok';

  if (!isFinite(need)) {
    note = 'unreachable — easing';
    newGoals = newGoals.map(g => (g[0] === GK.COLLECT || g[0] === GK.SCORE || g[0] === GK.RESCUE) ? [g[0], g[1], Math.max(1, Math.round(g[2] * .6))] : g);
    newMoves = def.moves + 6;
  } else {
    const f = want / Math.max(1, need);
    if (f > 1.15 || f < .85) {
      if (scalable) {
        newGoals = newGoals.map(g => {
          if (g[0] === GK.COLLECT) return [g[0], g[1], Math.max(8, Math.round(g[2] * f))];
          if (g[0] === GK.SCORE) return [g[0], g[1], Math.max(1500, Math.round(g[2] * f / 100) * 100)];
          if (g[0] === GK.RESCUE) return [g[0], g[1], Math.max(2, Math.min(14, Math.round(g[2] * f)))];
          return g;
        });
        note = 'goals x' + f.toFixed(2);
      }
      if (bounded && !scalable) {
        newMoves = Math.max(10, Math.round(need / TARGET));
        note = 'moves ' + def.moves + '->' + newMoves;
      } else if (bounded && scalable) {
        note += ' (mud/crate fixed by map)';
      }
    }
  }
  /* a score goal should track what the board can actually produce */
  const base = Math.round(perMove * 62 * newMoves * .62 / 100) * 100;

  out.push({ n, goals: newGoals, moves: newMoves, base });
  console.log(
    String(n).padEnd(5) +
    def.goals.map(g => g[0]).join('+').padEnd(12).slice(0, 12) +
    String(def.moves).padStart(5) +
    String(isFinite(need) ? need : '--').padStart(8) +
    perMove.toFixed(1).padStart(9) + '  ->  ' + note);
}

console.log('\n/* ---- suggested numbers ---- */');
out.forEach(o => {
  console.log('L' + o.n + ': moves=' + o.moves + '  base=' + o.base +
    '  goals=' + JSON.stringify(o.goals));
});
