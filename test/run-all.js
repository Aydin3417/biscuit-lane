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
  /* the one seam money comes in through, and the one call shape that
     silently gave a season book away when it was got wrong */
  ['the till', 'till.js', []],
  /* the economy, played out on paper: it was dead on day 25 and nobody
     had ever looked. A reward that cannot be spent is not a reward. */
  ['the economy, ninety days', 'economy.js', ['90', '--plays', '8']],
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
/* The ceiling on the cared-for curves was 93, and it was wrong.

   It failed the suite about one run in four on a build nobody had
   touched. Measured: the handcrafted cared-for curve sits at 90%, and
   the same sixty levels with the *original* move counts also sit at 90
   — 90/90/90 against 90/89/89 over three runs each. The 88 and the 94
   that bracket those are the same distribution, not a drift.

   Five games a level over sixty levels is only three hundred games, and
   the spread that leaves is about four points either side of the mean.
   A hard ceiling four points above the mean is a coin flip dressed as a
   gate, which is worse than no gate: a suite that cries wolf gets
   ignored, and the next real drift walks through behind it.

   Two changes rather than one, because widening a band on its own hides
   noise instead of reducing it. The gate now samples nine games a level,
   which pulls the spread in by about a quarter, and the ceiling moves to
   96 — still far below "the pet plays it for you", which is the thing
   this gate exists to catch. */
/* `node test/run-all.js quick` drops the four difficulty sweeps to two
   games a level and skips the two cared-for curves.

   The full run is four sweeps of nine games over sixty to eighty levels
   — around two thousand solved boards — and takes long enough that it
   stops being run, which is the only way a suite fails for real. Quick
   is not a substitute for it: two games a level cannot tell a drifting
   curve from a run of bad luck, and the band check is skipped rather
   than loosened, because a gate that passes on noise is worse than no
   gate. It answers the one question worth asking every few minutes —
   does every level still build, deal and finish — and leaves the rest
   to the full run before a release. */
const QUICK = process.argv[2] === 'quick';
const CURVE_GAMES = QUICK ? 2 : 9;
const CURVES = [
  ['the handcrafted lane', 1, 60, 0, 55, 90],
  ['the handcrafted lane, cared-for pet', 1, 60, 1, 60, 96],
  ['the endless run', 61, 140, 0, 55, 90],
  ['the endless run, cared-for pet', 61, 140, 1, 60, 96],
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

/* Nine games per level. Enough to notice a whole curve sliding, nowhere
near enough to judge a single level — at five samples the noise is
   about twenty points either way, so the per-level verdicts are
   deliberately not printed. Use `node test/ai.js <first> <last> 20` to
   settle one level.

   Two curves, because there are two: sixty levels somebody wrote, and
   the endless run after them, which is most of what anyone plays and
   was the half nobody was measuring. */
for (const [label, first, last, perks, lo, hi] of (QUICK ? CURVES.filter(c => !c[3]) : CURVES)) {
  process.stdout.write('\n=== difficulty: ' + label + ' (' + CURVE_GAMES + ' games per level) ===\n');
  try {
    const raw = execFileSync(process.execPath,
      [path.join(__dirname, 'ai.js'), String(first), String(last), String(CURVE_GAMES)],
      { encoding: 'utf8', stdio: 'pipe',
        env: Object.assign({}, process.env, { PERKS: String(perks) }) });
    raw.split('\n')
      .filter(l => /^(overall|three-star)/.test(l))
      .forEach(l => process.stdout.write(l + '\n'));
    const m = raw.match(/overall clear rate\s+(\d+)/);
    const clear = m ? +m[1] : NaN;
    if (QUICK) {
      process.stdout.write(isFinite(clear)
        ? 'ran (band not checked at ' + CURVE_GAMES + ' games)\n'
        : 'the sweep produced no clear rate\n');
      if (!isFinite(clear)) failed++;
    } else if (!isFinite(clear) || clear < lo || clear > hi) {
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
process.stdout.write('browser layer: npm run test:browser (39 checks, puts its own server up)\n');
process.exitCode = failed ? 1 : 0;
