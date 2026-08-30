/* Headless soak test for the match-3 engine.
   Loads the real util / data / engine modules and hammers them, checking
   the invariants the renderer relies on:
     - a freshly built board never starts with a match
     - after every settle, every open cell holds a tile
     - the board always has a legal move, or shuffles into one
     - goals actually progress and levels are completable
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
require('./_modules.js').CORE.forEach(f => {
  vm.runInContext(read(f).replace(/^'use strict';?$/m, ''), ctx, { filename: f });
});
/* top-level `const` lives in the context's lexical scope, not on the
   context object, so pull the bindings out with an expression */
const X = vm.runInContext(
  '({ makeBoard, findMatches, specialFor, settle, hasMove, allMoves, canSwap,' +
  '   swapTiles, swapMakesMatch, eachCell, openCell, levelDef, starTargets,' +
  '   tilesOfType, commonType, shuffleTypes, spreadBramble, GK, PUP, SP, PUPS_IN_PLAY })', ctx);
const {
  makeBoard, findMatches, specialFor, settle, hasMove, allMoves, canSwap,
  swapTiles, swapMakesMatch, eachCell, openCell, levelDef, starTargets,
  tilesOfType, commonType, shuffleTypes, spreadBramble, GK, PUP, SP, PUPS_IN_PLAY
} = X;

/* ---- a headless mirror of the game's resolve loop ---- */
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
    const tt = type === undefined || type < 0 ? commonType(B) : type;
    tilesOfType(B, tt).forEach(([rr, cc]) => keys.push(rr + ':' + cc));
  }
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
    const next = [];
    out.chain.forEach(s => specialKeys(B, s.r, s.c, s.sp, s.type).forEach(k => next.push(k)));
    wave = next;
  }
}
function resolve(B, swapCells, tally) {
  let guard = 0, chains = 0;
  while (guard++ < 60) {
    const groups = findMatches(B);
    if (!groups.length) break;
    chains++;
    const keys = new Set();
    const specials = [];
    groups.forEach(g => {
      const sp = specialFor(g);
      let at = null;
      if (sp !== SP.NONE) {
        if (swapCells) for (const sc of swapCells) if (g.cells.some(([r, c]) => r === sc[0] && c === sc[1])) { at = sc; break; }
        if (!at) at = g.cells[Math.floor(g.cells.length / 2)];
        specials.push({ r: at[0], c: at[1], sp });
      }
      g.cells.forEach(([r, c]) => { if (!(at && r === at[0] && c === at[1])) keys.add(r + ':' + c); });
    });
    blast(B, keys, tally);
    specials.forEach(s => { const cell = B.cell[s.r][s.c]; if (cell.tile) cell.tile.sp = s.sp; });
    swapCells = null;
    settleFully(B, tally);
  }
  tally.maxChain = Math.max(tally.maxChain, chains);
}
/* mirrors the game: settle, walk pups home, settle again until at rest */
function settleFully(B, tally) {
  for (let d = 0; d < 14; d++) {
    settle(B);
    if (!collectPups(B, tally)) return;
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

/* brambles creep: a move that cut none of them loses another cell,
   exactly as the game does it */
function creep(B, goals, t) {
  if (!goals) return;
  /* goals come through as objects here and plain arrays in the soak */
  const g = goals.find(x => (x.kind !== undefined ? x.kind : x[0]) === GK.BRAMBLE);
  if (!g) return;
  if (g.have !== undefined && g.have >= g.need) return;
  if (t.bram > 0) return;
  spreadBramble(B);
}

/* ---- invariants ---- */
function checkIntegrity(B, where, errs) {
  let empty = 0, bad = 0;
  eachCell(B, (cell, r, c) => {
    if (cell.hole || cell.crate > 0) return;
    if (!cell.tile) empty++;
    else if (cell.tile.type !== PUP && (cell.tile.type < 0 || cell.tile.type >= B.types)) bad++;
  });
  if (empty) errs.push(where + ': ' + empty + ' empty open cells');
  if (bad) errs.push(where + ': ' + bad + ' tiles with an out-of-range type');
  return !empty && !bad;
}

/* ---- level design audit ----
   Rules the table must obey, learnt the hard way from solver runs:
     1. maps are rectangular and match w/h
     2. a mud or crate goal never exceeds what the map holds
     3. a rescue level never blocks a column — a basket cannot fall
        through a hole or an ice lock, and a wide crate row walls it in
*/
let DESIGN_FAILED = false;
function auditLevels() {
  const problems = [];
  const LV = vm.runInContext('LEVELS', ctx);
  const stockOf = vm.runInContext('mapStock', ctx);
  LV.forEach(d => {
    if (d.map) {
      if (d.map.length !== d.h) problems.push('L' + d.n + ': ' + d.map.length + ' map rows, h=' + d.h);
      d.map.forEach((r, i) => {
        if (r.length !== d.w) problems.push('L' + d.n + ' row ' + i + ': width ' + r.length + ', w=' + d.w);
      });
    }
    const stock = stockOf(d);
    d.goals.forEach(g => {
      if (g[0] === GK.COLLECT && g[1] >= d.types) {
        problems.push('L' + d.n + ': collect goal names colour ' + g[1] +
          ' but the board only deals 0-' + (d.types - 1) + ' — unwinnable');
      }
      if (g[0] === GK.MUD && g[2] > stock.mud) problems.push('L' + d.n + ': mud goal ' + g[2] + ' > ' + stock.mud + ' in map');
      if (g[0] === GK.CRATE && g[2] > stock.crate) problems.push('L' + d.n + ': crate goal ' + g[2] + ' > ' + stock.crate + ' in map');
    });
    auditReachable(d, 'L' + d.n, problems);
    if (d.goals.some(g => g[0] === GK.RESCUE) && d.map) {
      const joined = d.map.join('');
      const blockers = (joined.match(/[#i]/g) || []).length;
      if (blockers) problems.push('L' + d.n + ': rescue level has ' + blockers + ' holes/ice — baskets get trapped');
      let widest = 0;
      d.map.forEach(r => { let run = 0; for (const ch of r) { if (ch === 'c' || ch === 'C') { run++; widest = Math.max(widest, run); } else run = 0; } });
      if (widest >= 4) problems.push('L' + d.n + ': rescue level has a ' + widest + '-wide crate wall');
    }
  });
  return problems;
}

/* What good play actually reaches in a move, measured with the solver
   in test/ai.js and given headroom on top. Mud and crates are absent on
   purpose: their goals are already clamped to what the map holds, which
   binds tighter than any rate could.

   The numbers are per move. Chasing two colours is worth much more than
   twice one of them on five colours, because a board with one colour
   fewer cascades far further — that is measurement, not arithmetic. */
const CEILING = {
  one:   { 5: 3.2,  6: 2.2 },   /* one named colour   */
  two:   { 5: 7.3,  6: 3.4 },   /* two at once        */
  three: { 5: 10.9, 6: 5.1 },   /* three              */
  /* A level whose only goal is a score plays out all of its moves, so it
     can reach far more than one that stops as soon as its other goals
     are met. Measured, the top tenth of games run to about 1,030 a move. */
  score: 620,
  scoreOnly: 1150
};
function auditReachable(d, label, problems) {
  const named = d.goals.filter(g => g[0] === GK.COLLECT);
  d.goals.forEach(g => {
    if (g[0] === GK.SCORE) {
      const only = d.goals.every(x => x[0] === GK.SCORE);
      const cap = only ? CEILING.scoreOnly : CEILING.score;
      if (g[2] > d.moves * cap) {
        problems.push(label + ': score goal ' + g[2] + ' wants ' +
          Math.round(g[2] / d.moves) + ' a move; ' + cap + ' is the most anyone gets');
      }
    }
  });
  if (!named.length) return;
  const tbl = named.length >= 3 ? CEILING.three
    : named.length === 2 ? CEILING.two : CEILING.one;
  const rate = tbl[d.types] || tbl[6];
  const total = named.reduce((n, g) => n + g[2], 0);
  if (total > d.moves * rate) {
    problems.push(label + ': collect goals total ' + total + ' but ' + d.moves +
      ' moves turn up at most about ' + Math.round(d.moves * rate) +
      ' across ' + named.length + ' colour(s) on a ' + d.types + '-colour board');
  }
}

/* the generated run is most of the levels anyone plays, so audit it too */
function auditGenerated(first, last) {
  const problems = [];
  const def = vm.runInContext('levelDef', ctx);
  const stockOf = vm.runInContext('mapStock', ctx);
  for (let n = first; n <= last; n++) {
    const d = def(n);
    const label = 'gen L' + n;
    if (d.map) {
      if (d.map.length !== d.h) problems.push(label + ': ' + d.map.length + ' map rows, h=' + d.h);
      d.map.forEach((r, i) => { if (r.length !== d.w) problems.push(label + ' row ' + i + ': width ' + r.length); });
    }
    const stock = stockOf(d);
    d.goals.forEach(g => {
      if (g[0] === GK.COLLECT && g[1] >= d.types) {
        problems.push(label + ': collect goal names colour ' + g[1] + ' on a ' + d.types + '-colour board');
      }
      if (g[0] === GK.MUD && g[2] > stock.mud) problems.push(label + ': mud goal ' + g[2] + ' > ' + stock.mud);
      if (g[0] === GK.CRATE && g[2] > stock.crate) problems.push(label + ': crate goal ' + g[2] + ' > ' + stock.crate);
    });
    if (d.goals.some(g => g[0] === GK.RESCUE) && d.map) {
      const blockers = (d.map.join('').match(/[#i]/g) || []).length;
      if (blockers) problems.push(label + ': rescue level has ' + blockers + ' holes/ice');
    }
    auditReachable(d, label, problems);
  }
  return problems;
}

/* The daily walk is a second copy of the generator and drifts out of
   step with the first one in silence. Walk a year of them, at four
   points of progress, and audit each the way a lane level is audited. */
function auditDaily() {
  const problems = [];
  const daily = vm.runInContext('dailyLevel', ctx);
  const stockOf = vm.runInContext('mapStock', ctx);
  let built = 0;
  for (let day = 20000; day < 20366; day++) {
    for (const reached of [1, 20, 45, 60, 140]) {
      let d;
      try { d = daily(reached, day); }
      catch (e) {
        problems.push('daily day ' + day + ' at level ' + reached + ' threw: ' + e.message);
        continue;
      }
      built++;
      const label = 'daily d' + day + '/L' + reached;
      if (!d.map || d.map.length !== d.h) { problems.push(label + ': map is not ' + d.h + ' rows'); continue; }
      if (d.map.some(r => r.length !== d.w)) { problems.push(label + ': a row is not ' + d.w + ' wide'); continue; }
      if (!d.goals.length) problems.push(label + ': no goals');
      const stock = stockOf(d);
      d.goals.forEach(g => {
        if (g[0] === GK.COLLECT && g[1] >= d.types) problems.push(label + ': collect colour ' + g[1] + ' of ' + d.types);
        if (g[0] === GK.MUD && g[2] > stock.mud) problems.push(label + ': mud goal over stock');
        if (g[0] === GK.CRATE && g[2] > stock.crate) problems.push(label + ': crate goal over stock');
        if (g[2] <= 0) problems.push(label + ': a goal asks for ' + g[2]);
      });
      auditReachable(d, label, problems);
    }
  }
  if (!built) problems.push('no daily boards were built at all');
  return problems;
}

const designProblems = auditLevels();
/* three hundred levels of the endless run is far past where anyone
   reaches, which is the point: the numbers must hold at the top tier
   and then stop */
const genProblems = auditGenerated(61, 360);
const dailyProblems = auditDaily();
const allProblems = designProblems.concat(genProblems, dailyProblems);
if (allProblems.length) {
  console.log('LEVEL DESIGN PROBLEMS (' + allProblems.length + '):');
  allProblems.slice(0, 24).forEach(p => console.log('  ' + p));
  if (allProblems.length > 24) console.log('  ... and ' + (allProblems.length - 24) + ' more');
  console.log('');
  DESIGN_FAILED = true;
} else console.log('level design audit: clean (60 handcrafted + 300 generated + a year of dailies)');

/* ---- run ---- */
const LEVELS_TO_TEST = 60;
const RUNS_PER_LEVEL = 6;
let errors = [], stats = { boards: 0, moves: 0, shuffles: 0, cleared: 0, attempts: 0 };
const goalKinds = {};

for (let n = 1; n <= LEVELS_TO_TEST; n++) {
  const def = levelDef(n);
  def.goals.forEach(g => { goalKinds[g[0]] = (goalKinds[g[0]] || 0) + 1; });

  for (let run = 0; run < RUNS_PER_LEVEL; run++) {
    const B = makeBoard(def, n * 104729 + run * 7717);
    B.pupQueue = 0;
    stats.boards++;
    if (findMatches(B).length) errors.push('L' + n + ' r' + run + ': board starts with a match');
    checkIntegrity(B, 'L' + n + ' r' + run + ' init', errors);

    /* seed rescue pups the way the game does */
    const rescueGoal = def.goals.find(g => g[0] === GK.RESCUE);
    if (rescueGoal) {
      for (let i = 0; i < Math.min(PUPS_IN_PLAY, rescueGoal[2] + 2); i++) {
        const spots = [];
        for (let c = 0; c < B.w; c++) for (let r = Math.min(2, B.h - 1); r < Math.min(5, B.h); r++) {
          const cell = openCell(B, r, c);
          if (cell && cell.tile && cell.tile.type >= 0 && cell.tile.sp === SP.NONE && cell.ice === 0) { spots.push(cell); break; }
        }
        if (spots.length) spots[(Math.random() * spots.length) | 0].tile.type = PUP;
      }
    }

    const tally = { collect: {}, mud: 0, crate: 0, bram: 0, count: 0, rescued: 0, maxChain: 0, score: 0 };
    let moves = def.moves;
    stats.attempts++;
    while (moves > 0) {
      if (!hasMove(B)) {
        let g = 0;
        do { shuffleTypes(B); } while (!hasMove(B) && g++ < 50);
        stats.shuffles++;
        if (g >= 50) { errors.push('L' + n + ' r' + run + ': could not shuffle into a move'); break; }
        resolve(B, null, tally);
      }
      const ms = allMoves(B);
      if (!ms.length) { errors.push('L' + n + ' r' + run + ': hasMove true but allMoves empty'); break; }
      const m = ms[(Math.random() * ms.length) | 0];
      if (!canSwap(B, m[0], m[1])) { errors.push('L' + n + ': allMoves returned an illegal swap'); break; }
      swapTiles(B, m[0], m[1]);
      moves--; stats.moves++;
      const before = tally.bram;
      resolve(B, [m[0], m[1]], tally);
      creep(B, def.goals, { bram: tally.bram - before });
      if (!checkIntegrity(B, 'L' + n + ' r' + run + ' after move', errors)) break;
    }
    tally.score = tally.count * 62;
    const met = def.goals.every(g => {
      if (g[0] === GK.SCORE) return tally.score >= g[2] * 0.35;   // score pace, loosely
      if (g[0] === GK.COLLECT) return (tally.collect[g[1]] || 0) >= g[2];
      if (g[0] === GK.MUD) return tally.mud >= g[2];
      if (g[0] === GK.CRATE) return tally.crate >= g[2];
      if (g[0] === GK.RESCUE) return tally.rescued >= g[2];
      return true;
    });
    if (met) stats.cleared++;
  }
}

console.log('boards built      ', stats.boards);
console.log('moves simulated   ', stats.moves);
console.log('forced shuffles   ', stats.shuffles);
console.log('goal kinds seen   ', JSON.stringify(goalKinds));
console.log('random-play clears', stats.cleared + '/' + stats.attempts,
  '(' + Math.round(stats.cleared / stats.attempts * 100) + '% — random play, not skilled play)');
console.log('');
if (errors.length || DESIGN_FAILED) {
  console.log('FAILURES (' + errors.length + '):');
  const lv = {};
  errors.forEach(e => { const m = e.match(/^L(\d+)/); const n = m ? +m[1] : 0; (lv[n] = lv[n] || []).push(e); });
  Object.keys(lv).map(Number).sort((a, b) => a - b).forEach(n => {
    const def = levelDef(n);
    console.log('  L' + n + ' [' + def.goals.map(g => g[0]).join(',') + '] x' + lv[n].length + '  e.g. ' + lv[n][0]);
  });
  process.exitCode = 1;
} else {
  console.log('ALL INVARIANTS HELD');
}
