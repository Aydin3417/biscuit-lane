/* Budgets, checked against the real game and corrected.

   test/fit-lane.js and test/fit-run.js fit every level with
   test/_solver.js's copy of the engine, which is fast enough to play
   thousands of games a level. Played through the game's own 40-game.js
   on 14 Nov 2026 (test/all-levels.js, twelve games a level), the
   refitted lane came out six points easier than its targets on the
   average level and thirty to forty easier on a handful — level 55
   drawn at 57% cleared every game, level 49 drawn at 60% cleared eleven
   in twelve. The two engines are meant to agree; at the level of one
   map and one budget, they do not quite.

   So this is a second pass, on the real game: every level in the range
   is played at budgets either side of its own, the budget moved through
   the live-tuning seam (TUNE, which the real startLevel reads, clamped
   to six moves either way), and where the level misses its target by
   more than the noise, the delta that lands nearest it is written back —
   into LEVELS for the lane (apply-lane.js), into RUN_MOVES for the run.
   Seeds are the third family (n * 50021 + g * 7331), clear of both the
   fitter's and the validator's.

     node test/real-fit.js [games] [--from=1] [--to=60] [--jobs=N] [--write]
*/
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const GAMES = +argv.filter(a => !a.startsWith('--'))[0] || 24;
const FROM = +opt('from', 1), TO = +opt('to', 60);
const WRITE = argv.includes('--write');
const JOBS = +opt('jobs', 4);
const SHARD = opt('shard', '');
/* --only=n,n,... measures just those, inside the range */
const ONLY = opt('only', '') ? opt('only', '').split(',').map(Number) : null;
const levels = () => { const out = []; for (let n = FROM; n <= TO; n++) if (!ONLY || ONLY.includes(n)) out.push(n); return out; };
const DELTAS = [-6, -4, -2, 0, 2, 4];

function worker() {
  const { loadGame } = require('./_game.js');
  const { humanMove } = require('./_solver.js');
  const { ctx, vm } = loadGame();
  const X = vm.runInContext('({ G, startLevel, tryMove, TUNE, mulberry, levelDef, targetClear })', ctx);
  const events = vm.runInContext('__events', ctx);
  const tick = () => new Promise(r => setImmediate(r));
  async function play(n, g, delta) {
    X.TUNE.data = null;
    if (delta) X.TUNE.apply({ v: 1, moves: { [n]: delta } }, 0);
    const seed = (n * 50021 + g * 7331) >>> 0;
    ctx.Math.random = X.mulberry(seed);
    events.length = 0;
    X.startLevel(n, { reseed: seed });
    const G = X.G;
    G.busy = false;
    let turns = 0;
    const lim = G.moves + 20;
    while (!G.over && turns++ < lim) {
      const m = humanMove(G.B, G.goals);
      if (!m) break;
      await X.tryMove(m[0], m[1]);
    }
    await tick();
    X.TUNE.data = null;
    return events.includes('goal');
  }
  return { X, play };
}

/* RUN_MOVES rows rewritten in place, one `n: m` pair at a time */
function writeRun(fix) {
  const p = path.join(__dirname, '..', 'src', 'js', '13-run-fit.js');
  let src = fs.readFileSync(p, 'utf8');
  const start = src.indexOf('const RUN_MOVES = {');
  const end = src.indexOf('};', start);
  let table = src.slice(start, end);
  let moved = 0;
  Object.values(fix).forEach(r => {
    const re = new RegExp('([ {,])' + r.n + ': \\d+');
    if (re.test(table)) { table = table.replace(re, '$1' + r.n + ': ' + r.moves); moved++; }
  });
  fs.writeFileSync(p, src.slice(0, start) + table + src.slice(end));
  console.log('13-run-fit.js: ' + moved + ' budgets moved');
}

if (SHARD) {
  const [i, k] = SHARD.split('/').map(Number);
  (async () => {
    const W = worker();
    const out = [];
    const list = levels();
    for (let j = 0; j < list.length; j++) {
      if (j % k !== i) continue;
      const n = list[j];
      const row = { n, want: W.X.targetClear(n), moves: W.X.levelDef(n).moves, at: {} };
      for (const d of DELTAS) {
        let won = 0;
        for (let g = 0; g < GAMES; g++) if (await W.play(n, g, d)) won++;
        row.at[d] = won / GAMES;
      }
      out.push(row);
    }
    process.stdout.write(JSON.stringify(out));
  })();
} else {
  (async () => {
    const t0 = Date.now();
    const parts = await Promise.all(Array.from({ length: JOBS }, (_, i) => new Promise((res, rej) =>
      execFile(process.execPath, [__filename, String(GAMES), '--from=' + FROM, '--to=' + TO].concat(ONLY ? ['--only=' + ONLY.join(',')] : [], ['--shard=' + i + '/' + JOBS]),
        { maxBuffer: 1 << 24 }, (e, so, se) => e ? rej(new Error(se || e.message)) : res(JSON.parse(so))))));
    const rows = [].concat(...parts).sort((a, b) => a.n - b.n);
    const noise = Math.sqrt(.25 / GAMES);
    const lane = {}, run = {};
    let before = 0, after = 0, bias = 0;
    rows.forEach(r => {
      const miss0 = Math.abs(r.at[0] - r.want);
      bias += r.at[0] - r.want;
      /* the delta nearest the target, preferring no change inside the noise */
      let best = 0, bestMiss = miss0;
      if (miss0 > noise) DELTAS.forEach(d => { const m = Math.abs(r.at[d] - r.want); if (m < bestMiss - .02) { best = d; bestMiss = m; } });
      const moves = Math.max(8, r.moves + best);
      if (moves === r.moves) { best = 0; bestMiss = miss0; }
      before += miss0; after += bestMiss;
      console.log(String(r.n).padStart(4) + '  want ' + Math.round(r.want * 100) + '%  ' +
        DELTAS.map(d => (d > 0 ? '+' : '') + d + ':' + Math.round(r.at[d] * 100)).join(' ') + (best ? '  ' + r.moves + ' -> ' + moves : ''));
      if (best) (r.n <= 60 ? lane : run)[r.n] = { n: r.n, moves };
    });
    console.log('\nreal minus target ' + Math.round(bias / rows.length * 100) + '% on the average level; mean miss ' +
      Math.round(before / rows.length * 100) + '% -> ' + Math.round(after / rows.length * 100) + '%  (noise ' +
      Math.round(noise * 100) + '%), ' + (Object.keys(lane).length + Object.keys(run).length) + ' levels moved, ' +
      Math.round((Date.now() - t0) / 1000) + 's');
    if (WRITE) {
      if (Object.keys(lane).length) require('./apply-lane.js')(lane);
      if (Object.keys(run).length) writeRun(run);
    }
  })();
}
