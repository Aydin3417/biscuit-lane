/* The run, fitted on the game itself.

   test/fit-run.js fits every generated level by playing it in
   test/_solver.js's copy of the cascade, and test/real-fit.js was
   written on 14 Nov 2026 to correct what that copy got wrong: played
   through 40-game.js the run came out eleven points easier than fitted,
   single levels thirty and forty. A correction of six moves either way
   is a patch on a number measured in the wrong place. This measures in
   the right one: each level is played through the real game at a
   budget, the budget moved until the clear rate brackets the level's
   target (targetClear, 11-design.js), the bracket halved three times,
   and the budget nearest the target kept. The same seeds at every
   budget, so a change in the rate is the budget's doing.

   A level the budget cannot steer gets its work changed, as fit-run
   does it: still cleared fifteen points over the target at the floor
   of eight moves, the goal grows by a quarter and the search runs
   again; fifteen under at the ceiling, it shrinks by a fifth.

   The four later mechanics (30-engine.js) and the drawn boards have no
   response curve at all, so this is the only fit they have.

     node test/real-run.js [games] [--from=61] [--to=1000] [--changed] [--jobs=N] [--write]

   --changed  only the levels the later mechanics or a drawn board
              touched, for refitting those without replaying the rest
   --only     a list (1,2,3) or @file.json of levels; lane levels (under
              61) are fitted too and written into LEVELS by apply-lane
   Seeds are n * 50021 + g * 7331, the family test/real-fit.js uses.
   About 0.8 CPU-seconds a game here; 940 levels at sixteen games a
   point is roughly an hour on fifteen workers, which run at low
   priority so the machine stays usable. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const GAMES = +argv.filter(a => !a.startsWith('--'))[0] || 16;
const FROM = +opt('from', 61), TO = +opt('to', 1000);
const CHANGED = argv.includes('--changed');
const WRITE = argv.includes('--write');
const JOBS = +opt('jobs', Math.max(1, os.cpus().length - 1));
const SHARD = opt('shard', '');
const OUT = opt('out', '');
const FLOOR = 8, CAP = 64;
const MODULE = path.join(__dirname, '..', 'src', 'js', '13-run-fit.js');

function worker() {
  try { os.setPriority(os.constants.priority.PRIORITY_LOW); } catch (e) { }
  const { loadGame } = require('./_game.js');
  const { humanMove } = require('./_solver.js');
  const { ctx, vm } = loadGame();
  const X = vm.runInContext('({ G, startLevel, tryMove, TUNE, mulberry, levelDef, targetClear, RUN_MOVES, RUN_WORK, GK, LEVELS })', ctx);
  const events = vm.runInContext('__events', ctx);
  const tick = () => new Promise(r => setImmediate(r));
  async function play(n, g) {
    X.TUNE.data = null;
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
    return events.includes('goal');
  }
  async function fit(n) {
    const want = X.targetClear(n);
    /* a level the later mechanics took over starts from the plain goal:
       the multiplier it carried was fitted for the level it used to be */
    let work = touched(n) ? 1 : (X.RUN_WORK[n] || 1);
    let memo, best;
    const lane = n < 61;
    const setMoves = m => { if (lane) X.LEVELS[n - 1].moves = m; else X.RUN_MOVES[n] = m; };
    const rate = async m => {
      if (memo[m] !== undefined) return memo[m];
      setMoves(m);
      let won = 0;
      for (let g = 0; g < GAMES; g++) if (await play(n, g)) won++;
      return (memo[m] = won / GAMES);
    };
    const m0 = Math.max(FLOOR, Math.min(CAP, X.levelDef(n).moves));
    /* five passes, and work up to 2.6: a mud or hill level still free at
       eight moves needs more than the old 1.9 to stop being free */
    for (let pass = 0; pass < 5; pass++) {
      memo = {};
      if (!lane) { if (work === 1) delete X.RUN_WORK[n]; else X.RUN_WORK[n] = work; }
      let lo = m0, hi = m0;
      const step = Math.max(2, Math.round(m0 * .25));
      if (await rate(m0) < want) {
        let m = m0;
        while (m < CAP && await rate(m) < want) { lo = m; m = Math.min(CAP, m + step); }
        hi = m;
      } else {
        let m = m0;
        while (m > FLOOR && await rate(m) > want) { hi = m; m = Math.max(FLOOR, m - step); }
        lo = m;
      }
      for (let i = 0; i < 3 && hi - lo > 1; i++) {
        const mid = Math.round((lo + hi) / 2);
        if (await rate(mid) < want) lo = mid; else hi = mid;
      }
      best = +Object.keys(memo).sort((a, b) => Math.abs(memo[a] - want) - Math.abs(memo[b] - want) || a - b)[0];
      const p = memo[best];
      if (!lane && best === FLOOR && p > want + .12 && work < 2.6) { work = Math.round(work * 1.25 * 100) / 100; continue; }
      if (!lane && best === CAP && p < want - .15 && work > .55) { work = Math.round(work * .8 * 100) / 100; continue; }
      break;
    }
    setMoves(best);
    return { n, moves: best, p: memo[best], want, work: lane ? 1 : work, kind: X.levelDef(n).goals[0][0] };
  }
  const touched = n => {
    const d = X.levelDef(n);
    return !!(d.sig || d.hungry || d.toy || d.goals.some(g => g[0] === X.GK.BONE || g[0] === X.GK.MOUSE));
  };
  return { fit, touched };
}

/* --skip=<prefix> leaves out every level an earlier run already wrote to
   its shard files, so a run that died can be finished rather than redone */
const SKIP = opt('skip', '');
function done() {
  const have = new Set();
  if (!SKIP) return have;
  for (let i = 0; i < 64; i++) {
    const f = SKIP + '.' + i + '.json';
    if (fs.existsSync(f)) JSON.parse(fs.readFileSync(f, 'utf8')).forEach(r => have.add(r.n));
  }
  return have;
}
const ONLY_ARG = opt('only', '');
const ONLY = !ONLY_ARG ? null : new Set(ONLY_ARG[0] === '@' ? JSON.parse(fs.readFileSync(ONLY_ARG.slice(1), 'utf8')) : ONLY_ARG.split(',').map(Number));
function levels(W) {
  const out = [], have = done();
  for (let n = FROM; n <= TO; n++) if ((!CHANGED || W.touched(n)) && (!ONLY || ONLY.has(n)) && !have.has(n)) out.push(n);
  return out;
}

/* both tables rewritten from what the module holds plus what was fitted */
function writeModule(all) {
  const laneRows = all.filter(r => r.n < 61), rows = all.filter(r => r.n >= 61);
  if (laneRows.length) {
    const patch = {};
    laneRows.forEach(r => { patch[r.n] = { n: r.n, moves: r.moves }; });
    require('./apply-lane.js')(patch);
  }
  if (!rows.length) return;
  const src = fs.readFileSync(MODULE, 'utf8');
  const grab = name => {
    const start = src.indexOf('const ' + name + ' = {');
    const end = src.indexOf('};', start);
    const o = {};
    src.slice(start, end).replace(/(\d+):\s*([\d.]+)/g, (_, a, b) => { o[a] = +b; });
    return o;
  };
  const mv = grab('RUN_MOVES'), wk = grab('RUN_WORK');
  rows.forEach(r => { mv[r.n] = r.moves; if (r.work && r.work !== 1) wk[r.n] = r.work; else delete wk[r.n]; });
  const table = o => {
    const keys = Object.keys(o).map(Number).sort((a, b) => a - b), lines = [];
    for (let i = 0; i < keys.length; i += 8) lines.push('  ' + keys.slice(i, i + 8).map(k => k + ': ' + o[k]).join(', '));
    return lines.join(',\n');
  };
  const head = src.slice(0, src.indexOf('const RUN_MOVES = {'));
  const mid = src.slice(src.indexOf('};', src.indexOf('const RUN_MOVES = {')) + 2, src.indexOf('const RUN_WORK = {'));
  const tail = src.slice(src.indexOf('};', src.indexOf('const RUN_WORK = {')) + 2);
  fs.writeFileSync(MODULE, head + 'const RUN_MOVES = {\n' + table(mv) + '\n};' + mid + 'const RUN_WORK = {\n' + table(wk) + '\n};' + tail);
  console.log('13-run-fit.js: ' + rows.length + ' rows written');
}

if (SHARD) {
  const [i, k] = SHARD.split('/').map(Number);
  (async () => {
    const W = worker();
    const list = levels(W), out = [];
    for (let j = 0; j < list.length; j++) {
      if (j % k !== i) continue;
      out.push(await W.fit(list[j]));
      /* written as it goes: a run of an hour that dies in its last
         minute should not have to be played again */
      if (OUT) fs.writeFileSync(OUT + '.' + i + '.json', JSON.stringify(out));
    }
    process.stdout.write(JSON.stringify(out));
  })();
} else if (argv.includes('--collect')) {
  /* fold the per-shard files of an interrupted or finished run */
  const rows = [];
  for (let i = 0; i < 64; i++) { const f = OUT + '.' + i + '.json'; if (fs.existsSync(f)) rows.push(...JSON.parse(fs.readFileSync(f, 'utf8'))); }
  console.log(rows.length + ' rows found');
  if (WRITE && rows.length) writeModule(rows);
} else {
  (async () => {
    const t0 = Date.now();
    const pass = ['--from=' + FROM, '--to=' + TO].concat(CHANGED ? ['--changed'] : [], OUT ? ['--out=' + OUT] : [], SKIP ? ['--skip=' + SKIP] : [], ONLY_ARG ? ['--only=' + ONLY_ARG] : []);
    const parts = await Promise.all(Array.from({ length: JOBS }, (_, i) => new Promise((res, rej) =>
      execFile(process.execPath, [__filename, String(GAMES)].concat(pass, ['--shard=' + i + '/' + JOBS]),
        { maxBuffer: 1 << 26 }, (e, so, se) => e ? rej(new Error(se || e.message)) : res(JSON.parse(so))))));
    const rows = [].concat(...parts).sort((a, b) => a.n - b.n);
    const by = {};
    let miss = 0, bias = 0;
    rows.forEach(r => {
      miss += Math.abs(r.p - r.want); bias += r.p - r.want;
      const k = by[r.kind] = by[r.kind] || { n: 0, p: 0, want: 0, moves: 0 };
      k.n++; k.p += r.p; k.want += r.want; k.moves += r.moves;
    });
    Object.keys(by).sort().forEach(k => console.log('  ' + k.padEnd(9) + String(by[k].n).padStart(4) + ' levels  want ' +
      Math.round(by[k].want / by[k].n * 100) + '%  got ' + Math.round(by[k].p / by[k].n * 100) + '%  ' + Math.round(by[k].moves / by[k].n) + ' moves'));
    const floor = rows.filter(r => r.moves === FLOOR).length, cap = rows.filter(r => r.moves === CAP).length;
    console.log(rows.length + ' levels fitted on the real game, ' + GAMES + ' games a point: mean miss ' +
      Math.round(miss / rows.length * 100) + '%, bias ' + Math.round(bias / rows.length * 100) + '%, ' +
      floor + ' at the floor, ' + cap + ' at the ceiling, ' + rows.filter(r => r.work !== 1).length + ' with their work changed, ' +
      Math.round((Date.now() - t0) / 1000) + 's');
    if (WRITE) writeModule(rows);
  })().catch(e => { console.error(e.message.slice(0, 2000)); process.exit(1); });
}
