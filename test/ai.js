/* brambles creep: the patch takes one more cell every BRAMBLE_EVERY
   moves, exactly as the game does it */
/* The solver itself lives in test/_solver.js so this file and
   test/calibrate.js drive the same one. It used to be copied into both,
   which is a guarantee that one of them will quietly go stale. */
const { playLevel, X, mkGoals, cloneBoard } = require('./_solver.js');
const {
  makeBoard, findMatches, specialFor, settle, hasMove, allMoves, canSwap,
  swapTiles, eachCell, openCell, levelDef, starTargets, tilesOfType,
  commonType, shuffleTypes, spreadBramble, brambleCount, BRAMBLE_EVERY,
  mulberry, GK, PUP, SP, PUPS_IN_PLAY, targetClear, isGate
} = X;

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
console.log('lvl  goal                   mv  want  clear%  avgScore  star3%  medLeft  verdict');
console.log('---  ---------------------  --  ----  ------  --------  ------  -------  -------');
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

  /* Every level has a stated intent now — targetClear(n) — so "hard" and
     "easy" are no longer opinions about an absolute number. They are the
     distance between what the level was aimed at and where it landed,
     which is the only thing worth reporting once the aiming exists.

     The old bands called any level under 34% BRUTAL and any level over
     96% TRIVIAL. Both are wrong against a designed curve: a gate is
     meant to be near sixty and a relief is meant to be near ninety-five,
     and calling the relief trivial is calling the design a bug.

     The absolute bands survive only where they mean something on their
     own: a level nobody can clear and a level nobody can lose are faults
     whatever they were aimed at. */
  const want = targetClear(n);
  const off = rate - want;
  /* the spread on a clear rate over N games; a miss inside it is a coin */
  const noise = Math.sqrt(Math.max(rate * (1 - rate), .04) / N);
  let verdict = 'ok';
  if (rate < .18) verdict = 'BRUTAL';
  else if (rate > .995 && spare >= .40) verdict = 'TRIVIAL';
  else if (off < -2 * noise - .10) verdict = 'harder';
  else if (off > 2 * noise + .10) verdict = 'easier';
  const goalTxt = def.goals.map(g => g[0] + (g[0] === 'collect' ? g[1] : '') + ':' + g[2]).join(' ');
  rows.push({ n, rate, want, off, verdict, star3: star3 / N, medLeft });
  console.log(
    String(n).padEnd(5) +
    /* padEnd then slice to the same width leaves no gap when the text
       is exactly that long, and the goal ran into the move count:
       "rescue:1 score:9500" and 34 moves printed as "score:95034". One
       character narrower than the field it sits in. */
    goalTxt.padEnd(22).slice(0, 21) + ' ' +
    String(def.moves).padStart(2) + '  ' +
    (Math.round(want * 100) + '%').padStart(4) + '  ' +
    (Math.round(rate * 100) + '%').padStart(6) + '  ' +
    String(Math.round(scoreSum / N)).padStart(8) + '  ' +
    (Math.round(star3 / N * 100) + '%').padStart(6) + '  ' +
    String(medLeft).padStart(7) + '  ' + verdict);
}
console.log('');
const bad = rows.filter(r => r.verdict === 'BRUTAL' || r.verdict === 'TRIVIAL');
const wide = rows.filter(r => r.verdict === 'harder' || r.verdict === 'easier');
const mean = f => rows.reduce((a, r) => a + f(r), 0) / rows.length;
console.log('overall clear rate  ' + Math.round(mean(r => r.rate) * 100) + '%');
console.log('three-star rate     ' + Math.round(mean(r => r.star3) * 100) + '%');
console.log('average miss        ' + Math.round(mean(r => Math.abs(r.off)) * 100) + '%   ' +
  'bias ' + (mean(r => r.off) >= 0 ? '+' : '') + Math.round(mean(r => r.off) * 100) + '%');
console.log('off their mark      ' + (wide.length
  ? wide.map(r => r.n + '(' + r.verdict + ' ' + (r.off > 0 ? '+' : '') + Math.round(r.off * 100) + ')').join(', ')
  : 'none'));
console.log('needs attention     ' + (bad.length ? bad.map(r => r.n + '(' + r.verdict + ')').join(', ') : 'none'));
