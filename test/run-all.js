/* Runs every test that does not need a browser, in order of how fast it
   fails. The DOM layer lives in test/integration.html and is driven by
   tools/browser.js, which needs a running server and a real Chrome — so
   it is not in this list, and the last line says how to run it.

     node test/run-all.js
     node tools/serve.js  &&  node tools/browser.js     the DOM layer
*/
const { execFileSync } = require('child_process');
const path = require('path');

const steps = [
  ['module integrity', 'check.js', []],
  /* cheapest first: a missing translation is found by reading two
     tables, and it is the fault most likely to reach a player */
  ['every string, in both languages', 'strings.js', []],
  /* colour is gameplay: six tiles a player has to tell apart, measured
     against a recorded baseline and under three kinds of colour
     blindness. Cheap, and the only check that would notice an art
     change making the board harder. */
  ['the colours, as gameplay', 'palette.js', []],
  ['engine soak + level design audit', 'sim.js', []],
  ['the ice rule', 'ice.js', []],
  ['the care loop', 'care.js', []],
  ['the mobile app layer', 'mobile.js', []],
  /* The endless run is designed now, not rolled — this asks whether it
     came out the shape it was drawn as. Fewer games than the sweeps
     below because it reports per level, not per band. */
  ['the shape of the run', 'curve.js', ['61', '100', '10']],
  /* the authored lane is designed now too, and is measured over its
     whole length rather than sampled */
  ['the shape of the lane', 'curve.js', ['1', '60', '10']],
  ['the pet move, breed by breed', 'charge.js', ['1', '60', '2']],
];

/* Two curves to hold, not one. The handcrafted lane is sixty levels
   somebody wrote; the endless run is every level after that, which is
   most of what anyone plays, and it was the half nobody was measuring.

   And each of them twice, because the pet the player brings changes the
   answer by more than a dozen points. A bare pet is the floor; a
   cared-for one is the case, and it is the one that can run off the top
   of the band without anybody noticing. */
/* The band is not the same question for a bare pet and a cared-for one.

   A bare pet is the floor: the player who has fed nothing, and the basis
   every difficulty figure in this project was measured on. That one has
   to sit between 55 and 88 — never a wall, never free.

   A cared-for pet brings four more moves and twelve percent more score
   to the same board, and it is supposed to. Those perks are the whole
   payment for the care loop, and holding the perked run to the same
   ceiling is asking the reward not to work. It gets 93, which still
   refuses "the game plays itself", and the gates inside the run are
   measured separately by test/curve.js — they land near sixty percent
   whatever the pet is carrying. */
const CURVES = [
  ['the handcrafted lane', 1, 60, 0, 55, 88],
  ['the handcrafted lane, cared-for pet', 1, 60, 1, 60, 93],
  ['the endless run', 61, 140, 0, 55, 88],
  ['the endless run, cared-for pet', 61, 140, 1, 60, 93],
];

let failed = 0;
for (const [label, file, args] of steps) {
  process.stdout.write('\n=== ' + label + ' ===\n');
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, file), ...args], {
      encoding: 'utf8', stdio: 'pipe'
    });
    process.stdout.write(out);
  } catch (e) {
    failed++;
    process.stdout.write((e.stdout || '') + (e.stderr || ''));
    process.stdout.write('--- FAILED ---\n');
  }
}

/* Five games per level. Enough to notice a whole curve sliding, nowhere
   near enough to judge a single level — at five samples the noise is
   about twenty points either way, so the per-level verdicts are
   deliberately not printed. Use `node test/ai.js <first> <last> 20` to
   settle one level.

   Two curves, because there are two: sixty levels somebody wrote, and
   the endless run after them, which is most of what anyone plays and
   was the half nobody was measuring. */
for (const [label, first, last, perks, lo, hi] of CURVES) {
  process.stdout.write('\n=== difficulty: ' + label + ' (5 games per level) ===\n');
  try {
    const raw = execFileSync(process.execPath,
      [path.join(__dirname, 'ai.js'), String(first), String(last), '5'],
      { encoding: 'utf8', stdio: 'pipe',
        env: Object.assign({}, process.env, { PERKS: String(perks) }) });
    raw.split('\n')
      .filter(l => /^(overall|three-star)/.test(l))
      .forEach(l => process.stdout.write(l + '\n'));
    const m = raw.match(/overall clear rate\s+(\d+)/);
    const clear = m ? +m[1] : NaN;
    if (!isFinite(clear) || clear < lo || clear > hi) {
      failed++;
      process.stdout.write('the curve has drifted: expected ' + lo + '-' + hi + '% overall\n');
    } else {
      process.stdout.write('within range (' + lo + '-' + hi + '%)\n');
    }
  } catch (e) {
    failed++;
    process.stdout.write('difficulty sweep failed\n');
  }
}

process.stdout.write('\n' + (failed ? failed + ' suite(s) failed\n' : 'all suites passed\n'));
process.stdout.write('browser layer: node tools/serve.js, then node tools/browser.js (39 checks)\n');
process.exitCode = failed ? 1 : 0;
