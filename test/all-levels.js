/* Every level, played through the real 40-game.js.

   The molehill goal was unwinnable from level 76 on for months while
   the whole suite was green, because every harness that played a level
   played a copy of the engine, and the copy had the field the game
   lacked. test/game-rules.js plays the game's own file now, but it plays
   four hand-built boards. This plays all of them: levels 1 to 400 from
   levelDef, and the daily walk for sixty days at six reached tiers (the
   five tiers of dailyLevel, and the top one again past MOLE_FROM, where
   molehills join its kinds). Each is started with startLevel, dealt
   with FAST_FORWARD on so every wait() in a cascade resolves at once,
   and played move by move through tryMove by test/_solver.js's human
   policy — the player every move budget was fitted to, handed the game's
   own board across the vm boundary rather than copied.

   What is asserted, per level over K games on different seeds:
     - no NaN and nothing undefined in G.score, G.moves or any goal's
       have/need after any move;
     - every goal moved in at least one game. The score goal is read
       from G.score, since the game never writes its `have`;
     - every game ends (G.over) inside moves + 20 turns, with the busy
       flag down, no swap refused, no dead board left unshuffled, and
       the win or loss routine run to its event.
   A goal that moved nowhere in K games is replayed on sixteen fresh
   seeds first: at one game a level seven rescue levels showed no rescue
   at all, and at two games level 257 still did — baskets in the top
   rows and twenty-five moves can do that. The engine bug this exists
   for is deterministic, so it moves the goal nowhere in sixteen either:
   with the `mole` field taken back out of blastWaves, levels 76 and 83
   fail here 0 of 17 won, goal never moved. A level never won in K but
   whose goals did move is a note, not a failure — at four games a 40%
   level loses them all one time in eight — and the exit code is
   non-zero only for the bug class.

     node test/all-levels.js [games] [first] [last] [--no-daily] [--jobs=N] [--verbose]
     node test/all-levels.js            four games a level, 1-400 and the daily
     node test/all-levels.js 1 --no-daily   what run-all.js quick runs, 31s
     node test/all-levels.js 4 76 84    a slice; a range leaves the daily out

   Measured on this machine (16 cores, Node 24): a game costs about
   0.36s, nearly all of it findMatches under the human policy's scan of
   every candidate swap (86% of a profile of levels 60-80), so the full
   3,040 games would take eighteen minutes in one process. The work is
   dealt round-robin to eight child processes (--jobs, each one a
   --shard=i/N worker printing JSON) and took 261s and 399s on two
   runs of the same build, the slower one with other work on the
   machine. The engine's own cost per move is a few milliseconds. */
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const argv = process.argv.slice(2);
const args = argv.filter(a => !a.startsWith('--'));
const flag = name => { const f = argv.find(a => a === '--' + name || a.startsWith('--' + name + '=')); return f ? (f.includes('=') ? f.split('=')[1] : true) : null; };
const K = +args[0] || 4;
const FIRST = +args[1] || 1;
const LAST = +args[2] || 400;
const ranged = args.length > 1;
const DAILY = !ranged && !flag('no-daily');
/* --only-daily: the sixty days at every tier and no levels, for tuning the walk */
const ONLY_DAILY = !!flag('only-daily');
const VERBOSE = !!flag('verbose');
const JOBS = flag('jobs') ? Math.max(1, +flag('jobs')) : Math.min(8, os.cpus().length);
const SHARD = flag('shard');                 /* "i/N": a worker, printing JSON */

/* The daily: sixty days at each of a few reached tiers. The tier is
   floor(reached / 14) capped at four, and molehills join the kinds at
   MOLE_FROM (76) — so 1, 14, 28, 42 and 60 are the five tiers without
   hills and 90 is the top tier with them. */
const TIERS = [1, 14, 28, 42, 60, 90];
const seedsFor = (n, g) => ({ reseed: g * 7331, random: n * 50021 + g * 7331 + 17 });
function workList() {
  const tasks = [];
  for (let n = FIRST; n <= LAST && !ONLY_DAILY; n++) {
    const seeds = []; for (let g = 0; g < K; g++) seeds.push(seedsFor(n, g));
    tasks.push({ label: 'level ' + n, n, seeds });
  }
  if (DAILY || ONLY_DAILY) for (const reached of TIERS) for (let day = 1; day <= 60; day++) {
    const seeds = []; for (let g = 0; g < K; g++) seeds.push(seedsFor(1000 + reached * 61 + day, g));
    tasks.push({ label: 'daily reached ' + reached + ' day ' + day, daily: { reached, day: 20700 + day }, seeds });
  }
  return tasks;
}

/* ---------------- the worker ---------------- */
function makeWorker() {
  const { loadGame } = require('./_game.js');
  const { ctx, vm } = loadGame();
  /* the player: test/_solver.js's human policy, the one every move budget
     in the project was fitted to. It is handed the game's own board and
     goal list across the vm boundary — plain objects, so nothing is
     copied and nothing is duplicated */
  const { humanMove } = require('./_solver.js');
  const X = vm.runInContext('({ G, startLevel, tryMove, GK, DAILY_LEVEL, SAVE, mulberry })', ctx);
  const { G, startLevel, tryMove, GK, DAILY_LEVEL, SAVE, mulberry } = X;
  /* the daily is built for today unless told the day; the harness tells it */
  vm.runInContext('globalThis.__day = undefined; globalThis.__dailyReal = dailyLevel;' +
    'dailyLevel = (reached, dayNo) => __dailyReal(reached, dayNo === undefined ? __day : dayNo);', ctx);
  const setDay = d => vm.runInContext('__day = ' + d, ctx);
  const events = vm.runInContext('__events', ctx);
  const seedRandom = s => { ctx.Math.random = mulberry(s >>> 0); };
  const num = v => typeof v === 'number' && isFinite(v);
  /* one tick of the event loop, so the win or loss routine that checkEnd
     started finishes and says so before the next game begins */
  const tick = () => new Promise(r => setImmediate(r));

  /* Plays one game. Nothing throws: every oddity is a string in
     `faults`, so one bad level does not stop the sweep. */
  async function playGame(n, reseed, seed) {
    seedRandom(seed);
    events.length = 0;
    startLevel(n, { reseed });
    G.busy = false;                 /* the deal-in's 700ms is not waited for */
    const def = G.def;
    const faults = [];
    const start = G.goals.map(g => g.have);
    const peak = G.goals.map(g => g.have);
    let scoreMax = 0, made = 0, turns = 0;
    const limit = G.moves + 20;     /* a shuffle or a refused swap costs a turn and no move */
    const audit = where => {
      if (!num(G.score) || !num(G.moves) || G.moves < 0) faults.push(where + ': score=' + G.score + ' moves=' + G.moves);
      G.goals.forEach((g, i) => {
        if (!num(g.have) || !num(g.need)) faults.push(where + ': goal ' + i + ' (' + g.kind + ') have=' + g.have + ' need=' + g.need);
        else peak[i] = Math.max(peak[i], g.have);
      });
      scoreMax = Math.max(scoreMax, G.score);
    };
    audit('at start');
    while (!G.over && turns++ < limit) {
      if (G.busy) { faults.push('busy flag stuck after move ' + made); break; }
      const m = humanMove(G.B, G.goals);
      if (!m) { faults.push('no legal move on the board after move ' + made + ' and the game did not shuffle'); break; }
      const before = G.made;
      await tryMove(m[0], m[1]);
      if (G.made === before) { faults.push('a legal swap was refused after move ' + made + ' (busy=' + G.busy + ' over=' + G.over + ')'); break; }
      made++;
      audit('after move ' + made);
    }
    if (!G.over) faults.push('not over after ' + made + ' moves (' + G.moves + ' left, turns ' + turns + ')');
    await tick();
    const won = events.includes('goal');
    const ended = won ? events.includes('won') : events.includes('lost');
    if (G.over && !ended) faults.push('over, but the ' + (won ? 'win' : 'loss') + ' routine never finished (' + events.join(',') + ')');
    if (won && G.goals.some(g => g.kind !== GK.BRAMBLE && g.kind !== GK.SCORE && g.have < g.need))
      faults.push('won with a goal short: ' + G.goals.map(g => g.kind + ' ' + g.have + '/' + g.need).join(', '));
    return { won, made, faults, start, peak, scoreMax, moves: def.moves, goals: def.goals.map(g => g[0]) };
  }

  /* K games of one level, judged together. A goal that never moved in
     any of them is the molehill class of bug; a level never won in K is
     only reported, because at four games a 40% level loses them all one
     time in eight. */
  async function playLevel(task) {
    let n = task.n;
    if (task.daily) { SAVE.reached = task.daily.reached; setDay(task.daily.day); n = DAILY_LEVEL; }
    const games = [];
    for (const s of task.seeds) games.push(await playGame(n, s.reseed, s.random));
    const wins = games.filter(x => x.won).length;
    const faults = [];
    games.forEach((x, i) => x.faults.forEach(f => faults.push('game ' + (i + 1) + ': ' + f)));
    const kinds = games[0].goals;
    const stuck = kinds.map((kind, i) => {
      /* the score goal is read from G.score, never from its own `have` */
      if (kind === GK.SCORE) return !games.some(x => x.scoreMax > 0) ? 'score never above 0' : null;
      return !games.some(x => x.peak[i] > x.start[i]) ? kind + ' goal never moved from ' + games[0].start[i] : null;
    }).filter(Boolean);
    return { label: task.label, daily: !!task.daily, wins, games: games.length, faults, stuck, kinds, moves: games[0].moves,
      made: Math.round(games.reduce((a, x) => a + x.made, 0) / games.length) };
  }

  return playLevel;
}
let WORKER = null;
async function playTasks(tasks) {
  if (!WORKER) WORKER = makeWorker();
  const out = [];
  for (const t of tasks) {
    const r = await WORKER(t);
    out.push(r);
    if (VERBOSE) console.error(r.label.padEnd(26) + r.wins + '/' + r.games + '  ' + r.kinds.join('+') +
      (r.stuck.length ? '  STUCK ' + r.stuck.join('; ') : '') + (r.faults.length ? '  ' + r.faults[0] : ''));
  }
  return out;
}

/* ---------------- the driver ---------------- */
function shard(i, n) {
  return new Promise((resolve, reject) => {
    const a = [__filename, ...argv.filter(x => !x.startsWith('--jobs')), '--shard=' + i + '/' + n];
    execFile(process.execPath, a, { encoding: 'utf8', maxBuffer: 64 << 20 }, (err, stdout, stderr) => {
      if (VERBOSE && stderr) process.stderr.write(stderr);
      if (err) return reject(new Error('shard ' + i + ' failed: ' + (stderr || err.message)));
      try { resolve(JSON.parse(stdout)); } catch (e) { reject(new Error('shard ' + i + ' spoke no JSON: ' + stdout.slice(0, 300))); }
    });
  });
}

(async () => {
  const tasks = workList();
  if (SHARD) {
    const [i, n] = SHARD.split('/').map(Number);
    process.stdout.write(JSON.stringify(await playTasks(tasks.filter((t, k) => k % n === i))));
    return;
  }
  const t0 = Date.now();
  let results;
  if (JOBS <= 1 || tasks.length < 4) results = await playTasks(tasks);
  else {
    const parts = await Promise.all(Array.from({ length: JOBS }, (_, i) => shard(i, JOBS)));
    /* back into level order */
    results = tasks.map((t, k) => parts[k % JOBS][Math.floor(k / JOBS)]);
  }
  /* A goal that sat at nought through K games is either the bug or a
     slow goal on a short budget, and K games cannot tell them apart: at
     one game a level, seven rescue levels — baskets in the top rows and
     eight to twenty-five moves — showed no rescue at all, and at two
     games, level 257 still did. So a level accused is replayed on fresh
     seeds, sixteen more games, before the verdict stands. The engine
     bug this exists for is deterministic: in sixteen games it moves the
     goal nowhere, and a slow goal moves it somewhere. */
  const accused = results.filter(r => r.stuck.length);
  for (const r of accused) {
    const task = tasks[results.indexOf(r)];
    const more = Object.assign({}, task, { seeds: Array.from({ length: 16 }, (_, g) => seedsFor((task.n || 0) + 90001, g + 100)) });
    const again = (await playTasks([more]))[0];
    r.wins += again.wins; r.games += again.games;
    again.faults.forEach(f => r.faults.push('replay ' + f));
    const still = r.stuck.filter(s => again.stuck.includes(s));
    r.slow = r.stuck.filter(s => !again.stuck.includes(s));
    r.stuck = still;
  }
  const secs = Math.round((Date.now() - t0) / 1000);

  const failures = results.filter(r => r.faults.length || r.stuck.length);
  const neverWon = results.filter(r => !r.wins && !r.stuck.length && !r.faults.length);
  const games = results.reduce((a, r) => a + r.games, 0);
  const won = results.reduce((a, r) => a + r.wins, 0);
  const dailies = results.filter(r => r.daily).length;

  console.log('every level, through the real game (' + K + ' games each, human policy, ' + JOBS + ' processes):');
  failures.forEach(r => {
    r.stuck.forEach(s => console.log('  BAD  ' + r.label + ' (' + r.kinds.join('+') + ', ' + r.wins + '/' + r.games + ' won): ' + s));
    r.faults.forEach(f => console.log('  BAD  ' + r.label + ' (' + r.kinds.join('+') + '): ' + f));
  });
  neverWon.forEach(r => console.log('  note ' + r.label + ' (' + r.kinds.join('+') + ', ' + r.moves + ' moves): never won in ' + r.games + ', goals did move'));
  results.filter(r => r.slow && r.slow.length).forEach(r => r.slow.forEach(s =>
    console.log('  note ' + r.label + ' (' + r.kinds.join('+') + ', ' + r.moves + ' moves): ' + s + ' in the first ' + K + ', moved on replay (' + r.wins + '/' + r.games + ' won)')));
  /* clear rate by goal kind, levels and dailies apart: not a gate — the
     curve tests hold the band — but the first place a kind that has
     quietly gone sour shows up */
  for (const daily of [false, true]) {
    const by = {};
    results.filter(r => r.daily === daily).forEach(r => {
      const k = r.kinds.slice().sort().join('+');
      by[k] = by[k] || { games: 0, wins: 0, levels: 0 };
      by[k].games += r.games; by[k].wins += r.wins; by[k].levels++;
    });
    const rows = Object.keys(by).sort();
    if (!rows.length) continue;
    console.log('\n' + (daily ? 'the daily' : 'the levels') + ', cleared by goal kind:');
    rows.forEach(k => console.log('  ' + k.padEnd(18) + String(Math.round(100 * by[k].wins / by[k].games)).padStart(3) + '%  ' + by[k].levels + (daily ? ' days' : ' levels')));
  }
  console.log('\n' + (results.length - dailies) + ' levels' + (dailies ? ' and ' + dailies + ' dailies' : '') + ', ' + games + ' games, ' +
    won + ' won (' + Math.round(100 * won / games) + '%), ' + neverWon.length + ' never won, ' + failures.length + ' with faults, ' + secs + 's');
  console.log(failures.length ? failures.length + ' level(s) the game cannot finish properly' : 'every level ends, and every goal can move');
  process.exitCode = failures.length ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
