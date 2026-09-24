/* What a win streak does to a level.

   The streak (WIN_RUN in 10-data.js) puts gifts on the board before the
   first move, and a gift on the board is difficulty taken away. Every
   level in this game is fitted to a clear rate measured with nothing on
   the board, so before the streak was switched on it was measured: the
   same levels, the same seeds, bare and at each step of the run, by the
   player who cannot see cascades.

     node test/streak.js [first] [last] [games]     default 1 100 8

   Prints the clear rate by beat — relief, middle, run-up, gate — because
   a streak that turns every gate into a formality is a streak that has
   taken the walls out of the game.
*/
const { playLevel, X } = require('./_solver.js');
const nums = process.argv.slice(2).map(Number);
const FIRST = nums[0] || 1, LAST = nums[1] || 100, GAMES = nums[2] || 8;

const beatOf = n => X.isGate(n) ? 'gate' : (n % 10 === 1 ? 'relief' : (n % 10 === 9 ? 'run-up' : 'middle'));
const rows = {};
for (let run = 0; run <= 3; run++) {
  process.env.STREAK = String(run);
  for (let n = FIRST; n <= LAST; n++) {
    let won = 0;
    for (let g = 0; g < GAMES; g++) if (playLevel(n, n * 50021 + g * 7331).won) won++;
    const b = beatOf(n);
    const k = run + ':' + b;
    rows[k] = rows[k] || [0, 0];
    rows[k][0] += won; rows[k][1] += GAMES;
    const a = run + ':all';
    rows[a] = rows[a] || [0, 0];
    rows[a][0] += won; rows[a][1] += GAMES;
  }
}
if (process.env.JSON) { console.log(JSON.stringify(rows)); process.exit(0); }
const pct = k => rows[k] ? Math.round(rows[k][0] / rows[k][1] * 100) + '%' : '-';
console.log('levels ' + FIRST + '-' + LAST + ', ' + GAMES + ' games a level\n');
console.log('run    relief  middle  run-up  gate    all');
for (let run = 0; run <= 3; run++) {
  console.log(String(run).padEnd(7) + ['relief', 'middle', 'run-up', 'gate', 'all'].map(b => pct(run + ':' + b).padEnd(8)).join(''));
}
