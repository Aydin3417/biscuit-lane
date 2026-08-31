/* The gate a visual change has to get through.

   An art direction can break this game in ways that look fine in a
   screenshot. Two tile colours moving closer together makes every board
   harder, and no difficulty test in this project would notice, because
   the solver compares type indices and has never looked at a colour. A
   texture that costs a gradient per tile per frame reads beautifully in
   a still and drops the board to thirty frames. A tone that fails
   contrast is unreadable for the people who most need it not to be.

   So this is the other half of the loop. Gemini says what the game
   should look like; this says whether the game still plays.

     node tools/art-gate.js          the fast pass, about a minute
     node tools/art-gate.js --full   with the difficulty sweep on top

   Nothing here is new work — it is the checks this project already has,
   collected into the order that matters after a visual change, so that
   "it looks better" and "it still works" are answered together.
*/
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FULL = process.argv.includes('--full');
const node = process.execPath;

const steps = [
  {
    name: 'the build is current',
    why: 'a screenshot of a stale bundle is a screenshot of the last idea',
    run: () => execFileSync(node, [path.join(ROOT, 'build.js')], { encoding: 'utf8' })
  },
  {
    name: 'the colours still play',
    why: 'tile separation, including three kinds of colour blindness, against the recorded baseline',
    run: () => execFileSync(node, [path.join(ROOT, 'test', 'palette.js')], { encoding: 'utf8' })
  },
  {
    name: 'nothing is unnamed or untranslated',
    why: 'a new label added in one language is a raw key in the other',
    run: () => execFileSync(node, [path.join(ROOT, 'test', 'strings.js')], { encoding: 'utf8' })
  },
  {
    name: 'the modules still hold together',
    why: 'art code is game code; a duplicate top-level name is fatal in a single scope',
    run: () => execFileSync(node, [path.join(ROOT, 'test', 'check.js')], { encoding: 'utf8' })
  },
  {
    name: 'the interface still works',
    why: 'focus, sheets, reachability, spill on a small phone — 39 checks in a real browser',
    run: () => execFileSync(node, [path.join(__dirname, 'browser.js')], { encoding: 'utf8' })
  },
  {
    name: 'the frame budget survived',
    why: 'a still image cannot show you thirty frames a second',
    run: () => execFileSync(node, [path.join(__dirname, 'frame.js')], { encoding: 'utf8' })
  },
  {
    name: 'nothing throws anywhere',
    why: 'every screen, every sheet, every level kind, swept',
    run: () => execFileSync(node, [path.join(__dirname, 'hunt.js')], { encoding: 'utf8' })
  }
];

if (FULL) {
  steps.push({
    name: 'the difficulty is where it was left',
    why: 'colour is gameplay; this is the only check that plays the game',
    run: () => execFileSync(node, [path.join(ROOT, 'test', 'run-all.js')], { encoding: 'utf8' })
  });
}

/* one number worth pulling out of the frame report, so a regression is
   visible without reading JSON */
function frameSummary(out) {
  try {
    const j = JSON.parse(out.trim().split('\n').pop());
    const med = j.runs.realistic.map(r => r.med);
    const p90 = j.runs.storm.map(r => r.p90);
    return 'ortalama kare ' + Math.min.apply(null, med).toFixed(1) + '-' +
      Math.max.apply(null, med).toFixed(1) + 'ms, fırtınada p90 ' +
      Math.max.apply(null, p90).toFixed(1) + 'ms';
  } catch (e) { return ''; }
}

let failed = 0;
const t0 = Date.now();
for (const s of steps) {
  process.stdout.write('  ' + s.name.padEnd(36));
  const started = Date.now();
  try {
    const out = s.run() || '';
    const secs = ((Date.now() - started) / 1000).toFixed(0);
    let extra = '';
    if (/frame/.test(s.name)) extra = '  ' + frameSummary(out);
    if (/interface/.test(s.name)) {
      const m = out.match(/(\d+) geçti, (\d+) kaldı/);
      if (m) extra = '  ' + m[1] + '/' + (+m[1] + +m[2]);
    }
    console.log('ok    ' + secs + 's' + extra);
  } catch (e) {
    failed++;
    console.log('FAIL');
    const body = ((e.stdout || '') + (e.stderr || e.message || '')).trim();
    body.split('\n').slice(-14).forEach(l => console.log('        ' + l));
    console.log('        (' + s.why + ')');
  }
}

console.log('');
console.log(failed
  ? failed + ' adım geçmedi — görsel değişiklik oyunu bozuyor'
  : 'the change looks different and still plays the same' +
    (FULL ? '' : '   (--full ile zorluk taraması da koşar)'));
console.log(((Date.now() - t0) / 1000).toFixed(0) + 's');
process.exit(failed ? 1 : 0);
