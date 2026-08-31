/* A pool of solver processes.

   One game takes about half a second, so a sweep that asks a real
   question — sixty levels, seven candidate budgets, enough games each
   for the answer to mean anything — is twenty thousand games and over
   two hours on one core. That cost is why the levels in this game were
   tuned by guess for so long.

   The machine has twelve. This hands the games out to all of them, so
   the same sweep is minutes, and measuring becomes cheaper than
   arguing about what the number probably is. */
const { fork } = require('child_process');
const os = require('os');
const path = require('path');

const WORKERS = Math.max(1, Math.min(+process.env.JOBS || 0 || os.cpus().length - 1, 32));

/* Jobs are [level, seed, moves]; moves 0 means the authored budget.
   Returns an array of 0/1 in the order given. `onProgress` is called
   with (done, total) as batches land. */
function run(jobs, onProgress) {
  return new Promise((resolve, reject) => {
    if (!jobs.length) return resolve([]);
    const results = new Array(jobs.length);
    const kids = [];
    let next = 0, done = 0, threw = 0, alive = 0;

    /* Small batches keep every core busy to the end — one big slice per
       worker means the pool runs at the speed of its unluckiest slice.
       Big enough, though, that IPC is not the cost. */
    const BATCH = Math.max(4, Math.min(24, Math.ceil(jobs.length / (WORKERS * 8))));

    const feed = kid => {
      if (next >= jobs.length) {
        kid.send({ bye: 1 });
        return;
      }
      const from = next;
      next = Math.min(jobs.length, next + BATCH);
      kid.send({ id: from, jobs: jobs.slice(from, next) });
    };

    for (let i = 0; i < Math.min(WORKERS, Math.ceil(jobs.length / BATCH)); i++) {
      const kid = fork(path.join(__dirname, '_worker.js'), [], {
        env: process.env, stdio: ['ignore', 'inherit', 'inherit', 'ipc']
      });
      alive++;
      kids.push(kid);
      kid.on('message', m => {
        if (m.ready) return feed(kid);
        for (let j = 0; j < m.won.length; j++) {
          if (m.won[j] === 2) threw++;
          results[m.id + j] = { won: m.won[j] === 1, score: m.score[j] };
        }
        done += m.won.length;
        if (onProgress) onProgress(done, jobs.length);
        feed(kid);
      });
      kid.on('exit', () => {
        if (--alive === 0) {
          if (threw) console.error('  ! ' + threw + ' oyun hata verdi, kayıp sayıldı');
          resolve(results);
        }
      });
      kid.on('error', reject);
    }
  });
}

/* A progress line that rewrites itself, so a long sweep says where it is
   without scrolling a thousand lines past. */
function ticker(label) {
  let last = 0;
  return (done, total) => {
    const now = Date.now();
    if (done < total && now - last < 400) return;
    last = now;
    const pct = Math.round(done / total * 100);
    const bar = '='.repeat(Math.round(pct / 4)).padEnd(25, ' ');
    process.stderr.write('\r  ' + label + ' [' + bar + '] ' + pct + '%' + (done >= total ? '\n' : ''));
  };
}

module.exports = { run, ticker, WORKERS };
