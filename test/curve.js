/* Does the run have the shape it was designed to have?

   src/js/11-design.js says what every level in the endless run is meant
   to feel like: a ten-level block with relief after a gate, a build
   across the middle, and a gate at the end that has to be earned. The
   generator reads that target and solves for a move budget using the
   response curves measured by test/calibrate.js.

   This is the acceptance test for all of it. It plays the run and asks
   two questions the band check cannot: does each level land near its own
   target, and is the rhythm actually audible — are the gates harder than
   the relief that follows them?

     node test/curve.js [first] [last] [gamesPerLevel]
*/
const { playLevel, X } = require('./_solver.js');
const { levelDef } = X;

const FIRST = +process.argv[2] || 61;
const LAST = +process.argv[3] || 120;
const GAMES = +process.argv[4] || 16;

/* the design lives in the game's own source, so read it from there
   rather than restating it here and letting the two drift */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
/* The design module is read in its own little context rather than
   through the game, so the intent can be quoted without the generator
   in the room. It does need one thing from the table: a level that
   teaches a mechanic for the first time is given a cushion, and which
   levels those are is a fact about LEVELS. Without it this file would
   quote a target seven points below the one the lane was tuned to, and
   the two tools would disagree about the same number. */
const design = { Math, clamp: (v, a, b) => Math.max(a, Math.min(b, v)), LEVELS: X.LEVELS };
const util = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '00-util.js'), 'utf8');
vm.createContext(design);
vm.runInContext(util.match(/function mulberry[\s\S]*?\n}/)[0], design);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '11-design.js'), 'utf8'), design);
const { targetClear, isGate } = vm.runInContext('({ targetClear, isGate })', design);

const rows = [];
for (let n = FIRST; n <= LAST; n++) {
  let won = 0;
  for (let g = 0; g < GAMES; g++) if (playLevel(n, n * 7919 + g * 104729).won) won++;
  const actual = won / GAMES;
  const want = targetClear(n);
  rows.push({ n, want, actual, gate: isGate(n), err: actual - want, moves: levelDef(n).moves });
}

/* the solver's own noise at this sample size, so the report can say what
   is a miss and what is a coin */
const noise = Math.sqrt(.25 / GAMES);

/* the same report reads the authored lane and the generated run — they
   are one curve now, and calling both "the run" was a leftover from
   when only half the game had a shape */
console.log((LAST < 61 ? 'the shape of the lane' : FIRST > 60 ? 'the shape of the run' : 'the shape of the game') +
  ', levels ' + FIRST + '-' + LAST +
  ', ' + GAMES + ' games each  (+/-' + Math.round(noise * 100) + '% is the sampling noise)\n');
console.log('lvl   want  got   moves        ');
rows.forEach(r => {
  const bar = (v) => '#'.repeat(Math.round(v * 22));
  console.log(String(r.n).padEnd(6) +
    String(Math.round(r.want * 100)).padStart(3) + '%' +
    String(Math.round(r.actual * 100)).padStart(6) + '%' +
    String(r.moves).padStart(6) + '   ' +
    (r.gate ? 'GATE ' : '     ') + bar(r.actual));
});

const mae = rows.reduce((a, r) => a + Math.abs(r.err), 0) / rows.length;
const bias = rows.reduce((a, r) => a + r.err, 0) / rows.length;
const gates = rows.filter(r => r.gate);
/* the level after a gate is the relief the block is built around */
const reliefs = rows.filter(r => isGate(r.n - 1));
const gateMean = gates.length ? gates.reduce((a, r) => a + r.actual, 0) / gates.length : 0;
const reliefMean = reliefs.length ? reliefs.reduce((a, r) => a + r.actual, 0) / reliefs.length : 0;

console.log('\naverage miss      ' + Math.round(mae * 100) + '%   (sampling noise alone is ' + Math.round(noise * 100) + '%)');
console.log('bias              ' + (bias >= 0 ? '+' : '') + Math.round(bias * 100) + '%   ' +
  (bias > .06 ? 'the run is easier than intended' : bias < -.06 ? 'the run is harder than intended' : 'centred'));
console.log('gates             ' + Math.round(gateMean * 100) + '% cleared over ' + gates.length + ' of them');
console.log('relief after one  ' + Math.round(reliefMean * 100) + '%');
console.log('the rhythm is     ' + Math.round((reliefMean - gateMean) * 100) + ' points wide');

const problems = [];
if (mae > noise + .10) problems.push('levels miss their target by ' + Math.round(mae * 100) + '% on average');
if (Math.abs(bias) > .10) problems.push('the whole run sits ' + Math.round(bias * 100) + '% off its intent');
if (reliefMean - gateMean < .10) problems.push('the rhythm is inaudible: relief ' +
  Math.round(reliefMean * 100) + '% against gates ' + Math.round(gateMean * 100) + '%');
/* A level is only called out when the sample can carry the claim. At
   fourteen games a clean sweep still has a lower bound near 77%, so
   "cleared 100%" is not evidence that a level meant to be won 86% of the
   time is free — it is evidence of fourteen games. The margin is two
   standard errors, which is what the report already quotes as noise. */
const margin = 2 * noise;
rows.forEach(r => {
  if (r.actual + margin < .30) problems.push('level ' + r.n + ' cleared ' + Math.round(r.actual * 100) + '% — a wall');
  if (r.actual - margin > r.want + .12) {
    problems.push('level ' + r.n + ' wanted ' + Math.round(r.want * 100) +
      '% and cleared ' + Math.round(r.actual * 100) + '%');
  }
});

console.log('');
if (problems.length) { [...new Set(problems)].forEach(p => console.log('  PROBLEM  ' + p)); process.exitCode = 1; }
else console.log('the run has the shape it was designed to have');
