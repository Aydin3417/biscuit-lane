/* What the authored lane is actually capable of.

   The first attempt at designing the lane drew a curve and then asked
   each level to meet it with move budgets. Some could not: level 20
   wanted eighty percent and stopped at seventy-five with fifty-three
   moves against an authored thirty, and level 24 — a bramble patch —
   did not move at all when its goal was halved, because what makes a
   bramble level hard is the regrowth, not the count.

   Handing a level seventy percent more moves does not make it easier.
   It makes it longer, and a long level that is still lost is the worst
   of both. So before deciding what the lane should be, this measures
   what it can be: every level, at four budgets either side of the one
   it was authored with, which is the widest band that leaves the level
   recognisably the level somebody wrote.

   The curve gets drawn inside that envelope. That is designing to the
   material rather than at it.

     node test/envelope.js [games]
*/
const fs = require('fs');
const path = require('path');
const { run, ticker } = require('./_pool.js');
const { X } = require('./_solver.js');

const GAMES = +process.argv[2] || 24;
const SCALES = [.8, 1, 1.18, 1.35];
const FIRST = 1, LAST = 60;

(async () => {
  const jobs = [];
  const index = [];
  for (let n = FIRST; n <= LAST; n++) {
    const m0 = X.levelDef(n).moves;
    for (const s of SCALES) {
      const m = Math.max(6, Math.round(m0 * s));
      index.push({ n, s, m, at: jobs.length });
      for (let g = 0; g < GAMES; g++) jobs.push([n, n * 7919 + g * 104729 + 13, m]);
    }
  }
  console.error(jobs.length + ' oyun, ' + GAMES + ' oyun/nokta');
  const res = await run(jobs, ticker('zarf'));

  const rows = [];
  for (let n = FIRST; n <= LAST; n++) {
    const def = X.levelDef(n);
    const pts = index.filter(i => i.n === n).map(i => {
      const slice = res.slice(i.at, i.at + GAMES);
      return { s: i.s, m: i.m, p: slice.filter(r => r.won).length / GAMES,
               score: slice.filter(r => r.won).map(r => r.score).sort((a, b) => a - b) };
    });
    /* clear rate rises with moves; noise sometimes says otherwise */
    for (let i = 1; i < pts.length; i++) if (pts[i].p < pts[i - 1].p) pts[i].p = pts[i - 1].p;
    rows.push({ n, m0: def.moves, base0: def.base, kind: def.goals[0][0], pts });
  }
  fs.writeFileSync(path.join(__dirname, '..', 'lane-envelope.json'),
    JSON.stringify({ games: GAMES, scales: SCALES, rows }, null, 1));

  console.log('lvl  tür        hamle   ' + SCALES.map(s => ('x' + s).padStart(6)).join(''));
  rows.forEach(r => console.log(
    String(r.n).padStart(3) + '  ' + String(r.kind).padEnd(10) +
    String(r.m0).padStart(4) + '   ' +
    r.pts.map(p => String(Math.round(p.p * 100) + '%').padStart(6)).join('')));

  const lo = rows.map(r => r.pts[0].p), hi = rows.map(r => r.pts[r.pts.length - 1].p);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  console.log('');
  console.log('en dar bütçede ortalama ' + Math.round(mean(lo) * 100) +
    '%, en geniş bütçede ' + Math.round(mean(hi) * 100) + '%');
  console.log('tavanı %85in altında kalan seviyeler: ' +
    rows.filter(r => r.pts[r.pts.length - 1].p < .85).map(r => r.n).join(' '));
  console.log('lane-envelope.json yazıldı');
})();
