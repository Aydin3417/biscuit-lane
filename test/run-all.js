/* Runs every test that does not need a browser, in order of how fast it
   fails. The DOM layer lives in test/integration.html — open that in the
   preview (it drives the built game inside an iframe).

     node test/run-all.js
*/
const { execFileSync } = require('child_process');
const path = require('path');

const steps = [
  ['module integrity', 'check.js', []],
  ['engine soak + level design audit', 'sim.js', []],
  ['the ice rule', 'ice.js', []],
  ['the care loop', 'care.js', []],
  ['the mobile app layer', 'mobile.js', []],
  ['the pet move, breed by breed', 'charge.js', ['1', '60', '2']],
];

/* Two curves to hold, not one. The handcrafted lane is sixty levels
   somebody wrote; the endless run is every level after that, which is
   most of what anyone plays, and it was the half nobody was measuring.

   And each of them twice, because the pet the player brings changes the
   answer by more than a dozen points. A bare pet is the floor; a
   cared-for one is the case, and it is the one that can run off the top
   of the band without anybody noticing. */
const CURVES = [
  ['the handcrafted lane', 1, 60, 0],
  ['the handcrafted lane, cared-for pet', 1, 60, 1],
  ['the endless run', 61, 140, 0],
  ['the endless run, cared-for pet', 61, 140, 1],
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
for (const [label, first, last, perks] of CURVES) {
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
    if (!isFinite(clear) || clear < 55 || clear > 88) {
      failed++;
      process.stdout.write('the curve has drifted: expected 55-88% overall\n');
    } else {
      process.stdout.write('within range (55-88%)\n');
    }
  } catch (e) {
    failed++;
    process.stdout.write('difficulty sweep failed\n');
  }
}

process.stdout.write('\n' + (failed ? failed + ' suite(s) failed\n' : 'all suites passed\n'));
process.stdout.write('browser layer: open test/integration.html (37 checks)\n');
process.exitCode = failed ? 1 : 0;
