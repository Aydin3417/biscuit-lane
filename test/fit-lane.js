/* Give each authored level the target it can actually carry, and the
   move budget that lands it there.

   The first attempt drew one formula across all sixty levels and asked
   them to meet it. Measured, they could not: a fifth of the lane tops
   out below eighty-five percent however long it is given, because a
   rescue has to walk baskets the length of the board and a bramble
   patch grows back while you cut it. Rolling the design down until
   every level could meet it produced a lane that fell eighteen points
   across sixty levels — which is not a curve, it is a plateau with a
   slope drawn on it.

   The rhythm is fitted to the material instead.

   Every block of ten keeps its shape: the tenth level is the gate, the
   first is the relief that follows one, and those two are pinned where
   the map and the level card say they are. The eight beats in between
   are handed out by what each level can do — the highest beat to the
   level with the most headroom, the lowest to the level with the least.
   So a bramble patch that cannot be a gift stops being asked to be one,
   and a collect level with a hundred-percent ceiling takes the gift
   instead. The player still feels a block that gives, builds and then
   asks; it is simply no longer assigned by position alone.

   What comes out is a number per level, written into the table as
   `want`. Design intent as data, not as a formula — which is how it can
   be argued with, overridden for one level, and read.

     node test/fit-lane.js            report only
     node test/fit-lane.js --write    write want/moves/base into 10-data.js
*/
const fs = require('fs');
const path = require('path');
const { run, ticker } = require('./_pool.js');
const { X } = require('./_solver.js');

const WRITE = process.argv.includes('--write');
const ENV = path.join(__dirname, '..', 'lane-envelope.json');
if (!fs.existsSync(ENV)) { console.error('önce: node test/envelope.js'); process.exit(1); }
const E = JSON.parse(fs.readFileSync(ENV, 'utf8'));
const BLOCK = 10, RUN_START = 61;
const RHYTHM = [+.13, +.06, +.02, -.03, +.05, -.04, -.07, -.02, -.09, -.15];

/* The descent, as designed. It is still a formula — what changes is
   that the beats around it are placed rather than assumed. */
const LANE_FROM = .93, LANE_BEND = 1.6, EASE_AT_HANDOFF = .78;
const easeAt = n => EASE_AT_HANDOFF + (LANE_FROM - EASE_AT_HANDOFF) *
  Math.pow(1 - (n - 1) / (RUN_START - 1), LANE_BEND);
const beatScale = n => .45 + .55 * ((n - 1) / (RUN_START - 1));
const TUT_LIFT = .06;

const rowOf = {};
E.rows.forEach(r => rowOf[r.n] = r);
const ceilOf = r => r.pts[r.pts.length - 1].p;
const floorOf = r => r.pts[0].p;

/* headroom is what decides who gets the gift: how high this level can
   go relative to what its block is being asked for on average */
const want = {};
for (let b = 0; b * BLOCK < 60; b++) {
  const ns = [];
  for (let i = 1; i <= BLOCK; i++) ns.push(b * BLOCK + i);
  const pinned = { [ns[0]]: 0, [ns[BLOCK - 1]]: BLOCK - 1 };   /* relief, gate */
  const middle = ns.slice(1, BLOCK - 1);
  const beats = RHYTHM.slice(1, BLOCK - 1).slice().sort((a, z) => z - a);   /* high to low */
  const byRoom = middle.slice().sort((a, z) => ceilOf(rowOf[z]) - ceilOf(rowOf[a]));
  const beatFor = {};
  Object.keys(pinned).forEach(n => beatFor[n] = RHYTHM[pinned[n]]);
  byRoom.forEach((n, i) => beatFor[n] = beats[i]);

  ns.forEach(n => {
    let w = easeAt(n) + beatFor[n] * beatScale(n);
    if (X.LEVELS[n - 1].tut) w += TUT_LIFT;
    /* A target outside what the level can reach is not a target, it is
       a complaint. Held one noise-width inside the measured envelope so
       the budget search has somewhere to land. */
    const lo = floorOf(rowOf[n]) + .03, hi = ceilOf(rowOf[n]) - .03;
    want[n] = Math.round(Math.max(Math.min(w, Math.max(hi, lo)), Math.min(lo, hi)) * 100) / 100;
  });
}

/* the budget that lands on it, read off the level's own response curve
   and then verified by playing it */
function budgetFor(n, target) {
  const pts = rowOf[n].pts;
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i].p <= target && target <= pts[i + 1].p) {
      const span = pts[i + 1].p - pts[i].p || 1;
      const t = (target - pts[i].p) / span;
      return Math.max(6, Math.round(pts[i].m + t * (pts[i + 1].m - pts[i].m)));
    }
  }
  return target > pts[pts.length - 1].p ? pts[pts.length - 1].m : pts[0].m;
}

const N_VERIFY = 64;
(async () => {
  const guess = {};
  const jobs = [];
  const at = {};
  for (let n = 1; n <= 60; n++) {
    guess[n] = budgetFor(n, want[n]);
    at[n] = jobs.length;
    for (let g = 0; g < N_VERIFY; g++) jobs.push([n, n * 7919 + g * 104729 + 77, guess[n]]);
  }
  let res = await run(jobs, ticker('doğrulama'));

  /* A budget read off four measured points is a guess with error bars.
     Verified, most levels land inside the noise and a handful do not —
     the response curve between two ladder rungs is not a straight line,
     and on a level where one more move buys a whole extra cascade it is
     not even close. So the ones that miss get corrected against their
     own local slope and played again. Two rounds, because the third
     never moved anything by more than the noise. */
  const rateAt = n => {
    const slice = res.slice(at[n], at[n] + N_VERIFY);
    return slice.filter(r => r.won).length / N_VERIFY;
  };
  for (let round = 0; round < 2; round++) {
    const fix = [];
    for (let n = 1; n <= 60; n++) if (Math.abs(rateAt(n) - want[n]) > .08) fix.push(n);
    if (!fix.length) break;
    console.error('  düzeltme turu ' + (round + 1) + ': ' + fix.length + ' seviye');
    const jobs2 = [];
    const at2 = {};
    for (const n of fix) {
      const pts = rowOf[n].pts;
      /* slope in clear-rate per move, across the whole measured ladder,
         floored so a flat level does not ask for a thousand moves */
      const span = pts[pts.length - 1].m - pts[0].m || 1;
      const rise = Math.max(.012, pts[pts.length - 1].p - pts[0].p);
      const perMove = rise / span;
      const delta = (want[n] - rateAt(n)) / perMove;
      const lo = Math.round(rowOf[n].m0 * .7), hi = Math.round(rowOf[n].m0 * 1.5);
      guess[n] = Math.max(6, Math.min(hi, Math.max(lo, Math.round(guess[n] + Math.max(-8, Math.min(8, delta))))));
      at2[n] = jobs2.length;
      for (let g = 0; g < N_VERIFY; g++) jobs2.push([n, n * 7919 + g * 104729 + 77, guess[n]]);
    }
    const res2 = await run(jobs2, ticker('düzeltme'));
    for (const n of fix) for (let g = 0; g < N_VERIFY; g++) res[at[n] + g] = res2[at2[n] + g];
  }

  const out = {};
  let miss = 0, worst = 0;
  console.log('lvl  tür        hedef  ölçülen   hamle        yıldız');
  for (let n = 1; n <= 60; n++) {
    const slice = res.slice(at[n], at[n] + N_VERIFY);
    const p = slice.filter(r => r.won).length / N_VERIFY;
    const wins = slice.filter(r => r.won).map(r => r.score).sort((a, z) => a - z);
    const def = X.levelDef(n);
    /* three stars for roughly the best third of winning runs */
    const base = wins.length ? Math.round(wins[Math.floor(wins.length * .7)] / 100) * 100 : def.base;
    const d = Math.abs(p - want[n]);
    miss += d; worst = Math.max(worst, d);
    out[n] = { n, want: want[n], p, moves: guess[n], m0: rowOf[n].m0, base, base0: def.base };
    console.log(
      String(n).padStart(3) + '  ' + String(def.goals[0][0]).padEnd(10) +
      String(Math.round(want[n] * 100)).padStart(4) + '%' +
      String(Math.round(p * 100)).padStart(8) + '%' +
      String(rowOf[n].m0).padStart(7) + '→' + String(guess[n]).padStart(3) +
      String(def.base).padStart(9) + '→' + String(base).padStart(6));
  }
  fs.writeFileSync(path.join(__dirname, '..', 'tuned-lane.json'), JSON.stringify(out, null, 1));

  const noise = Math.sqrt(.25 / N_VERIFY);
  console.log('');
  console.log('ortalama sapma ' + Math.round(miss / 60 * 100) + '%  (örnekleme gürültüsü ' + Math.round(noise * 100) + '%)');
  const clamped = [];
  for (let n = 1; n <= 60; n++) {
    const hi = ceilOf(rowOf[n]) - .03, lo = floorOf(rowOf[n]) + .03;
    const raw = easeAt(n) + RHYTHM[(n - 1) % BLOCK] * beatScale(n);
    if (want[n] >= hi - .005 || want[n] <= lo + .005) clamped.push(n);
  }
  if (clamped.length) console.log('zarfın kenarına dayanan ' + clamped.length + ' seviye: ' + clamped.join(' '));
  const ws = []; for (let n = 1; n <= 60; n++) ws.push(want[n]);
  console.log('şerit ' + Math.round(ws[0] * 100) + '% ile başlıyor, ' + Math.round(ws[59] * 100) + '% ile bitiyor');
  const gates = [10, 20, 30, 40, 50, 60].map(n => want[n]);
  const reliefs = [11, 21, 31, 41, 51].map(n => want[n]);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  console.log('kapılar ort ' + Math.round(mean(gates) * 100) + '%, kapı sonrası rahatlama ort ' + Math.round(mean(reliefs) * 100) + '%');
  console.log('tuned-lane.json yazıldı');
  if (WRITE) require('./apply-lane.js')(out);
})();
