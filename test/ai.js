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

/* Difficulty probe.

   Plays every level with a greedy one-ply solver that behaves roughly
   like an attentive human: it tries each legal swap, resolves it on a
   copy of the board, and keeps the one that moves the goals furthest.

   Random play says nothing about whether a level is fair. This does.

   Usage:  node test/ai.js [firstLevel] [lastLevel] [gamesPerLevel]
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
  vm.runInContext(read(f).replace(/^'use strict';?$/m, ''), ctx, { filename: f }));

const X = vm.runInContext(
  '({ makeBoard, findMatches, specialFor, settle, hasMove, allMoves, canSwap,' +
  '   swapTiles, eachCell, openCell, levelDef, starTargets, tilesOfType,' +
  '   commonType, shuffleTypes, spreadBramble, brambleCount, BRAMBLE_EVERY, mulberry, GK, PUP, SP, PUPS_IN_PLAY })', ctx);
const {
  makeBoard, findMatches, specialFor, settle, hasMove, allMoves, canSwap,
  swapTiles, eachCell, openCell, levelDef, starTargets, tilesOfType,
  commonType, shuffleTypes, spreadBramble, brambleCount, BRAMBLE_EVERY, mulberry, GK, PUP, SP, PUPS_IN_PLAY
} = X;

/* ---------------- board copy ---------------- */
let cloneSeq = 1;
function cloneBoard(B) {
  const C = {
    w: B.w, h: B.h, types: B.types, def: B.def,
    exits: B.exits, pupQueue: B.pupQueue || 0,
    rng: mulberry(cloneSeq++ * 2654435761 >>> 0),
    cell: []
  };
  for (let r = 0; r < B.h; r++) {
    const row = [];
    for (let c = 0; c < B.w; c++) {
      const s = B.cell[r][c];
      row.push({
        hole: s.hole, crate: s.crate, mud: s.mud, ice: s.ice, bram: s.bram, r, c,
        tile: s.tile ? { id: s.tile.id, type: s.tile.type, sp: s.tile.sp, x: 0, y: 0, dying: 0 } : null
      });
    }
    C.cell.push(row);
  }
  return C;
}

/* ---------------- headless resolve (mirrors the game) ---------------- */
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
    wave.forEach(k => { const [r, c] = k.split(':').map(Number); hitCell(B, r, c, out, touched); });
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
function settleFully(B, tally) {
  for (let d = 0; d < 14; d++) { settle(B); if (!collectPups(B, tally)) return; }
}
function resolve(B, swapCells, tally) {
  let guard = 0;
  while (guard++ < 60) {
    const groups = findMatches(B);
    if (!groups.length) break;
    const keys = new Set();
    const specials = [];
    groups.forEach(g => {
      const sp = specialFor(g);
      let at = null;
      if (sp !== SP.NONE) {
        if (swapCells) for (const sc of swapCells) if (g.cells.some(([r, c]) => r === sc[0] && c === sc[1])) { at = sc; break; }
        if (!at) at = g.cells[Math.floor(g.cells.length / 2)];
        specials.push({ r: at[0], c: at[1], sp });
        tally.made++;
      }
      g.cells.forEach(([r, c]) => { if (!(at && r === at[0] && c === at[1])) keys.add(r + ':' + c); });
    });
    blast(B, keys, tally);
    specials.forEach(s => { const cell = B.cell[s.r][s.c]; if (cell.tile) cell.tile.sp = s.sp; });
    swapCells = null;
    settleFully(B, tally);
  }
}
const blankTally = () => ({ collect: {}, mud: 0, crate: 0, bram: 0, count: 0, rescued: 0, made: 0 });

/* ---------------- goal bookkeeping ---------------- */
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
const remaining = goals => goals.reduce((a, g) => a + Math.max(0, g.need - g.have), 0);
const met = goals => goals.every(g => g.have >= g.need);

/* ---------------- the solver ---------------- */
/* value a candidate move by how much of what is still needed it delivers */
function scoreMove(goals, tally, scoreGain) {
  let v = 0;
  goals.forEach(g => {
    const left = Math.max(0, g.need - g.have);
    if (left <= 0) return;
    let got = 0;
    if (g.kind === GK.COLLECT) got = tally.collect[g.arg] || 0;
    else if (g.kind === GK.MUD) got = tally.mud;
    else if (g.kind === GK.CRATE) got = tally.crate;
    else if (g.kind === GK.BRAMBLE) got = tally.bram * 2;
    else if (g.kind === GK.RESCUE) got = tally.rescued * 8;      // rescues are scarce
    else if (g.kind === GK.SCORE) got = scoreGain / 260;
    v += Math.min(got, left) * 10;
  });
  v += tally.count * 0.35;        // clearing is never bad
  v += tally.made * 6;            // specials pay off later
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
    const v = scoreMove(goals, t, t.count * 62);
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}

/* ---------------- play one game ---------------- */
function playLevel(n, seed, defOverride) {
  const def = defOverride || levelDef(n);
  const B = makeBoard(def, seed);
  B.pupQueue = 0;
  const goals = mkGoals(def);
  const rescue = def.goals.find(g => g[0] === GK.RESCUE);
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
  /* PERKS models the pet the player actually brings to a level. The room
     is not decoration: a well-kept pet hands the board +2 moves for
     food, +12% score for a bath, a rocket for being rested, and its
     stage adds up to two more moves. Every difficulty figure in this
     file was measured on a bare pet, which is the floor, not the case.
       PERKS=0   bare pet (the floor)
       PERKS=1   a cared-for pet: +4 moves, x1.12 score, one rocket
     The 35%-charge perk is deliberately not modelled — that fires the
     breed ability, which the solver has no notion of. So PERKS=1 is
     itself a lower bound on a cared-for pet. */
  const perked = +process.env.PERKS || 0;
  if (perked) {
    /* an energetic pet leaves a rocket lying about */
    const spots = [];
    for (let rr = 0; rr < B.h; rr++) for (let cc = 0; cc < B.w; cc++) {
      const cell = B.cell[rr][cc];
      if (cell && cell.tile && cell.tile.type >= 0 && cell.ice === 0) spots.push(cell);
    }
    if (spots.length) {
      const cell = spots[(Math.random() * spots.length) | 0];
      cell.tile.sp = Math.random() < .5 ? SP.ROW : SP.COL;
    }
  }
  const scoreMul = perked ? 1.12 : 1;
  let moves = def.moves + (+process.env.BONUS || 0) + (perked ? 4 : 0), score = 0, used = 0;
  /* the game plays a score-only level out to the end of its moves,
     because there the goal and the star metric are the same quantity */
  const scoreOnly = goals.length > 0 && goals.every(g => g.kind === GK.SCORE);
  while (moves > 0 && (scoreOnly || !met(goals))) {
    if (!hasMove(B)) {
      let g = 0;
      do { shuffleTypes(B); } while (!hasMove(B) && g++ < 50);
      const t = blankTally(); resolve(B, null, t);
      score += Math.round(t.count * 62 * scoreMul); applyTally(goals, t, score, B);
      continue;
    }
    const m = bestMove(B, goals);
    if (!m) break;
    swapTiles(B, m[0], m[1]);
    moves--; used++;
    const t = blankTally();
    resolve(B, [m[0], m[1]], t);
    score += Math.round(t.count * 62 * scoreMul);
    applyTally(goals, t, score, B);
    creep(B, goals, t);
  }
  const stars = starTargets(def);
  let s = 0;
  stars.forEach((v, i) => { if (score >= v) s = i + 1; });
  return { won: met(goals), score, stars: s, movesUsed: used, movesLeft: moves, goals };
}

/* ---------------- run ---------------- */
/* AI_PROBE={"types":6,"moves":30,"goals":[["collect",0,46],["collect",1,42]]}
   plays a board written by hand, so one thing can be varied at a time. */
if (process.env.AI_PROBE) {
  const spec = JSON.parse(process.env.AI_PROBE);
  const w = spec.w || 8, h = spec.h || 9;
  const def = {
    n: 9001, w, h,
    types: spec.types || 6,
    moves: spec.moves || 30,
    base: spec.base || 11500,
    goals: spec.goals,
    map: spec.map || new Array(h).fill('.'.repeat(w))
  };
  const runs = spec.runs || 12;
  let wins = 0; const used = [];
  for (let i = 0; i < runs; i++) {
    const r = playLevel(9001, 991 + i * 7717, JSON.parse(JSON.stringify(def)));
    if (r.won) { wins++; used.push(r.movesUsed); }
  }
  used.sort((a, b) => a - b);
  console.log((spec.label || '') .padEnd(34) +
    (Math.round(wins / runs * 100) + '%').padStart(5) +
    '   median moves used ' + (used.length ? used[used.length >> 1] : '-') + '/' + def.moves);
  process.exit(0);
}
if (process.env.AI_TRACE) {
  const n = +process.env.AI_TRACE;
  const def = levelDef(n);
  console.log('level ' + n + '  moves=' + def.moves + '  goals=' + JSON.stringify(def.goals));
  for (let i = 0; i < 6; i++) {
    const r = playLevel(n, n * 104729 + i * 7717);
    console.log('  run' + i + '  won=' + r.won + '  used=' + r.movesUsed + '  left=' + r.movesLeft +
      '  score=' + r.score + '  goals=' + r.goals.map(g => g.kind + ' ' + g.have + '/' + g.need).join(' | '));
  }
  process.exit(0);
}
/* SCOREDIST=1 prints the spread of final scores on the score-only
   levels, which is the only way to set their two thresholds: on those
   levels the goal and the star metric are the same number, so both have
   to come from what a full budget actually produces. */
if (process.env.SCOREDIST) {
  const runs = +(process.argv[4] || 16);
  const rows = [];
  for (let n = +(process.argv[2] || 1); n <= +(process.argv[3] || 60); n++) {
    const def = levelDef(n);
    if (!def.goals.every(g => g[0] === GK.SCORE) || !def.goals.length) continue;
    const scores = [];
    for (let i = 0; i < runs; i++) scores.push(playLevel(n, n * 104729 + i * 7717).score);
    scores.sort((a, b) => a - b);
    const at = q => scores[Math.min(scores.length - 1, Math.floor(scores.length * q))];
    rows.push({ n, moves: def.moves, goal: def.goals[0][2], base: def.base,
      p30: at(.30), p50: at(.50), p60: at(.60), p90: at(.90) });
  }
  console.log('lvl  moves   goal   base |   p30    p50    p60    p90');
  rows.forEach(r => console.log(
    String(r.n).padEnd(4) + String(r.moves).padStart(5) + String(r.goal).padStart(7) +
    String(r.base).padStart(7) + ' |' + String(r.p30).padStart(7) + String(r.p50).padStart(7) +
    String(r.p60).padStart(7) + String(r.p90).padStart(7)));
  process.exit(0);
}

/* KINDS=1 breaks the clear rate down by what the level asks for. A
   generated level cannot be tuned one at a time — each is a seed — so
   the question is whether a whole kind is off, which per-level noise
   hides completely. */
if (process.env.KINDS) {
  const first = +(process.argv[2] || 61), last = +(process.argv[3] || 160), runs = +(process.argv[4] || 8);
  const byKind = {};
  for (let n = first; n <= last; n++) {
    const def = levelDef(n);
    const kind = def.goals[0][0];
    const row = byKind[kind] || (byKind[kind] = { levels: 0, games: 0, wins: 0, spare: [], stars3: 0 });
    row.levels++;
    for (let i = 0; i < runs; i++) {
      const r = playLevel(n, n * 104729 + i * 7717);
      row.games++;
      if (r.won) { row.wins++; row.spare.push(r.movesLeft / def.moves); }
      if (r.stars === 3) row.stars3++;
    }
  }
  console.log('levels ' + first + '-' + last + ', ' + runs + ' games each');
  console.log('kind      levels  clear%  3star%  spare budget');
  console.log('--------  ------  ------  ------  ------------');
  Object.keys(byKind).sort().forEach(k => {
    const r = byKind[k];
    r.spare.sort((a, b) => a - b);
    const med = r.spare.length ? r.spare[r.spare.length >> 1] : 0;
    console.log(k.padEnd(10) +
      String(r.levels).padStart(5) + '  ' +
      (Math.round(r.wins / r.games * 100) + '%').padStart(6) + '  ' +
      (Math.round(r.stars3 / r.games * 100) + '%').padStart(6) + '  ' +
      (Math.round(med * 100) + '%').padStart(8));
  });
  process.exit(0);
}

/* STARS=1 prints how the three tiers actually divide up. A star tier
   nobody lands on is a tier that is not doing anything. */
if (process.env.STARS) {
  const first = +(process.argv[2] || 1), last = +(process.argv[3] || 60), runs = +(process.argv[4] || 8);
  const tally = [0, 0, 0, 0];
  let wins = 0, games = 0;
  for (let n = first; n <= last; n++) {
    for (let i = 0; i < runs; i++) {
      const r = playLevel(n, n * 104729 + i * 7717);
      games++;
      if (!r.won) continue;
      wins++;
      tally[r.stars]++;
    }
  }
  console.log('levels ' + first + '-' + last + ', ' + runs + ' games each');
  console.log(wins + ' clears of ' + games + ' attempts');
  [0, 1, 2, 3].forEach(k => {
    const pct = wins ? (tally[k] / wins * 100) : 0;
    console.log('  ' + k + ' star' + (k === 1 ? ' ' : 's') + ': ' +
      String(tally[k]).padStart(4) + '  ' + pct.toFixed(1) + '%' +
      (pct >= .5 ? '  ' + '#'.repeat(Math.round(pct / 2)) : ''));
  });
  process.exit(0);
}
const A = +(process.argv[2] || 1), Bn = +(process.argv[3] || 40), N = +(process.argv[4] || 12);
const rows = [];
console.log('lvl  goal              mv  clear%  avgScore  star3%  medLeft  verdict');
console.log('---  ----------------  --  ------  --------  ------  -------  -------');
for (let n = A; n <= Bn; n++) {
  const def = levelDef(n);
  let wins = 0, scoreSum = 0, star3 = 0;
  const leftovers = [];
  for (let i = 0; i < N; i++) {
    const r = playLevel(n, n * 104729 + i * 7717);
    if (r.won) { wins++; leftovers.push(r.movesLeft); }
    scoreSum += r.score;
    if (r.stars === 3) star3++;
  }
  const rate = wins / N;
  leftovers.sort((a, b) => a - b);
  const medLeft = leftovers.length ? leftovers[leftovers.length >> 1] : 0;
  /* leftover moves judged against the budget: six spare on a twenty-move
     level is a different thing from six spare on a thirty-six-move one */
  const spare = medLeft / def.moves;
  let verdict = 'ok';
  if (rate < .34) verdict = 'BRUTAL';
  else if (rate < .55) verdict = 'hard';
  else if (rate > .96 && spare >= .33) verdict = 'TRIVIAL';
  else if (rate > .9) verdict = 'easy';
  const goalTxt = def.goals.map(g => g[0] + (g[0] === 'collect' ? g[1] : '') + ':' + g[2]).join(' ');
  rows.push({ n, rate, verdict, star3: star3 / N, medLeft });
  console.log(
    String(n).padEnd(4) +
    goalTxt.padEnd(18).slice(0, 18) +
    String(def.moves).padStart(2) + '  ' +
    (Math.round(rate * 100) + '%').padStart(6) + '  ' +
    String(Math.round(scoreSum / N)).padStart(8) + '  ' +
    (Math.round(star3 / N * 100) + '%').padStart(6) + '  ' +
    String(medLeft).padStart(7) + '  ' + verdict);
}
console.log('');
const bad = rows.filter(r => r.verdict === 'BRUTAL' || r.verdict === 'TRIVIAL');
console.log('overall clear rate  ' + Math.round(rows.reduce((a, r) => a + r.rate, 0) / rows.length * 100) + '%');
console.log('three-star rate     ' + Math.round(rows.reduce((a, r) => a + r.star3, 0) / rows.length * 100) + '%');
console.log('needs attention     ' + (bad.length ? bad.map(r => r.n + '(' + r.verdict + ')').join(', ') : 'none'));
