/* The solver, split out so more than one tool can drive it.

   test/ai.js reports difficulty; test/calibrate.js measures how a level
   responds to its move budget. Both need the same greedy one-ply player
   and the same board clone, and neither should own it. */
/* brambles creep: the patch takes one more cell every BRAMBLE_EVERY
   moves, exactly as the game does it */
let creepTick = 0;
/* The hills push earth up between the solver's moves too. Without this
   the solver would measure a level that does not exist — and every
   difficulty number in this project comes from the solver. */
function moles(B) {
  if (typeof moleCount !== 'function' || moleCount(B) === 0) return;
  moleTick(B);
}

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
/* 11-design.js says what a level is meant to feel like and 12-curve.js
   holds the measured response curves the generator reads backwards, so a
   harness without them cannot build a level at all */
require('./_modules.js').CORE.forEach(f =>
  vm.runInContext(read(f).replace(/^'use strict';?$/m, ''), ctx, { filename: f }));

const X = vm.runInContext(
  '({ makeBoard, findMatches, specialFor, settle, hasMove, allMoves, canSwap,' +
  '   swapTiles, eachCell, openCell, levelDef, starTargets, tilesOfType,' +
  '   commonType, shuffleTypes, spreadBramble, brambleCount, BRAMBLE_EVERY, mulberry, GK, PUP, SP, PUPS_IN_PLAY,' +
  '   moleCount, moleTick, moleHit, MOLE_EVERY,' +
'   targetClear, isGate, budgetFor, budgetRange, LEVELS })', ctx);
const {
  makeBoard, findMatches, specialFor, settle, hasMove, allMoves, canSwap,
  swapTiles, eachCell, openCell, levelDef, starTargets, tilesOfType,
  commonType, shuffleTypes, spreadBramble, brambleCount, BRAMBLE_EVERY, mulberry, GK, PUP, SP, PUPS_IN_PLAY,
  moleCount, moleTick, moleHit
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
      /* Every scalar on the cell, by name rather than by list.

         The list was the bug that cost an afternoon: molehills were
         added to the engine and not to this clone, so the solver
         evaluated every candidate move on a board where the hills did
         not exist. It could not see them, never chose to hit them, and
         the generated levels measured at nought percent cleared — while
         a hand-built board with the same mechanic measured a hundred.
         Nothing in the suite could have caught it, because the numbers
         it produced were plausible.

         Copying whatever the cell has means the next blocker somebody
         invents is cloned correctly without anyone remembering to. */
      const cell = { r, c, tile: null };
      for (const k in s) {
        if (k === 'tile' || k === 'r' || k === 'c') continue;
        const v = s[k];
        if (typeof v === 'number' || typeof v === 'boolean' || v === null) cell[k] = v;
      }
      cell.tile = s.tile
        ? { id: s.tile.id, type: s.tile.type, sp: s.tile.sp, x: 0, y: 0, dying: 0 }
        : null;
      row.push(cell);
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
  /* as the game does it: a rainbow set off indirectly clears the
     board's most common colour, not the colour it was born from */
  if (t.sp !== SP.NONE) out.chain.push({ r, c, sp: t.sp, type: t.sp === SP.RAIN ? -1 : t.type });
  cell.tile = null;
  out.count++;
  out.collect[t.type] = (out.collect[t.type] || 0) + 1;
  if (cell.mud > 0) { cell.mud--; out.mud++; }
  if (cell.bram > 0) { cell.bram--; out.bram++; }
  [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([r2, c2]) => {
    const n = B.cell[r2] && B.cell[r2][c2];
    if (n && n.crate > 0) { n.crate--; if (n.crate === 0) out.crate++; }
    if (n && n.mole > 0 && moleHit(B, n)) { out.moleHit++; if (n.mole === 0) out.mole++; }
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
    const out = { chain: [], collect: {}, mud: 0, crate: 0, bram: 0, mole: 0, moleHit: 0, count: 0 };
    const touched = new Set();
    wave.forEach(k => { const [r, c] = k.split(':').map(Number); hitCell(B, r, c, out, touched); });
    tally.mud += out.mud; tally.crate += out.crate; tally.bram += out.bram;
    tally.mole += out.mole || 0; tally.moleHit += out.moleHit || 0; tally.count += out.count;
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
const blankTally = () => ({ collect: {}, mud: 0, crate: 0, bram: 0, mole: 0, moleHit: 0, count: 0, rescued: 0, made: 0 });

/* ---------------- goal bookkeeping ---------------- */
function mkGoals(def) { return def.goals.map(g => ({ kind: g[0], arg: g[1], need: g[2], have: 0 })); }
function applyTally(goals, tally, score, B) {
  goals.forEach(g => {
    if (g.kind === GK.COLLECT) g.have += tally.collect[g.arg] || 0;
    else if (g.kind === GK.MUD) g.have += tally.mud;
    else if (g.kind === GK.CRATE) g.have += tally.crate;
    else if (g.kind === GK.MOLE) g.have += tally.mole;
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
    /* A hill closed moves the goal; a hill *chipped* moves nothing the
       goal can see, and the first version scored only closures. A greedy
       player given no credit for the first two hits on a three-layer
       hill will never make them, and the generated levels measured at
       nought percent while a hand-built one measured ninety-five. The
       partial hit is the gradient — the player watching the mound shrink
       has it, and the solver has to have it too. */
    else if (g.kind === GK.MOLE) got = tally.mole * 6 + tally.moleHit * 2;
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

/* ---------------- the player who cannot see the future ----------------

   Two players live here now, and the difference between them is the
   difference between a level that was tuned and a level that is fair.

   `solver`, above, is the one every number in this project was measured
   with. It tries every legal swap on a copy of the board, resolves the
   whole cascade including the tiles that fall in afterwards, and keeps
   the swap that moved the goals furthest. 11-design.js calls it "about as
   well as an attentive human who is not trying very hard", and measured
   against an actual person it is nothing of the kind: it sees the
   cascade before it happens, and on a five-colour board the cascade is
   most of what a move delivers.

   Played through the real interface, the game's own hint — which scores
   only what a match visibly does — lost level one twice at 26 and 27 of
   34. A policy that scores the visible match and nothing else clears
   level one 63% of the time where the solver clears it 92%; level three
   30% against 100%; level six 20% against 92%; level nine 3% against
   92%; the first gate 7% against 75%. Thirty seeds a level. Every move
   budget in the lane and every response curve behind the generator had
   been fitted to the 92, and a player handed the 63 does not read that
   as difficulty, they read it as the game cheating.

   `human` is that second player. Every legal swap, scored by what the
   match itself would deliver to the goals: the tiles in the run, the
   mud under them, the crates and hills beside them, the row or column
   or colour a special inside the run would visibly fire along, and the
   ordinary preference for a longer run and for making a special. No
   cascade and no refill, because nobody sees those. It is the default,
   because the question the numbers answer is "will a person clear this";
   SOLVER=solver brings the old player back for comparison. */
const POLICY = process.env.SOLVER === 'solver' ? 'solver' : 'human';

function visibleKeys(B, r, c, sp, type) {
  if (sp === SP.RAIN) return specialKeys(B, r, c, sp, type < 0 ? undefined : type);
  return specialKeys(B, r, c, sp, type);
}
function humanMove(B, goals) {
  const moves = allMoves(B);
  if (!moves.length) return null;
  const wanted = {};
  goals.forEach(g => { if (g.have < g.need) wanted[g.kind === GK.COLLECT ? 'c' + g.arg : g.kind] = g.need - g.have; });
  const left = k => wanted[k] || 0;
  let best = null, bestV = -1;
  for (const m of moves) {
    const [a, b] = m;
    let v = 0;
    /* Two specials swapped together are a legal move and the biggest
       one on the board, and this harness cannot play it: resolve()
       knows lines, not combos, so the swap lands as a no-op. The first
       draft valued that swap at 120 the way the game's hint does, chose
       it, watched nothing happen, and chose it again until the budget
       was gone — level one measured 20%. So a combo is scored here by
       the lines it makes, which is usually none, and the policy simply
       does not take it. That undersells a person by a little, and it is
       the honest reading of what the harness can see. */
    {
      swapTiles(B, a, b);
      const groups = findMatches(B);
      const seen = new Set();
      const got = { count: 0, mud: 0, crate: 0, bram: 0, mole: 0, rescue: 0, made: 0, collect: {} };
      const hit = (r, c) => {
        const key = r + ':' + c;
        if (seen.has(key)) return;
        seen.add(key);
        const cell = B.cell[r] && B.cell[r][c];
        if (!cell || cell.hole) return;
        if (cell.crate > 0) { if (cell.crate === 1) got.crate++; return; }
        if (cell.ice > 0) return;
        const t = cell.tile;
        if (!t || t.type === PUP) return;
        got.count++;
        got.collect[t.type] = (got.collect[t.type] || 0) + 1;
        if (cell.mud > 0) got.mud++;
        if (cell.bram > 0) got.bram++;
        [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([r2, c2]) => {
          const nb = B.cell[r2] && B.cell[r2][c2];
          if (!nb) return;
          if (nb.crate === 1) got.crate++;
          if (nb.mole > 0) got.mole++;
          /* a basket sits on what is under it; clearing that is the only
             visible way of walking it home */
          if (r2 === r - 1 && nb.tile && nb.tile.type === PUP) got.rescue++;
        });
      };
      groups.forEach(g => {
        if (specialFor(g) !== SP.NONE) got.made++;
        g.cells.forEach(([r, c]) => {
          hit(r, c);
          const t = B.cell[r][c].tile;
          if (t && t.sp !== SP.NONE) visibleKeys(B, r, c, t.sp, t.type).forEach(k => { const [r2, c2] = k.split(':').map(Number); hit(r2, c2); });
        });
      });
      swapTiles(B, a, b);
      goals.forEach(g => {
        const l = g.kind === GK.COLLECT ? left('c' + g.arg) : left(g.kind);
        if (l <= 0) return;
        let d = 0;
        if (g.kind === GK.COLLECT) d = got.collect[g.arg] || 0;
        else if (g.kind === GK.MUD) d = got.mud;
        else if (g.kind === GK.CRATE) d = got.crate;
        else if (g.kind === GK.BRAMBLE) d = got.bram * 2;
        else if (g.kind === GK.MOLE) d = got.mole * 2;
        else if (g.kind === GK.RESCUE) d = got.rescue * 3;
        else if (g.kind === GK.SCORE) d = got.count * 62 / 260;
        v += Math.min(d, l) * 10;
      });
      /* Ties are the common case — most swaps on most boards touch no
         goal at all — and which tie wins matters more than it looks.
         Measured on level one over thirty seeds: taken in scan order
         this policy cleared 30%; breaking ties at random cleared 63%;
         breaking them toward the lower match cleared 73%. A match at
         the top of the board drops nothing through it and a match at
         the bottom drops everything, and matching low is the first
         thing a person learns at this game. So the row is the
         tie-breaker, ahead of how many tiles the match itself holds —
         when the tile count was allowed to decide first, the row never
         got a say and the policy sat back at 30%. */
      let rows = 0, cells = 0, longest = 0;
      groups.forEach(g => { longest = Math.max(longest, g.maxH || 0, g.maxV || 0); g.cells.forEach(([r]) => { rows += r; cells++; }); });
      v += got.made * 6 + (longest >= 4 ? 2 : 0) + got.count * .1;
      if (cells) v += 1.5 * (rows / cells) / Math.max(1, B.h - 1);
    }
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}
const pickMove = POLICY === 'human' ? humanMove : bestMove;

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
    const m = pickMove(B, goals);
    if (!m) break;
    swapTiles(B, m[0], m[1]);
    moves--; used++;
    const t = blankTally();
    resolve(B, [m[0], m[1]], t);
    score += Math.round(t.count * 62 * scoreMul);
    applyTally(goals, t, score, B);
    creep(B, goals, t);
    moles(B);
  }
  const stars = starTargets(def);
  let s = 0;
  stars.forEach((v, i) => { if (score >= v) s = i + 1; });
  return { won: met(goals), score, stars: s, movesUsed: used, movesLeft: moves, goals };
}


/* ctx is the game's own global scope. test/fit-run.js reaches in to blank
   fittedMoves() and fittedWork() while it measures, so a level is fitted
   from the model's own build and not from the last fit's. */
module.exports = { playLevel, X, ctx, mkGoals, cloneBoard, POLICY, humanMove, bestMove, resolve, blankTally, applyTally, met, remaining };
